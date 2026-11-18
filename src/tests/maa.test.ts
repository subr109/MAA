import { describe, expect, it } from 'vitest';
import {
  calculatePaymentAllocation,
  computeDashboardStats,
  computeMemberFinancialSummary,
  findDuplicateMobile,
  formatDateIN,
  formatINR,
  generateNextMemberCode,
  isDuplicateTransaction,
  rupeesToPaise,
} from '../lib/chandaEngine';
import { buildCommitteeDataset } from '../lib/committeeData';
import { buildReceiptMessageBody } from '../lib/whatsappTemplates';
import { CollectionMonth, Member, MemberLedger } from '../types/maa';

describe('MAA Financial & Chanda Allocation Engine', () => {
  it('1. Member creation: generates sequential MAA-XXXX codes and prevents duplicate mobile numbers', () => {
    const demo = buildCommitteeDataset();
    const nextCode = generateNextMemberCode(demo.members);
    expect(nextCode).toBe('MAA-0023');

    const dup = findDuplicateMobile(demo.members, '+91 9831098765');
    expect(dup?.memberCode).toBe('MAA-0001');

    const noDup = findDuplicateMobile(demo.members, '9999988888');
    expect(noDup).toBeUndefined();
  });

  it('2. Payment entry & multi-month AUTO_OLDEST allocation: Rahul Das paying Rs. 1,000 covers Jan & Feb', () => {
    const months: CollectionMonth[] = [
      { id: '2026-01', monthKey: '2026-01', label: 'Jan', financialYear: '2026-27', defaultAmountPaise: 50000, status: 'OPEN', createdBy: 'admin', createdAt: '', updatedAt: '' },
      { id: '2026-02', monthKey: '2026-02', label: 'Feb', financialYear: '2026-27', defaultAmountPaise: 50000, status: 'OPEN', createdBy: 'admin', createdAt: '', updatedAt: '' },
      { id: '2026-03', monthKey: '2026-03', label: 'Mar', financialYear: '2026-27', defaultAmountPaise: 50000, status: 'OPEN', createdBy: 'admin', createdAt: '', updatedAt: '' },
    ];
    const ledgers: MemberLedger[] = months.map((m) => ({
      id: `rahul_${m.monthKey}`,
      memberId: 'rahul',
      memberCode: 'MAA-0001',
      monthKey: m.monthKey,
      duePaise: 50000,
      paidPaise: 0,
      status: 'UNPAID',
      updatedAt: '',
    }));

    const res = calculatePaymentAllocation({
      amountPaise: rupeesToPaise(1000),
      allocationMode: 'AUTO_OLDEST',
      selectedMonthKey: '2026-01',
      memberLedgers: ledgers,
      collectionMonths: months,
      currentAdvancePaise: 0,
      defaultMemberMonthlyPaise: 50000,
    });

    expect(res.allocations).toEqual([
      { monthKey: '2026-01', allocatedPaise: 50000 },
      { monthKey: '2026-02', allocatedPaise: 50000 },
    ]);
    expect(res.updatedLedgers.find((l) => l.monthKey === '2026-01')?.status).toBe('PAID');
    expect(res.updatedLedgers.find((l) => l.monthKey === '2026-02')?.status).toBe('PAID');
    expect(res.updatedLedgers.find((l) => l.monthKey === '2026-03')?.status).toBe('UNPAID');
    expect(res.remainingDuePaise).toBe(50000);
  });

  it('3. Partial payment: paying Rs. 300 on Rs. 500 due leaves Rs. 200 remaining and PARTIAL status', () => {
    const months: CollectionMonth[] = [
      { id: '2026-01', monthKey: '2026-01', label: 'Jan', financialYear: '2026-27', defaultAmountPaise: 50000, status: 'OPEN', createdBy: 'admin', createdAt: '', updatedAt: '' },
    ];
    const ledgers: MemberLedger[] = [
      { id: 'm1_2026-01', memberId: 'm1', memberCode: 'MAA-0001', monthKey: '2026-01', duePaise: 50000, paidPaise: 0, status: 'UNPAID', updatedAt: '' },
    ];

    const res = calculatePaymentAllocation({
      amountPaise: rupeesToPaise(300),
      allocationMode: 'MANUAL',
      selectedMonthKey: '2026-01',
      memberLedgers: ledgers,
      collectionMonths: months,
      currentAdvancePaise: 0,
      defaultMemberMonthlyPaise: 50000,
    });

    expect(res.updatedLedgers[0].paidPaise).toBe(30000);
    expect(res.updatedLedgers[0].status).toBe('PARTIAL');
    expect(res.remainingDuePaise).toBe(20000);
  });

  it('4. Advance payment: paying Rs. 700 on Rs. 500 Jan due covers Jan and adds Rs. 200 to advance balance', () => {
    const months: CollectionMonth[] = [
      { id: '2026-01', monthKey: '2026-01', label: 'Jan', financialYear: '2026-27', defaultAmountPaise: 50000, status: 'OPEN', createdBy: 'admin', createdAt: '', updatedAt: '' },
    ];
    const ledgers: MemberLedger[] = [
      { id: 'm1_2026-01', memberId: 'm1', memberCode: 'MAA-0001', monthKey: '2026-01', duePaise: 50000, paidPaise: 0, status: 'UNPAID', updatedAt: '' },
    ];

    const res = calculatePaymentAllocation({
      amountPaise: rupeesToPaise(700),
      allocationMode: 'MANUAL',
      selectedMonthKey: '2026-01',
      memberLedgers: ledgers,
      collectionMonths: months,
      currentAdvancePaise: 0,
      defaultMemberMonthlyPaise: 50000,
    });

    expect(res.updatedLedgers[0].status).toBe('PAID');
    expect(res.advanceAddedPaise).toBe(20000);
    expect(res.newAdvanceBalancePaise).toBe(20000);
    expect(res.remainingDuePaise).toBe(0);
  });

  it('5. Duplicate transaction prevention: detects duplicate transactionId and UPI ref', () => {
    const demo = buildCommitteeDataset();
    const firstCompleted = demo.payments.find((p) => p.status === 'COMPLETED' && p.transactionRef)!;

    expect(
      isDuplicateTransaction(
        demo.payments,
        firstCompleted.transactionId,
        firstCompleted.memberId,
        firstCompleted.amountPaise,
        firstCompleted.paymentMethod
      )
    ).toBe(true);

    expect(
      isDuplicateTransaction(
        demo.payments,
        'TXN-BRAND-NEW',
        firstCompleted.memberId,
        firstCompleted.amountPaise,
        firstCompleted.paymentMethod,
        firstCompleted.transactionRef
      )
    ).toBe(true);

    expect(
      isDuplicateTransaction(
        demo.payments,
        'TXN-UNIQUE-999999',
        'mem-9999',
        50000,
        'CASH',
        ''
      )
    ).toBe(false);
  });

  it('6. Outstanding calculation: computes member due, paid, and remaining accurately', () => {
    const demo = buildCommitteeDataset();
    const member5 = demo.members.find((m) => m.id === 'mem-0005')!; // paid 4 of 6 months @ 500
    const summary = computeMemberFinancialSummary(member5, demo.ledgers, demo.payments);
    expect(summary.totalDuePaise).toBe(300000); // 6 * 500 = 3000 INR
    expect(summary.totalPaidPaise).toBe(200000); // 4 * 500 = 2000 INR
    expect(summary.totalOutstandingPaise).toBe(100000); // 1000 INR pending
    expect(summary.pendingMonthsCount).toBe(2);
  });

  it('7 & 8. Monthly collection & Expense calculation: Available Balance = Total Collection - Total Expenses', () => {
    const demo = buildCommitteeDataset();
    const stats = computeDashboardStats({
      members: demo.members,
      collectionMonths: demo.collectionMonths,
      ledgers: demo.ledgers,
      payments: demo.payments,
      expenses: demo.expenses,
      selectedMonthKey: '2026-11',
      lang: 'en',
    });

    expect(stats.totalRegisteredMembers).toBe(22);
    expect(stats.activeMembers).toBe(21);
    expect(stats.inactiveMembers).toBe(1);
    expect(stats.availableBalancePaise).toBe(
      stats.totalRecordedCollectionPaise - stats.totalPujaExpensesPaise
    );
    expect(stats.totalPujaExpensesPaise).toBeGreaterThan(0);
  });

  it('9. User permissions & formatting checks: INR formatting, DD-MM-YYYY date, and role structure', () => {
    const demo = buildCommitteeDataset();
    const superAdmin = demo.users.find((u) => u.role === 'SUPER_ADMIN')!;
    const collector = demo.users.find((u) => u.role === 'COLLECTION_ADMIN')!;
    const member = demo.users.find((u) => u.role === 'MEMBER')!;

    expect(superAdmin.canReversePayments).toBe(true);
    expect(collector.canReversePayments).toBe(false);
    expect(member.canAddMembers).toBe(false);
    expect(formatINR(125000)).toBe('₹1,250');
    expect(formatDateIN('2026-11-18')).toBe('18-11-2026');
  });

  it('10. WhatsApp template formatting & failure isolation checks', () => {
    const bnMsg = buildReceiptMessageBody(
      {
        memberName: 'Rahul Das',
        monthKey: '2026-11',
        amountPaise: 50000,
        paymentDate: '2026-11-18',
        receiptNumber: 'MAA-RCP-202611-0001',
        remainingDuePaise: 0,
      },
      'bn'
    );
    expect(bnMsg).toContain('Rahul Das');
    expect(bnMsg).toContain('MAA-RCP-202611-0001');
    expect(bnMsg).toContain('₹500');

    // Verify demo dataset explicitly includes a FAILED WhatsApp log entry without deleting payment
    const demo = buildCommitteeDataset();
    const failedWa = demo.whatsappNotifications.find((w) => w.status === 'FAILED');
    expect(failedWa).toBeDefined();
    expect(failedWa?.errorMessage).toContain('WHATSAPP_ACCESS_TOKEN');
  });

  it('11. Committee branding defaults to Mashunda Buniyadi School Math Shyama Puja Committee', () => {
    const demo = buildCommitteeDataset();
    expect(demo.settings.committeeName).toBe(
      'শ্রী শ্রী শ্যামা পূজা মাশুন্ডা বুনিয়াদি স্কুল মাঠ কমিটি'
    );
    const msg = buildReceiptMessageBody(
      {
        memberName: 'Rahul Das',
        monthKey: '2026-11',
        amountPaise: 50000,
        paymentDate: '2026-11-18',
        receiptNumber: 'MAA-RCP-202611-0001',
        remainingDuePaise: 0,
        committeeName: demo.settings.committeeName,
      },
      'bn'
    );
    expect(msg).toContain('শ্রী শ্রী শ্যামা পূজা মাশুন্ডা বুনিয়াদি স্কুল মাঠ কমিটি');
  });
});


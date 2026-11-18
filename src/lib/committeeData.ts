import {
  Announcement,
  AppUser,
  AuditLog,
  CollectionMonth,
  CommitteeSettings,
  Expense,
  Member,
  MemberLedger,
  Payment,
  Receipt,
  WhatsappNotification,
} from '../types/maa';
import {
  deriveLedgerStatus,
  formatDateIN,
  formatINR,
  formatMonthLabel,
  getCurrentISTDateISO,
} from './chandaEngine';

export function buildCommitteeDataset() {
  const nowIso = '2026-11-18T08:30:00.000Z';

  const users: AppUser[] = [
    {
      id: 'demo-super-admin',
      uid: 'demo-super-admin',
      name: 'Subhajit Roy (President)',
      email: 'sroy22000@gmail.com',
      phone: '9830011223',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      canAddMembers: true,
      canReversePayments: true,
      canManageExpenses: true,
      canSendBulkWhatsApp: true,
      createdAt: '2026-06-01T09:00:00.000Z',
      updatedAt: nowIso,
    },
    {
      id: 'demo-collector-1',
      uid: 'demo-collector-1',
      name: 'Anirban Chatterjee (Treasurer)',
      email: 'anirban.collector@maapuja.org',
      phone: '9830122334',
      role: 'COLLECTION_ADMIN',
      status: 'ACTIVE',
      canAddMembers: true,
      canReversePayments: false,
      canManageExpenses: true,
      canSendBulkWhatsApp: false,
      createdAt: '2026-06-01T09:00:00.000Z',
      updatedAt: nowIso,
    },
    {
      id: 'demo-member-1',
      uid: 'demo-member-1',
      name: 'Rahul Das',
      email: 'rahul.das@example.in',
      phone: '9831098765',
      role: 'MEMBER',
      memberId: 'mem-0001',
      status: 'ACTIVE',
      canAddMembers: false,
      canReversePayments: false,
      canManageExpenses: false,
      canSendBulkWhatsApp: false,
      createdAt: '2026-06-01T09:00:00.000Z',
      updatedAt: nowIso,
    },
  ];

  const settings: CommitteeSettings = {
    id: 'committee',
    committeeName: 'শ্রী শ্রী শ্যামা পূজা মাশুন্ডা বুনিয়াদি স্কুল মাঠ কমিটি',
    committeeAddress: 'মাশুন্ডা বুনিয়াদি স্কুল মাঠ (Mashunda Buniyadi School Math)',
    contactNumber: '+91 98300 11223',
    email: 'committee@mashundashyamapuja.org',
    pujaYear: '2026-2027 (১৪৩৩-৩৪ বঙ্গাব্দ)',
    defaultMonthlyChandaPaise: 50000, // ₹500
    financialYear: '2026-27',
    dueDay: 10,
    collectionStartDate: '2026-06-01',
    collectionEndDate: '2026-11-30',
    whatsappEnabled: true,
    whatsappPhoneNumberId: '',
    whatsappBusinessAccountId: '',
    whatsappApiVersion: 'v21.0',
    whatsappReceiptTemplate: 'maa_chanda_receipt_bn',
    whatsappReminderTemplate: 'maa_chanda_reminder_bn',
    whatsappAnnouncementTemplate: 'maa_puja_announcement_bn',
    whatsappDefaultLanguage: 'bn',
    defaultLanguage: 'bn',
    theme: 'light',
    updatedBy: 'demo-super-admin',
    updatedAt: nowIso,
  };

  const monthKeys = ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'];
  const collectionMonths: CollectionMonth[] = monthKeys.map((mk) => ({
    id: mk,
    monthKey: mk,
    label: formatMonthLabel(mk, 'en'),
    financialYear: '2026-27',
    defaultAmountPaise: 50000,
    dueDate: `${mk}-10`,
    status: 'OPEN',
    createdBy: 'demo-super-admin',
    createdAt: `${mk}-01T08:00:00.000Z`,
    updatedAt: `${mk}-01T08:00:00.000Z`,
  }));

  const rawMembers: Array<{
    id: string;
    code: string;
    name: string;
    mobile: string;
    area: string;
    chandaRupees: number;
    cat: Member['category'];
    status: Member['status'];
    consent: boolean;
    advanceRupees: number;
    paidMonths: number; // out of 6
    partialRupees?: number;
    userUid?: string;
  }> = [
    { id: 'mem-0001', code: 'MAA-0001', name: 'Rahul Das', mobile: '9831098765', area: 'Bagbazar', chandaRupees: 500, cat: 'GENERAL', status: 'ACTIVE', consent: true, advanceRupees: 200, paidMonths: 6, userUid: 'demo-member-1' },
    { id: 'mem-0002', code: 'MAA-0002', name: 'Soumyadeep Mukherjee', mobile: '9830112201', area: 'Shyambazar', chandaRupees: 1000, cat: 'PATRON', status: 'ACTIVE', consent: true, advanceRupees: 500, paidMonths: 6 },
    { id: 'mem-0003', code: 'MAA-0003', name: 'Debashis Sen', mobile: '9830112202', area: 'Bagbazar', chandaRupees: 500, cat: 'GENERAL', status: 'ACTIVE', consent: true, advanceRupees: 0, paidMonths: 5, partialRupees: 300 },
    { id: 'mem-0004', code: 'MAA-0004', name: 'Ananya Bhattacharya', mobile: '9830112203', area: 'Hatibagan', chandaRupees: 750, cat: 'FAMILY', status: 'ACTIVE', consent: true, advanceRupees: 0, paidMonths: 6 },
    { id: 'mem-0005', code: 'MAA-0005', name: 'Pradip Kumar Ghosh', mobile: '9830112204', area: 'Kumartuli', chandaRupees: 500, cat: 'SENIOR', status: 'ACTIVE', consent: true, advanceRupees: 0, paidMonths: 4 },
    { id: 'mem-0006', code: 'MAA-0006', name: 'Sudipta Banerjee', mobile: '9830112205', area: 'Sovabazar', chandaRupees: 1000, cat: 'PATRON', status: 'ACTIVE', consent: true, advanceRupees: 1000, paidMonths: 6 },
    { id: 'mem-0007', code: 'MAA-0007', name: 'Tapanendu Bose', mobile: '9830112206', area: 'Bagbazar', chandaRupees: 500, cat: 'GENERAL', status: 'ACTIVE', consent: false, advanceRupees: 0, paidMonths: 3 },
    { id: 'mem-0008', code: 'MAA-0008', name: 'Moumita Chakraborty', mobile: '9830112207', area: 'Shyambazar', chandaRupees: 600, cat: 'FAMILY', status: 'ACTIVE', consent: true, advanceRupees: 0, paidMonths: 5, partialRupees: 200 },
    { id: 'mem-0009', code: 'MAA-0009', name: 'Kaushik Majumdar', mobile: '9830112208', area: 'Hatibagan', chandaRupees: 500, cat: 'YOUTH', status: 'ACTIVE', consent: true, advanceRupees: 0, paidMonths: 6 },
    { id: 'mem-0010', code: 'MAA-0010', name: 'Arindam Sarkar', mobile: '9830112209', area: 'Kumartuli', chandaRupees: 500, cat: 'GENERAL', status: 'ACTIVE', consent: true, advanceRupees: 0, paidMonths: 2 },
    { id: 'mem-0011', code: 'MAA-0011', name: 'Rupa Dutta', mobile: '9830112210', area: 'Bagbazar', chandaRupees: 400, cat: 'SENIOR', status: 'ACTIVE', consent: true, advanceRupees: 0, paidMonths: 6 },
    { id: 'mem-0012', code: 'MAA-0012', name: 'Biswajit Roy', mobile: '9830112211', area: 'Sovabazar', chandaRupees: 1500, cat: 'PATRON', status: 'ACTIVE', consent: true, advanceRupees: 500, paidMonths: 6 },
    { id: 'mem-0013', code: 'MAA-0013', name: 'Partha Sarathi Paul', mobile: '9830112212', area: 'Shyambazar', chandaRupees: 500, cat: 'GENERAL', status: 'ACTIVE', consent: true, advanceRupees: 0, paidMonths: 4, partialRupees: 250 },
    { id: 'mem-0014', code: 'MAA-0014', name: 'Sanchita Nandi', mobile: '9830112213', area: 'Hatibagan', chandaRupees: 500, cat: 'YOUTH', status: 'ACTIVE', consent: true, advanceRupees: 0, paidMonths: 5 },
    { id: 'mem-0015', code: 'MAA-0015', name: 'Gautam Saha', mobile: '9830112214', area: 'Bagbazar', chandaRupees: 500, cat: 'GENERAL', status: 'ACTIVE', consent: false, advanceRupees: 0, paidMonths: 3 },
    { id: 'mem-0016', code: 'MAA-0016', name: 'Indrani Mitra', mobile: '9830112215', area: 'Kumartuli', chandaRupees: 800, cat: 'FAMILY', status: 'ACTIVE', consent: true, advanceRupees: 0, paidMonths: 6 },
    { id: 'mem-0017', code: 'MAA-0017', name: 'Joydeep Halder', mobile: '9830112216', area: 'Sovabazar', chandaRupees: 500, cat: 'YOUTH', status: 'ACTIVE', consent: true, advanceRupees: 0, paidMonths: 5 },
    { id: 'mem-0018', code: 'MAA-0018', name: 'Nirmalendu Kar', mobile: '9830112217', area: 'Bagbazar', chandaRupees: 300, cat: 'SENIOR', status: 'INACTIVE', consent: false, advanceRupees: 0, paidMonths: 2 },
    { id: 'mem-0019', code: 'MAA-0019', name: 'Satyajit Kundu', mobile: '9830112218', area: 'Shyambazar', chandaRupees: 500, cat: 'GENERAL', status: 'ACTIVE', consent: true, advanceRupees: 0, paidMonths: 6 },
    { id: 'mem-0020', code: 'MAA-0020', name: 'Poulomi Ganguly', mobile: '9830112219', area: 'Hatibagan', chandaRupees: 1000, cat: 'PATRON', status: 'ACTIVE', consent: true, advanceRupees: 0, paidMonths: 5, partialRupees: 500 },
    { id: 'mem-0021', code: 'MAA-0021', name: 'Subrata Biswas', mobile: '9830112220', area: 'Kumartuli', chandaRupees: 500, cat: 'GENERAL', status: 'ACTIVE', consent: true, advanceRupees: 0, paidMonths: 4 },
    { id: 'mem-0022', code: 'MAA-0022', name: 'Tapasi Mondal', mobile: '9830112221', area: 'Bagbazar', chandaRupees: 500, cat: 'FAMILY', status: 'ACTIVE', consent: true, advanceRupees: 0, paidMonths: 6 },
  ];

  const members: Member[] = rawMembers.map((rm, idx) => ({
    id: rm.id,
    memberCode: rm.code,
    fullName: rm.name,
    mobile: rm.mobile,
    whatsappNumber: rm.mobile,
    address: `${12 + idx} ${rm.area} Lane, Kolkata`,
    area: rm.area,
    joiningDate: '2026-06-01',
    monthlyChandaPaise: rm.chandaRupees * 100,
    category: rm.cat,
    status: rm.status,
    whatsappConsent: rm.consent,
    notes: rm.consent ? 'WhatsApp receipts opted-in' : 'Prefers printed receipt',
    assignedCollectorUid: idx % 2 === 0 ? 'demo-collector-1' : 'demo-super-admin',
    assignedCollectorName: idx % 2 === 0 ? 'Anirban Chatterjee' : 'Subhajit Roy',
    advanceBalancePaise: rm.advanceRupees * 100,
    userUid: rm.userUid,
    createdBy: 'demo-super-admin',
    createdAt: '2026-06-01T09:00:00.000Z',
    updatedAt: nowIso,
  }));

  const ledgers: MemberLedger[] = [];
  const payments: Payment[] = [];
  const receipts: Receipt[] = [];
  let rcpCounter = 1;

  rawMembers.forEach((rm, mIdx) => {
    const duePaise = rm.chandaRupees * 100;
    const collectorUid = mIdx % 2 === 0 ? 'demo-collector-1' : 'demo-super-admin';
    const collectorName = mIdx % 2 === 0 ? 'Anirban Chatterjee' : 'Subhajit Roy';
    const methods: Payment['paymentMethod'][] = ['UPI', 'CASH', 'BANK_TRANSFER', 'UPI'];

    monthKeys.forEach((mk, monthIdx) => {
      let paidPaise = 0;
      if (monthIdx < rm.paidMonths) {
        paidPaise = duePaise;
      } else if (monthIdx === rm.paidMonths && rm.partialRupees) {
        paidPaise = rm.partialRupees * 100;
      }

      ledgers.push({
        id: `${rm.id}_${mk}`,
        memberId: rm.id,
        memberCode: rm.code,
        memberUserUid: rm.userUid,
        monthKey: mk,
        duePaise,
        paidPaise,
        status: deriveLedgerStatus(duePaise, paidPaise),
        updatedAt: `${mk}-15T12:00:00.000Z`,
      });

      if (paidPaise > 0) {
        const isLastPaidMonth = monthIdx === rm.paidMonths - 1 && rm.advanceRupees > 0;
        const totalTxPaise = paidPaise + (isLastPaidMonth ? rm.advanceRupees * 100 : 0);
        const day = String(Math.min(25, 5 + (mIdx % 15))).padStart(2, '0');
        const payDate = `${mk}-${day}`;
        const rcpNo = `MAA-RCP-${mk.replace('-', '')}-${String(rcpCounter++).padStart(4, '0')}`;
        const payId = `pay-${rm.id}-${mk}`;
        const method = methods[(mIdx + monthIdx) % methods.length];

        payments.push({
          id: payId,
          transactionId: `TXN-${mk.replace('-', '')}-${String(rcpCounter).padStart(5, '0')}`,
          receiptNumber: rcpNo,
          memberId: rm.id,
          memberCode: rm.code,
          memberName: rm.name,
          memberUserUid: rm.userUid,
          monthKey: mk,
          amountPaise: totalTxPaise,
          paymentDate: payDate,
          paymentMethod: method,
          transactionRef: method === 'UPI' ? `UPI${4029100 + rcpCounter}` : method === 'BANK_TRANSFER' ? `NEFT${88210 + rcpCounter}` : '',
          collectedByUid: collectorUid,
          collectedByName: collectorName,
          allocationMode: isLastPaidMonth ? 'MANUAL' : 'AUTO_OLDEST',
          allocations: [{ monthKey: mk, allocatedPaise: paidPaise }],
          advanceAddedPaise: isLastPaidMonth ? rm.advanceRupees * 100 : 0,
          previousDuePaise: duePaise,
          remainingDuePaise: Math.max(0, duePaise - paidPaise),
          status: 'COMPLETED',
          notes: isLastPaidMonth ? 'Includes advance contribution' : '',
          createdBy: collectorUid,
          createdAt: `${payDate}T11:30:00.000Z`,
          updatedAt: `${payDate}T11:30:00.000Z`,
        });

        receipts.push({
          id: `rcp-${payId}`,
          receiptNumber: rcpNo,
          paymentId: payId,
          memberId: rm.id,
          memberCode: rm.code,
          memberName: rm.name,
          memberUserUid: rm.userUid,
          mobile: rm.mobile,
          monthKey: mk,
          amountPaise: totalTxPaise,
          paymentDate: payDate,
          paymentMethod: method,
          transactionRef: method === 'UPI' ? `UPI${4029100 + rcpCounter}` : '',
          previousDuePaise: duePaise,
          remainingDuePaise: Math.max(0, duePaise - paidPaise),
          advanceBalancePaise: isLastPaidMonth ? rm.advanceRupees * 100 : 0,
          collectorName,
          status: 'ACTIVE',
          createdBy: collectorUid,
          createdAt: `${payDate}T11:30:00.000Z`,
        });
      }
    });
  });

  // Add one reversed sample payment for audit demonstration
  payments.push({
    id: 'pay-reversed-demo',
    transactionId: 'TXN-REV-00099',
    receiptNumber: 'MAA-RCP-202610-9999',
    memberId: 'mem-0005',
    memberCode: 'MAA-0005',
    memberName: 'Pradip Kumar Ghosh',
    monthKey: '2026-10',
    amountPaise: 50000,
    paymentDate: '2026-10-12',
    paymentMethod: 'UPI',
    transactionRef: 'UPI99900112',
    collectedByUid: 'demo-collector-1',
    collectedByName: 'Anirban Chatterjee',
    allocationMode: 'MANUAL',
    allocations: [{ monthKey: '2026-10', allocatedPaise: 50000 }],
    advanceAddedPaise: 0,
    previousDuePaise: 50000,
    remainingDuePaise: 0,
    status: 'REVERSED',
    reversalReason: 'Duplicate UPI entry verified against bank statement',
    reversedBy: 'demo-super-admin',
    notes: 'Reversed with full audit trail',
    createdBy: 'demo-collector-1',
    createdAt: '2026-10-12T10:00:00.000Z',
    updatedAt: '2026-10-13T09:15:00.000Z',
  });

  const expenses: Expense[] = [
    {
      id: 'exp-0001',
      expenseCode: 'EXP-0001',
      expenseDate: '2026-09-20',
      category: 'IDOL',
      description: 'Shyama Puja Protima Booking Advance (Maa Shyama Idol)',
      amountPaise: 1800000, // ₹18,000
      vendorName: 'Kumartuli Shilpalaya (P. Pal)',
      paymentMethod: 'BANK_TRANSFER',
      attachmentName: 'kumartuli_advance_bill.pdf',
      addedByUid: 'demo-super-admin',
      addedByName: 'Subhajit Roy',
      notes: 'First installment for idol making',
      status: 'ACTIVE',
      createdBy: 'demo-super-admin',
      createdAt: '2026-09-20T14:00:00.000Z',
      updatedAt: '2026-09-20T14:00:00.000Z',
    },
    {
      id: 'exp-0002',
      expenseCode: 'EXP-0002',
      expenseDate: '2026-10-08',
      category: 'PUJA_DECORATION',
      description: 'Pandal Bamboo & Cloth Structure Advance',
      amountPaise: 1250000, // ₹12,500
      vendorName: 'Shyamnagar Decorators',
      paymentMethod: 'UPI',
      addedByUid: 'demo-collector-1',
      addedByName: 'Anirban Chatterjee',
      status: 'ACTIVE',
      createdBy: 'demo-collector-1',
      createdAt: '2026-10-08T16:30:00.000Z',
      updatedAt: '2026-10-08T16:30:00.000Z',
    },
    {
      id: 'exp-0003',
      expenseCode: 'EXP-0003',
      expenseDate: '2026-10-14',
      category: 'LIGHTING',
      description: 'Chandannagar Gate & Mandap Illumination',
      amountPaise: 650000, // ₹6,500
      vendorName: 'Alo Enterprise',
      paymentMethod: 'CASH',
      addedByUid: 'demo-super-admin',
      addedByName: 'Subhajit Roy',
      status: 'ACTIVE',
      createdBy: 'demo-super-admin',
      createdAt: '2026-10-14T18:00:00.000Z',
      updatedAt: '2026-10-14T18:00:00.000Z',
    },
    {
      id: 'exp-0004',
      expenseCode: 'EXP-0004',
      expenseDate: '2026-10-16',
      category: 'FLOWERS',
      description: '108 Padma (Lotus) & Marigold Garlands',
      amountPaise: 320000, // ₹3,200
      vendorName: 'Mallick Ghat Flower Mart',
      paymentMethod: 'CASH',
      addedByUid: 'demo-collector-1',
      addedByName: 'Anirban Chatterjee',
      status: 'ACTIVE',
      createdBy: 'demo-collector-1',
      createdAt: '2026-10-16T07:30:00.000Z',
      updatedAt: '2026-10-16T07:30:00.000Z',
    },
    {
      id: 'exp-0005',
      expenseCode: 'EXP-0005',
      expenseDate: '2026-10-18',
      category: 'PRASAD',
      description: 'Ashtami Anjali Bhog & Sandesh Prasad',
      amountPaise: 780000, // ₹7,800
      vendorName: 'Girish Mistanna Bhandar',
      paymentMethod: 'UPI',
      addedByUid: 'demo-super-admin',
      addedByName: 'Subhajit Roy',
      status: 'ACTIVE',
      createdBy: 'demo-super-admin',
      createdAt: '2026-10-18T10:20:00.000Z',
      updatedAt: '2026-10-18T10:20:00.000Z',
    },
    {
      id: 'exp-0006',
      expenseCode: 'EXP-0006',
      expenseDate: '2026-11-02',
      category: 'SOUND_SYSTEM',
      description: 'Cultural Evening PA & Dhaki Honorarium',
      amountPaise: 450000, // ₹4,500
      vendorName: 'Taranga Audio',
      paymentMethod: 'BANK_TRANSFER',
      addedByUid: 'demo-super-admin',
      addedByName: 'Subhajit Roy',
      status: 'ACTIVE',
      createdBy: 'demo-super-admin',
      createdAt: '2026-11-02T15:00:00.000Z',
      updatedAt: '2026-11-02T15:00:00.000Z',
    },
    {
      id: 'exp-0007',
      expenseCode: 'EXP-0007',
      expenseDate: '2026-11-10',
      category: 'ELECTRICITY',
      description: 'CESC Temporary Puja Connection Settlement',
      amountPaise: 240000, // ₹2,400
      vendorName: 'CESC Ltd',
      paymentMethod: 'UPI',
      addedByUid: 'demo-collector-1',
      addedByName: 'Anirban Chatterjee',
      status: 'ACTIVE',
      createdBy: 'demo-collector-1',
      createdAt: '2026-11-10T12:15:00.000Z',
      updatedAt: '2026-11-10T12:15:00.000Z',
    },
  ];

  const whatsappNotifications: WhatsappNotification[] = [
    {
      id: 'wa-demo-1',
      notificationId: 'notif-demo-001',
      memberId: 'mem-0001',
      memberName: 'Rahul Das',
      recipientPhone: '+919831098765',
      type: 'RECEIPT',
      templateName: 'maa_chanda_receipt_bn',
      language: 'bn',
      messageBody: `নমস্কার Rahul Das, আপনার নভেম্বর ২০২৬ মাসের পুজোর চাঁদা সফলভাবে জমা হয়েছে। জমার পরিমাণ: ${formatINR(70000)} জমার তারিখ: ${formatDateIN('2026-11-05')}`,
      metaMessageId: 'wamid.DEMO_SAMPLE_001',
      status: 'READ',
      sentByUid: 'demo-collector-1',
      createdAt: '2026-11-05T11:31:00.000Z',
      updatedAt: '2026-11-05T11:35:00.000Z',
    },
    {
      id: 'wa-demo-2',
      notificationId: 'notif-demo-002',
      memberId: 'mem-0002',
      memberName: 'Soumyadeep Mukherjee',
      recipientPhone: '+919830112201',
      type: 'RECEIPT',
      templateName: 'maa_chanda_receipt_bn',
      language: 'bn',
      messageBody: 'নমস্কার Soumyadeep Mukherjee, আপনার নভেম্বর ২০২৬ মাসের পুজোর চাঁদা সফলভাবে জমা হয়েছে।',
      metaMessageId: 'wamid.DEMO_SAMPLE_002',
      status: 'DELIVERED',
      sentByUid: 'demo-super-admin',
      createdAt: '2026-11-06T11:31:00.000Z',
      updatedAt: '2026-11-06T11:32:00.000Z',
    },
    {
      id: 'wa-demo-3',
      notificationId: 'notif-demo-003',
      memberId: 'mem-0005',
      memberName: 'Pradip Kumar Ghosh',
      recipientPhone: '+919830112204',
      type: 'REMINDER',
      templateName: 'maa_chanda_reminder_bn',
      language: 'bn',
      messageBody: 'নমস্কার Pradip Kumar Ghosh, আপনার বকেয়া পুজোর চাঁদা ₹1,000 অনুগ্রহ করে জমা দিন।',
      metaMessageId: 'wamid.DEMO_SAMPLE_003',
      status: 'SENT',
      sentByUid: 'demo-collector-1',
      createdAt: '2026-11-12T10:00:00.000Z',
      updatedAt: '2026-11-12T10:00:05.000Z',
    },
    {
      id: 'wa-demo-4',
      notificationId: 'notif-demo-004',
      memberId: 'mem-0010',
      memberName: 'Arindam Sarkar',
      recipientPhone: '+919830112209',
      type: 'REMINDER',
      templateName: 'maa_chanda_reminder_bn',
      language: 'bn',
      messageBody: 'নমস্কার Arindam Sarkar, আপনার বকেয়া পুজোর চাঁদা ₹2,000 অনুগ্রহ করে জমা দিন।',
      status: 'FAILED',
      errorMessage: 'Sample failure: WHATSAPP_ACCESS_TOKEN not configured or recipient unreachable.',
      sentByUid: 'demo-super-admin',
      createdAt: '2026-11-14T15:00:00.000Z',
      updatedAt: '2026-11-14T15:00:02.000Z',
    },
    {
      id: 'wa-demo-5',
      notificationId: 'notif-demo-005',
      memberId: 'mem-0013',
      memberName: 'Partha Sarathi Paul',
      recipientPhone: '+919830112212',
      type: 'REMINDER',
      templateName: 'maa_chanda_reminder_bn',
      language: 'bn',
      messageBody: 'নমস্কার Partha Sarathi Paul, আপনার বকেয়া পুজোর চাঁদা ₹750 অনুগ্রহ করে জমা দিন।',
      status: 'QUEUED',
      sentByUid: 'demo-collector-1',
      createdAt: '2026-11-18T08:00:00.000Z',
      updatedAt: '2026-11-18T08:00:00.000Z',
    },
  ];

  const announcements: Announcement[] = [
    {
      id: 'ann-1',
      titleBn: 'মাসিক কার্যকরী সমিতির সাধারণ সভা ও হিসাব পর্যালোচনা',
      titleEn: 'Monthly Executive Committee Meeting & Accounts Review',
      bodyBn: 'সকল সদস্যকে জানানো যাচ্ছে যে আগামী ২২-১১-২০২৬ রবিবার সন্ধ্যা ৬:৩০ মিনিটে মণ্ডপ প্রাঙ্গণে মাসিক হিসাব ও আগামী বর্ষের পুজো প্রস্তুতি সভা অনুষ্ঠিত হবে। সকলের উপস্থিতি একান্ত কাম্য।',
      bodyEn: 'All committee members are requested to attend the monthly financial review and next year Puja planning meeting on Sunday, 22-11-2026 at 6:30 PM at the Mandap premises.',
      category: 'MEETING_NOTICE',
      publishDate: '2026-11-15',
      status: 'PUBLISHED',
      createdBy: 'demo-super-admin',
      createdAt: '2026-11-15T10:00:00.000Z',
      updatedAt: '2026-11-15T10:00:00.000Z',
    },
    {
      id: 'ann-2',
      titleBn: 'নভেম্বর ২০২৬ মাসের চাঁদা সংগ্রহের শেষ তারিখ',
      titleEn: 'Collection Deadline for November 2026 Chanda',
      bodyBn: 'নভেম্বর মাসের নির্ধারিত মাসিক চাঁদা ২৫-১১-২০২৬ তারিখের মধ্যে জমা দিয়ে ডিজিটাল রসিদ সংগ্রহ করার জন্য অনুরোধ করা হচ্ছে।',
      bodyEn: 'Members are kindly requested to clear November 2026 monthly chanda by 25-11-2026 and collect their official digital receipts.',
      category: 'COLLECTION_UPDATE',
      publishDate: '2026-11-10',
      status: 'PUBLISHED',
      createdBy: 'demo-collector-1',
      createdAt: '2026-11-10T09:00:00.000Z',
      updatedAt: '2026-11-10T09:00:00.000Z',
    },
    {
      id: 'ann-3',
      titleBn: 'বিজয়া সম্মিলনী ও সাংস্কৃতিক অনুষ্ঠান',
      titleEn: 'Bijoya Sammilani & Cultural Evening',
      bodyBn: 'আগামী শনিবার সন্ধ্যা ৭টায় আমাদের পাড়ার শিশু ও শিল্পীদের নিয়ে বিজয়া সম্মিলনী ও সাংস্কৃতিক অনুষ্ঠান আয়োজিত হয়েছে।',
      bodyEn: 'Join us with your family this Saturday at 7:00 PM for our annual Bijoya Sammilani and cultural program.',
      category: 'CULTURAL_PROGRAM',
      publishDate: '2026-11-01',
      status: 'PUBLISHED',
      createdBy: 'demo-super-admin',
      createdAt: '2026-11-01T12:00:00.000Z',
      updatedAt: '2026-11-01T12:00:00.000Z',
    },
  ];

  const auditLogs: AuditLog[] = [
    {
      id: 'aud-1',
      userId: 'demo-super-admin',
      userName: 'Subhajit Roy',
      userRole: 'SUPER_ADMIN',
      action: 'REVERSE_PAYMENT',
      entityType: 'Payment',
      recordId: 'pay-reversed-demo',
      previousValue: 'status: COMPLETED, amount: ₹500',
      newValue: 'status: REVERSED (Duplicate UPI entry verified)',
      createdAt: '2026-10-13T09:15:00.000Z',
    },
    {
      id: 'aud-2',
      userId: 'demo-collector-1',
      userName: 'Anirban Chatterjee',
      userRole: 'COLLECTION_ADMIN',
      action: 'ADD_EXPENSE',
      entityType: 'Expense',
      recordId: 'EXP-0007',
      previousValue: '—',
      newValue: 'CESC Temporary Puja Connection Settlement (₹2,400)',
      createdAt: '2026-11-10T12:15:00.000Z',
    },
    {
      id: 'aud-3',
      userId: 'demo-super-admin',
      userName: 'Subhajit Roy',
      userRole: 'SUPER_ADMIN',
      action: 'PUBLISH_ANNOUNCEMENT',
      entityType: 'Announcement',
      recordId: 'ann-1',
      previousValue: '—',
      newValue: 'Monthly Executive Committee Meeting & Accounts Review',
      createdAt: '2026-11-15T10:00:00.000Z',
    },
  ];

  return {
    users,
    settings,
    collectionMonths,
    members,
    ledgers,
    payments,
    receipts,
    expenses,
    whatsappNotifications,
    announcements,
    auditLogs,
  };
}

export function buildFreshCommitteeDataset(options?: { ledgerResetAt?: string }) {
  const nowIso = new Date().toISOString();
  const currentMonthKey = getCurrentISTDateISO().slice(0, 7);
  const yearNum = Number(currentMonthKey.slice(0, 4)) || 2026;
  const monthNum = Number(currentMonthKey.slice(5, 7)) || 11;
  const fyStart = monthNum >= 4 ? yearNum : yearNum - 1;
  const financialYear = `${fyStart}-${String((fyStart + 1) % 100).padStart(2, '0')}`;

  const settings: CommitteeSettings = {
    id: 'committee',
    committeeName: 'শ্রী শ্রী শ্যামা পূজা মাশুন্ডা বুনিয়াদি স্কুল মাঠ কমিটি',
    committeeAddress: 'মাশুন্ডা বুনিয়াদি স্কুল মাঠ (Mashunda Buniyadi School Math)',
    contactNumber: '',
    email: '',
    pujaYear: `${fyStart}-${fyStart + 1}`,
    defaultMonthlyChandaPaise: 50000, // ₹500
    financialYear,
    dueDay: 10,
    whatsappEnabled: true,
    whatsappPhoneNumberId: '',
    whatsappBusinessAccountId: '',
    whatsappApiVersion: 'v21.0',
    whatsappReceiptTemplate: 'maa_chanda_receipt_bn',
    whatsappReminderTemplate: 'maa_chanda_reminder_bn',
    whatsappAnnouncementTemplate: 'maa_puja_announcement_bn',
    whatsappDefaultLanguage: 'bn',
    defaultLanguage: 'bn',
    theme: 'light',
    ledgerResetAt: options?.ledgerResetAt || nowIso,
    updatedBy: 'committee-super-admin',
    updatedAt: nowIso,
  };

  const collectionMonths: CollectionMonth[] = [
    {
      id: currentMonthKey,
      monthKey: currentMonthKey,
      label: formatMonthLabel(currentMonthKey, 'en'),
      financialYear,
      defaultAmountPaise: settings.defaultMonthlyChandaPaise,
      dueDate: `${currentMonthKey}-10`,
      status: 'OPEN',
      createdBy: 'committee-super-admin',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  return {
    users: [] as AppUser[],
    settings,
    collectionMonths,
    members: [] as Member[],
    ledgers: [] as MemberLedger[],
    payments: [] as Payment[],
    receipts: [] as Receipt[],
    expenses: [] as Expense[],
    whatsappNotifications: [] as WhatsappNotification[],
    announcements: [] as Announcement[],
    auditLogs: [] as AuditLog[],
  };
}


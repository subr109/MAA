import {
  AllocationMode,
  CollectionMonth,
  Expense,
  Language,
  LedgerStatus,
  Member,
  MemberLedger,
  Payment,
  PaymentAllocationItem,
  PaymentMethod,
  Receipt,
} from '../types/maa';

/**
 * Formats integer paise into Indian Rupees (INR) using Indian numbering system.
 * Always avoids floating-point drift by keeping math in integer paise.
 */
export function formatINR(paise: number, showDecimals = false): string {
  const safePaise = Math.round(Number.isFinite(paise) ? paise : 0);
  const rupees = safePaise / 100;
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: showDecimals || safePaise % 100 !== 0 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(rupees);
  return `₹${formatted}`;
}

export function rupeesToPaise(rupees: number | string): number {
  const parsed = typeof rupees === 'string' ? parseFloat(rupees) : rupees;
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

export function paiseToRupees(paise: number): number {
  return Math.round(paise) / 100;
}

/**
 * Formats YYYY-MM-DD or ISO timestamp into Indian DD-MM-YYYY in Asia/Kolkata timezone.
 */
export function formatDateIN(input?: string | null): string {
  if (!input) return '—';
  // Fast-path YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split('-');
    return `${d}-${m}-${y}`;
  }
  const dt = new Date(input);
  if (Number.isNaN(dt.getTime())) return input;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(dt);
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const year = parts.find((p) => p.type === 'year')?.value ?? '2026';
  return `${day}-${month}-${year}`;
}

export function formatDateTimeIN(input?: string | null): string {
  if (!input) return '—';
  const dt = new Date(input);
  if (Number.isNaN(dt.getTime())) return input;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
    .format(dt)
    .replace(/\//g, '-');
}

export function getCurrentISTDateISO(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value ?? '2026';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

export function formatMonthLabel(monthKey: string, lang: Language = 'en'): string {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return monthKey;
  const [y, m] = monthKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, 1));
  return new Intl.DateTimeFormat(lang === 'bn' ? 'bn-IN' : 'en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(dt);
}

export function normalizeMobile(mobile: string): string {
  const digits = mobile.replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) {
    return digits.slice(-10);
  }
  if (digits.length > 10 && digits.startsWith('0')) {
    return digits.slice(-10);
  }
  return digits;
}

export function findDuplicateMobile(
  members: Member[],
  mobile: string,
  excludeMemberId?: string
): Member | undefined {
  const target = normalizeMobile(mobile);
  if (target.length < 10) return undefined;
  return members.find(
    (m) =>
      m.id !== excludeMemberId &&
      m.status !== 'ARCHIVED' &&
      normalizeMobile(m.mobile) === target
  );
}

export function generateNextMemberCode(members: Member[]): string {
  let maxNum = 0;
  for (const m of members) {
    const match = /^MAA-(\d+)$/.exec(m.memberCode);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  return `MAA-${String(maxNum + 1).padStart(4, '0')}`;
}

export function generateReceiptNumber(receipts: Receipt[], dateStr?: string): string {
  const datePart = (dateStr || getCurrentISTDateISO()).slice(0, 7).replace('-', '');
  const prefix = `MAA-RCP-${datePart}-`;
  let maxSeq = 0;
  for (const r of receipts) {
    if (r.receiptNumber.startsWith(prefix)) {
      const seq = parseInt(r.receiptNumber.slice(prefix.length), 10);
      if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq;
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
}

export function generateExpenseCode(expenses: Expense[]): string {
  let maxNum = 0;
  for (const e of expenses) {
    const match = /^EXP-(\d+)$/.exec(e.expenseCode);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  return `EXP-${String(maxNum + 1).padStart(4, '0')}`;
}

export interface AllocationInput {
  amountPaise: number;
  allocationMode: AllocationMode;
  selectedMonthKey: string;
  memberLedgers: MemberLedger[];
  collectionMonths: CollectionMonth[];
  currentAdvancePaise: number;
  defaultMemberMonthlyPaise: number;
}

export interface AllocationResult {
  allocations: PaymentAllocationItem[];
  updatedLedgers: MemberLedger[];
  advanceAddedPaise: number;
  newAdvanceBalancePaise: number;
  previousDuePaise: number;
  remainingDuePaise: number;
}

/**
 * Pure deterministic payment allocation engine (integer paise only).
 * Supports:
 * - AUTO_OLDEST: Pays oldest pending months first, then future open months if excess exists, or adds to advance if no open months remain.
 * - MANUAL: Applies to selectedMonthKey first; any excess goes strictly to advanceBalancePaise.
 * - ADVANCE: Credits directly into advanceBalancePaise (or selected month if due).
 */
export function calculatePaymentAllocation(input: AllocationInput): AllocationResult {
  const {
    amountPaise,
    allocationMode,
    selectedMonthKey,
    memberLedgers,
    collectionMonths,
    currentAdvancePaise,
    defaultMemberMonthlyPaise,
  } = input;

  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    throw new Error('Payment amount must be a positive integer in paise.');
  }

  const sortedMonths = [...collectionMonths].sort((a, b) =>
    a.monthKey.localeCompare(b.monthKey)
  );

  // Clone ledgers indexed by monthKey
  const ledgerMap = new Map<string, MemberLedger>();
  for (const l of memberLedgers) {
    ledgerMap.set(l.monthKey, { ...l });
  }

  // Ensure selectedMonthKey exists in ledgerMap
  if (!ledgerMap.has(selectedMonthKey) && memberLedgers.length > 0) {
    const sample = memberLedgers[0];
    ledgerMap.set(selectedMonthKey, {
      id: `${sample.memberId}_${selectedMonthKey}`,
      memberId: sample.memberId,
      memberCode: sample.memberCode,
      memberUserUid: sample.memberUserUid,
      monthKey: selectedMonthKey,
      duePaise: defaultMemberMonthlyPaise,
      paidPaise: 0,
      status: defaultMemberMonthlyPaise === 0 ? 'PAID' : 'UNPAID',
      updatedAt: new Date().toISOString(),
    });
  }

  // Calculate previous total outstanding across all existing ledgers
  let previousDuePaise = 0;
  for (const l of ledgerMap.values()) {
    previousDuePaise += Math.max(0, l.duePaise - l.paidPaise);
  }

  let remainingToAllocate = amountPaise;
  const allocations: PaymentAllocationItem[] = [];
  let advanceAddedPaise = 0;

  const applyToLedger = (ledger: MemberLedger, maxAmount: number): number => {
    const outstanding = Math.max(0, ledger.duePaise - ledger.paidPaise);
    if (outstanding <= 0 || maxAmount <= 0) return 0;
    const credit = Math.min(outstanding, maxAmount);
    ledger.paidPaise += credit;
    ledger.status =
      ledger.paidPaise >= ledger.duePaise
        ? 'PAID'
        : ledger.paidPaise > 0
        ? 'PARTIAL'
        : 'UNPAID';
    ledger.updatedAt = new Date().toISOString();
    allocations.push({ monthKey: ledger.monthKey, allocatedPaise: credit });
    return credit;
  };

  if (allocationMode === 'AUTO_OLDEST') {
    const orderedKeys = Array.from(
      new Set([...sortedMonths.map((m) => m.monthKey), ...Array.from(ledgerMap.keys())])
    ).sort();

    for (const mk of orderedKeys) {
      if (remainingToAllocate <= 0) break;
      const ledger = ledgerMap.get(mk);
      if (ledger) {
        const credited = applyToLedger(ledger, remainingToAllocate);
        remainingToAllocate -= credited;
      }
    }

    // If excess remains after covering all existing open ledgers, create/cover next consecutive month(s) or store as advance
    // Wait: per Section 6: if Rahul has Jan/Feb/Mar ledgers of Rs 500 and pays Rs 1000 in Jan -> Jan & Feb covered!
    // If all existing months are covered and excess remains, store in advanceBalancePaise.
    if (remainingToAllocate > 0) {
      advanceAddedPaise = remainingToAllocate;
      remainingToAllocate = 0;
    }
  } else if (allocationMode === 'MANUAL') {
    const target = ledgerMap.get(selectedMonthKey);
    if (target) {
      const credited = applyToLedger(target, remainingToAllocate);
      remainingToAllocate -= credited;
    }
    if (remainingToAllocate > 0) {
      advanceAddedPaise = remainingToAllocate;
      remainingToAllocate = 0;
    }
  } else {
    // ADVANCE mode: store entire amount as advance balance
    advanceAddedPaise = remainingToAllocate;
    remainingToAllocate = 0;
  }

  let remainingDuePaise = 0;
  for (const l of ledgerMap.values()) {
    remainingDuePaise += Math.max(0, l.duePaise - l.paidPaise);
  }

  return {
    allocations,
    updatedLedgers: Array.from(ledgerMap.values()).sort((a, b) =>
      a.monthKey.localeCompare(b.monthKey)
    ),
    advanceAddedPaise,
    newAdvanceBalancePaise: currentAdvancePaise + advanceAddedPaise,
    previousDuePaise,
    remainingDuePaise,
  };
}

export function isDuplicateTransaction(
  payments: Payment[],
  transactionId: string,
  memberId: string,
  amountPaise: number,
  paymentMethod: PaymentMethod,
  transactionRef?: string
): boolean {
  if (payments.some((p) => p.transactionId === transactionId)) {
    return true;
  }
  if (transactionRef && transactionRef.trim().length > 0) {
    const refNorm = transactionRef.trim().toLowerCase();
    const refMatch = payments.some(
      (p) =>
        p.status === 'COMPLETED' &&
        p.paymentMethod === paymentMethod &&
        (p.transactionRef || '').trim().toLowerCase() === refNorm
    );
    if (refMatch) return true;
  }
  // Guard rapid accidental double-click within 60 seconds for same member + amount
  const nowMs = Date.now();
  return payments.some(
    (p) =>
      p.status === 'COMPLETED' &&
      p.memberId === memberId &&
      p.amountPaise === amountPaise &&
      p.paymentMethod === paymentMethod &&
      nowMs - new Date(p.createdAt).getTime() < 60_000
  );
}

export interface MemberFinancialSummary {
  totalDuePaise: number;
  totalPaidPaise: number;
  totalOutstandingPaise: number;
  advanceBalancePaise: number;
  pendingMonthsCount: number;
  pendingMonthKeys: string[];
  lastPaymentDate: string | null;
}

export function computeMemberFinancialSummary(
  member: Member,
  allLedgers: MemberLedger[],
  allPayments: Payment[]
): MemberFinancialSummary {
  const memberLedgers = allLedgers.filter((l) => l.memberId === member.id);
  let totalDuePaise = 0;
  let totalPaidPaise = 0;
  const pendingMonthKeys: string[] = [];

  for (const l of memberLedgers) {
    totalDuePaise += l.duePaise;
    totalPaidPaise += l.paidPaise;
    if (l.duePaise > l.paidPaise) {
      pendingMonthKeys.push(l.monthKey);
    }
  }

  const completedPayments = allPayments
    .filter((p) => p.memberId === member.id && p.status === 'COMPLETED')
    .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));

  return {
    totalDuePaise,
    totalPaidPaise,
    totalOutstandingPaise: Math.max(0, totalDuePaise - totalPaidPaise),
    advanceBalancePaise: member.advanceBalancePaise || 0,
    pendingMonthsCount: pendingMonthKeys.length,
    pendingMonthKeys: pendingMonthKeys.sort(),
    lastPaymentDate: completedPayments[0]?.paymentDate ?? null,
  };
}

export interface DashboardStats {
  totalRegisteredMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  monthlyExpectedPaise: number;
  thisMonthCollectionPaise: number;
  totalPendingPaise: number;
  fullyPaidMembers: number;
  partiallyPaidMembers: number;
  unpaidMembers: number;
  totalAdvancePaise: number;
  totalRecordedCollectionPaise: number;
  totalPujaExpensesPaise: number;
  availableBalancePaise: number;
  monthlySeries: {
    monthKey: string;
    label: string;
    expectedPaise: number;
    collectedPaise: number;
    expensePaise: number;
  }[];
}

export function computeDashboardStats(params: {
  members: Member[];
  collectionMonths: CollectionMonth[];
  ledgers: MemberLedger[];
  payments: Payment[];
  expenses: Expense[];
  selectedMonthKey: string;
  lang: Language;
}): DashboardStats {
  const { members, collectionMonths, ledgers, payments, expenses, selectedMonthKey, lang } = params;

  const nonArchivedMembers = members.filter((m) => m.status !== 'ARCHIVED');
  const activeMembersList = nonArchivedMembers.filter((m) => m.status === 'ACTIVE');
  const inactiveMembersList = nonArchivedMembers.filter((m) => m.status === 'INACTIVE');

  const monthLedgers = ledgers.filter((l) => l.monthKey === selectedMonthKey);
  const monthlyExpectedFromLedgers = monthLedgers.reduce((acc, l) => acc + l.duePaise, 0);
  const monthlyExpectedPaise =
    monthlyExpectedFromLedgers > 0
      ? monthlyExpectedFromLedgers
      : activeMembersList.reduce((acc, m) => acc + m.monthlyChandaPaise, 0);

  const completedPayments = payments.filter((p) => p.status === 'COMPLETED');
  const thisMonthCollectionPaise = completedPayments
    .filter((p) => p.paymentDate.startsWith(selectedMonthKey) || p.monthKey === selectedMonthKey)
    .reduce((acc, p) => acc + p.amountPaise, 0);

  const totalPendingPaise = ledgers.reduce(
    (acc, l) => acc + Math.max(0, l.duePaise - l.paidPaise),
    0
  );

  let fullyPaidMembers = 0;
  let partiallyPaidMembers = 0;
  let unpaidMembers = 0;

  for (const m of activeMembersList) {
    const ml = monthLedgers.find((l) => l.memberId === m.id);
    if (!ml || ml.paidPaise === 0) {
      unpaidMembers += 1;
    } else if (ml.paidPaise >= ml.duePaise) {
      fullyPaidMembers += 1;
    } else {
      partiallyPaidMembers += 1;
    }
  }

  const totalAdvancePaise = nonArchivedMembers.reduce(
    (acc, m) => acc + (m.advanceBalancePaise || 0),
    0
  );

  const totalRecordedCollectionPaise = completedPayments.reduce(
    (acc, p) => acc + p.amountPaise,
    0
  );

  const totalPujaExpensesPaise = expenses
    .filter((e) => e.status === 'ACTIVE')
    .reduce((acc, e) => acc + e.amountPaise, 0);

  const availableBalancePaise = totalRecordedCollectionPaise - totalPujaExpensesPaise;

  const sortedMonths = [...collectionMonths]
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .slice(-12);

  const monthlySeries = sortedMonths.map((cm) => {
    const mLedgers = ledgers.filter((l) => l.monthKey === cm.monthKey);
    const expectedPaise = mLedgers.reduce((acc, l) => acc + l.duePaise, 0);
    const collectedPaise = completedPayments
      .filter((p) => p.monthKey === cm.monthKey)
      .reduce((acc, p) => acc + p.amountPaise, 0);
    const expensePaise = expenses
      .filter((e) => e.status === 'ACTIVE' && e.expenseDate.startsWith(cm.monthKey))
      .reduce((acc, e) => acc + e.amountPaise, 0);

    return {
      monthKey: cm.monthKey,
      label: formatMonthLabel(cm.monthKey, lang),
      expectedPaise,
      collectedPaise,
      expensePaise,
    };
  });

  return {
    totalRegisteredMembers: nonArchivedMembers.length,
    activeMembers: activeMembersList.length,
    inactiveMembers: inactiveMembersList.length,
    monthlyExpectedPaise,
    thisMonthCollectionPaise,
    totalPendingPaise,
    fullyPaidMembers,
    partiallyPaidMembers,
    unpaidMembers,
    totalAdvancePaise,
    totalRecordedCollectionPaise,
    totalPujaExpensesPaise,
    availableBalancePaise,
    monthlySeries,
  };
}

export function deriveLedgerStatus(duePaise: number, paidPaise: number): LedgerStatus {
  if (paidPaise >= duePaise) return 'PAID';
  if (paidPaise > 0) return 'PARTIAL';
  return 'UNPAID';
}

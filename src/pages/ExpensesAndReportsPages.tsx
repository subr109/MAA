import React, { useMemo, useState } from 'react';
import { Archive, Download, FileText, Plus, Printer } from 'lucide-react';
import { useMaa } from '../context/MaaContext';
import {
  computeMemberFinancialSummary,
  formatDateIN,
  formatINR,
  formatMonthLabel,
  getCurrentISTDateISO,
  paiseToRupees,
  rupeesToPaise,
} from '../lib/chandaEngine';
import { exportReportCSV, exportReportExcel, exportReportPDF } from '../lib/exporters';
import { EXPENSE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS, t } from '../lib/i18n';
import { ExpenseCategory, PaymentMethod } from '../types/maa';
import { StatusLabel } from '../components/StatusLabel';

/* =========================================================
 * Page 13: Expense Management
 * ========================================================= */
export const ExpenseManagementPage: React.FC = () => {
  const { language, payments, expenses, addExpense, archiveExpense, currentUser } = useMaa();

  const [expenseDate, setExpenseDate] = useState(getCurrentISTDateISO());
  const [category, setCategory] = useState<ExpenseCategory>('PUJA_DECORATION');
  const [description, setDescription] = useState('');
  const [amountRupees, setAmountRupees] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [attachmentName, setAttachmentName] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const totalCollectionPaise = useMemo(
    () =>
      payments
        .filter((p) => p.status === 'COMPLETED')
        .reduce((acc, p) => acc + p.amountPaise, 0),
    [payments]
  );

  const activeExpenses = useMemo(
    () =>
      expenses
        .filter((e) => e.status === 'ACTIVE')
        .sort((a, b) => b.expenseDate.localeCompare(a.expenseDate)),
    [expenses]
  );

  const totalExpensesPaise = useMemo(
    () => activeExpenses.reduce((acc, e) => acc + e.amountPaise, 0),
    [activeExpenses]
  );

  const availableBalancePaise = totalCollectionPaise - totalExpensesPaise;

  const canManage =
    currentUser?.role === 'SUPER_ADMIN' || currentUser?.canManageExpenses;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = rupeesToPaise(amountRupees);
    if (!description.trim() || amt <= 0) return;
    setSaving(true);
    try {
      await addExpense({
        expenseDate,
        category,
        description: description.trim(),
        amountPaise: amt,
        vendorName: vendorName.trim(),
        paymentMethod,
        attachmentName: attachmentName || undefined,
        notes: notes.trim(),
      });
      setDescription('');
      setAmountRupees('');
      setVendorName('');
      setAttachmentName('');
      setNotes('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {t(language, 'nav_expenses')}
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {language === 'bn'
            ? 'আয় এবং পুজো খরচের পৃথক লেজার হিসাব'
            : 'Separate Puja expenditure ledger · Available Balance = Total Recorded Collection - Total Recorded Expenses'}
        </p>
      </div>

      {/* Balance Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500">Total Recorded Collection</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
            {formatINR(totalCollectionPaise)}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500">Total Recorded Expenses</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-red-700 mt-1">
            {formatINR(totalExpensesPaise)}
          </div>
        </div>
        <div className="bg-[#0F2143] text-white rounded-xl p-4">
          <div className="text-xs text-amber-300">Available Balance</div>
          <div className="text-2xl font-bold font-mono tabular-nums mt-1">
            {formatINR(availableBalancePaise)}
          </div>
        </div>
      </div>

      {/* Add Expense Form */}
      {canManage && (
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
        >
          <h3 className="text-sm font-semibold">
            {language === 'bn' ? 'নতুন পুজো খরচ যোগ করুন' : 'Record New Puja Expense'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Expense Date</label>
              <input
                type="date"
                required
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
              >
                {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, val]) => (
                  <option key={k} value={k}>
                    {val[language]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Amount (₹) *</label>
              <input
                type="number"
                min="1"
                required
                value={amountRupees}
                onChange={(e) => setAmountRupees(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1">Description *</label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Vendor Name</label>
              <input
                type="text"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
              >
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Bill / Invoice Attachment</label>
              <input
                type="file"
                onChange={(e) => setAttachmentName(e.target.files?.[0]?.name || '')}
                className="w-full text-xs py-1.5"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#0F2143] text-white hover:bg-[#162D59]"
            >
              <Plus className="w-4 h-4" />
              {saving ? 'Saving...' : 'Add Expense'}
            </button>
          </div>
        </form>
      )}

      {/* Expense Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-950 text-xs text-slate-500 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Description & Vendor</th>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {activeExpenses.map((ex) => (
                <tr key={ex.id}>
                  <td className="px-4 py-3 font-mono text-xs">{ex.expenseCode}</td>
                  <td className="px-4 py-3 font-mono text-xs">{formatDateIN(ex.expenseDate)}</td>
                  <td className="px-4 py-3 text-xs">
                    {EXPENSE_CATEGORY_LABELS[ex.category]?.[language] || ex.category}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{ex.description}</div>
                    <div className="text-xs text-slate-500">
                      {ex.vendorName || '—'} {ex.attachmentName ? `· Bill: ${ex.attachmentName}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {PAYMENT_METHOD_LABELS[ex.paymentMethod]?.[language] || ex.paymentMethod}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold tabular-nums text-red-700">
                    {formatINR(ex.amountPaise)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {currentUser?.role === 'SUPER_ADMIN' && (
                      <button
                        type="button"
                        onClick={() => archiveExpense(ex.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                        title="Archive Expense"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* =========================================================
 * Page 14: Reports & Analytics (All 12 Reports)
 * ========================================================= */
type ReportType =
  | 'DAILY_COLLECTION'
  | 'MONTHLY_COLLECTION'
  | 'ANNUAL_COLLECTION'
  | 'MEMBER_PAYMENT'
  | 'MEMBER_OUTSTANDING'
  | 'COLLECTOR_WISE'
  | 'PAYMENT_METHOD'
  | 'PARTIAL_PAYMENT'
  | 'ADVANCE_PAYMENT'
  | 'EXPENSE'
  | 'INCOME_VS_EXPENSE'
  | 'WHATSAPP_NOTIFICATION';

export const ReportsAnalyticsPage: React.FC = () => {
  const {
    language,
    members,
    collectionMonths,
    ledgers,
    payments,
    expenses,
    whatsappNotifications,
  } = useMaa();

  const [reportType, setReportType] = useState<ReportType>('MONTHLY_COLLECTION');
  const [startDate, setStartDate] = useState('2026-06-01');
  const [endDate, setEndDate] = useState('2026-12-31');
  const [monthFilter, setMonthFilter] = useState('ALL');
  const [memberFilter, setMemberFilter] = useState('ALL');
  const [collectorFilter, setCollectorFilter] = useState('ALL');
  const [methodFilter, setMethodFilter] = useState('ALL');

  const collectors = useMemo(
    () => Array.from(new Set(payments.map((p) => p.collectedByName))).sort(),
    [payments]
  );

  const filteredPayments = useMemo(
    () =>
      payments.filter(
        (p) =>
          p.status === 'COMPLETED' &&
          p.paymentDate >= startDate &&
          p.paymentDate <= endDate &&
          (monthFilter === 'ALL' || p.monthKey === monthFilter) &&
          (memberFilter === 'ALL' || p.memberId === memberFilter) &&
          (collectorFilter === 'ALL' || p.collectedByName === collectorFilter) &&
          (methodFilter === 'ALL' || p.paymentMethod === methodFilter)
      ),
    [payments, startDate, endDate, monthFilter, memberFilter, collectorFilter, methodFilter]
  );

  const reportData = useMemo((): {
    title: string;
    headers: string[];
    rows: Array<Array<string | number>>;
  } => {
    switch (reportType) {
      case 'DAILY_COLLECTION': {
        const byDay = new Map<string, { count: number; totalPaise: number }>();
        for (const p of filteredPayments) {
          const cur = byDay.get(p.paymentDate) || { count: 0, totalPaise: 0 };
          cur.count += 1;
          cur.totalPaise += p.amountPaise;
          byDay.set(p.paymentDate, cur);
        }
        return {
          title: 'Daily Collection Report',
          headers: ['Date', 'Transactions', 'Total Collected (INR)'],
          rows: Array.from(byDay.entries())
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([d, v]) => [formatDateIN(d), v.count, paiseToRupees(v.totalPaise)]),
        };
      }
      case 'MONTHLY_COLLECTION': {
        return {
          title: 'Monthly Collection Report',
          headers: ['Month', 'Financial Year', 'Expected (INR)', 'Collected (INR)', 'Pending (INR)'],
          rows: collectionMonths
            .filter((cm) => monthFilter === 'ALL' || cm.monthKey === monthFilter)
            .map((cm) => {
              const mLedgers = ledgers.filter((l) => l.monthKey === cm.monthKey);
              const exp = mLedgers.reduce((a, l) => a + l.duePaise, 0);
              const col = filteredPayments
                .filter((p) => p.monthKey === cm.monthKey)
                .reduce((a, p) => a + p.amountPaise, 0);
              const pend = mLedgers.reduce((a, l) => a + Math.max(0, l.duePaise - l.paidPaise), 0);
              return [
                formatMonthLabel(cm.monthKey, 'en'),
                cm.financialYear,
                paiseToRupees(exp),
                paiseToRupees(col),
                paiseToRupees(pend),
              ];
            }),
        };
      }
      case 'ANNUAL_COLLECTION': {
        const byFY = new Map<string, number>();
        for (const p of filteredPayments) {
          const cm = collectionMonths.find((c) => c.monthKey === p.monthKey);
          const fy = cm?.financialYear || p.paymentDate.slice(0, 4);
          byFY.set(fy, (byFY.get(fy) || 0) + p.amountPaise);
        }
        return {
          title: 'Annual Collection Report',
          headers: ['Financial Year', 'Total Collection (INR)'],
          rows: Array.from(byFY.entries()).map(([fy, tot]) => [fy, paiseToRupees(tot)]),
        };
      }
      case 'MEMBER_PAYMENT': {
        return {
          title: 'Member-wise Payment Report',
          headers: ['Member ID', 'Name', 'Payments Count', 'Total Paid (INR)', 'Last Payment'],
          rows: members
            .filter((m) => memberFilter === 'ALL' || m.id === memberFilter)
            .map((m) => {
              const mp = filteredPayments.filter((p) => p.memberId === m.id);
              const tot = mp.reduce((a, p) => a + p.amountPaise, 0);
              const last = mp.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))[0]?.paymentDate;
              return [m.memberCode, m.fullName, mp.length, paiseToRupees(tot), formatDateIN(last)];
            }),
        };
      }
      case 'MEMBER_OUTSTANDING': {
        return {
          title: 'Member-wise Outstanding Report',
          headers: ['Member ID', 'Name', 'Mobile', 'Pending Months', 'Outstanding (INR)'],
          rows: members
            .filter((m) => m.status === 'ACTIVE')
            .map((m) => {
              const s = computeMemberFinancialSummary(m, ledgers, payments);
              return [
                m.memberCode,
                m.fullName,
                m.mobile,
                s.pendingMonthsCount,
                paiseToRupees(s.totalOutstandingPaise),
              ];
            })
            .filter((r) => Number(r[4]) > 0),
        };
      }
      case 'COLLECTOR_WISE': {
        const map = new Map<string, { count: number; totalPaise: number }>();
        for (const p of filteredPayments) {
          const cur = map.get(p.collectedByName) || { count: 0, totalPaise: 0 };
          cur.count += 1;
          cur.totalPaise += p.amountPaise;
          map.set(p.collectedByName, cur);
        }
        return {
          title: 'Collector-wise Collection Report',
          headers: ['Collector Name', 'Receipts Count', 'Total Collected (INR)'],
          rows: Array.from(map.entries()).map(([k, v]) => [k, v.count, paiseToRupees(v.totalPaise)]),
        };
      }
      case 'PAYMENT_METHOD': {
        const map = new Map<string, { count: number; totalPaise: number }>();
        for (const p of filteredPayments) {
          const cur = map.get(p.paymentMethod) || { count: 0, totalPaise: 0 };
          cur.count += 1;
          cur.totalPaise += p.amountPaise;
          map.set(p.paymentMethod, cur);
        }
        return {
          title: 'Payment Method Report',
          headers: ['Payment Method', 'Transactions', 'Amount (INR)'],
          rows: Array.from(map.entries()).map(([k, v]) => [k, v.count, paiseToRupees(v.totalPaise)]),
        };
      }
      case 'PARTIAL_PAYMENT': {
        return {
          title: 'Partial Payment Report',
          headers: ['Member ID', 'Member Name', 'Month', 'Due (INR)', 'Paid (INR)', 'Remaining (INR)'],
          rows: ledgers
            .filter((l) => l.status === 'PARTIAL' && (monthFilter === 'ALL' || l.monthKey === monthFilter))
            .map((l) => {
              const m = members.find((x) => x.id === l.memberId);
              return [
                l.memberCode,
                m?.fullName || l.memberCode,
                l.monthKey,
                paiseToRupees(l.duePaise),
                paiseToRupees(l.paidPaise),
                paiseToRupees(l.duePaise - l.paidPaise),
              ];
            }),
        };
      }
      case 'ADVANCE_PAYMENT': {
        return {
          title: 'Advance Payment Report',
          headers: ['Member ID', 'Member Name', 'Mobile', 'Advance Balance (INR)'],
          rows: members
            .filter((m) => (m.advanceBalancePaise || 0) > 0)
            .map((m) => [m.memberCode, m.fullName, m.mobile, paiseToRupees(m.advanceBalancePaise)]),
        };
      }
      case 'EXPENSE': {
        const exList = expenses.filter(
          (e) => e.status === 'ACTIVE' && e.expenseDate >= startDate && e.expenseDate <= endDate
        );
        return {
          title: 'Puja Expense Report',
          headers: ['Expense ID', 'Date', 'Category', 'Description', 'Vendor', 'Amount (INR)'],
          rows: exList.map((e) => [
            e.expenseCode,
            formatDateIN(e.expenseDate),
            e.category,
            e.description,
            e.vendorName || '—',
            paiseToRupees(e.amountPaise),
          ]),
        };
      }
      case 'INCOME_VS_EXPENSE': {
        return {
          title: 'Income vs Expense Report',
          headers: ['Month', 'Income / Collection (INR)', 'Expenses (INR)', 'Net Surplus (INR)'],
          rows: collectionMonths.map((cm) => {
            const inc = filteredPayments
              .filter((p) => p.monthKey === cm.monthKey)
              .reduce((a, p) => a + p.amountPaise, 0);
            const exp = expenses
              .filter((e) => e.status === 'ACTIVE' && e.expenseDate.startsWith(cm.monthKey))
              .reduce((a, e) => a + e.amountPaise, 0);
            return [
              formatMonthLabel(cm.monthKey, 'en'),
              paiseToRupees(inc),
              paiseToRupees(exp),
              paiseToRupees(inc - exp),
            ];
          }),
        };
      }
      case 'WHATSAPP_NOTIFICATION': {
        return {
          title: 'WhatsApp Notification Report',
          headers: ['Notification ID', 'Member', 'Phone', 'Type', 'Status', 'Meta ID'],
          rows: whatsappNotifications.map((w) => [
            w.notificationId,
            w.memberName,
            w.recipientPhone,
            w.type,
            w.status,
            w.metaMessageId || w.errorMessage || '—',
          ]),
        };
      }
    }
  }, [
    reportType,
    filteredPayments,
    collectionMonths,
    ledgers,
    monthFilter,
    members,
    memberFilter,
    payments,
    expenses,
    startDate,
    endDate,
    whatsappNotifications,
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {t(language, 'nav_reports')}
          </h2>
          <p className="text-xs text-slate-500">
            {reportData.title} · {reportData.rows.length} rows
          </p>
        </div>

        <div className="no-print flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              exportReportExcel(reportType, reportData.title, reportData.headers, reportData.rows)
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            <Download className="w-3.5 h-3.5" />
            Excel
          </button>
          <button
            type="button"
            onClick={() => exportReportCSV(reportType, reportData.headers, reportData.rows)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            <FileText className="w-3.5 h-3.5" />
            CSV
          </button>
          <button
            type="button"
            onClick={() =>
              exportReportPDF(
                reportType,
                reportData.title,
                `Range: ${formatDateIN(startDate)} to ${formatDateIN(endDate)}`,
                reportData.headers,
                reportData.rows
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-[#0F2143] text-white"
          >
            <Download className="w-3.5 h-3.5" />
            PDF
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <select
          value={reportType}
          onChange={(e) => setReportType(e.target.value as ReportType)}
          className="px-3 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
        >
          <option value="DAILY_COLLECTION">1. Daily Collection Report</option>
          <option value="MONTHLY_COLLECTION">2. Monthly Collection Report</option>
          <option value="ANNUAL_COLLECTION">3. Annual Collection Report</option>
          <option value="MEMBER_PAYMENT">4. Member-wise Payment Report</option>
          <option value="MEMBER_OUTSTANDING">5. Member-wise Outstanding Report</option>
          <option value="COLLECTOR_WISE">6. Collector-wise Collection Report</option>
          <option value="PAYMENT_METHOD">7. Payment Method Report</option>
          <option value="PARTIAL_PAYMENT">8. Partial Payment Report</option>
          <option value="ADVANCE_PAYMENT">9. Advance Payment Report</option>
          <option value="EXPENSE">10. Expense Report</option>
          <option value="INCOME_VS_EXPENSE">11. Income vs Expense Report</option>
          <option value="WHATSAPP_NOTIFICATION">12. WhatsApp Notification Report</option>
        </select>

        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
        />
        <select
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
        >
          <option value="ALL">All Months</option>
          {collectionMonths.map((cm) => (
            <option key={cm.monthKey} value={cm.monthKey}>
              {cm.monthKey}
            </option>
          ))}
        </select>
        <select
          value={memberFilter}
          onChange={(e) => setMemberFilter(e.target.value)}
          className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
        >
          <option value="ALL">All Members</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.memberCode} — {m.fullName}
            </option>
          ))}
        </select>
        <select
          value={collectorFilter}
          onChange={(e) => setCollectorFilter(e.target.value)}
          className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
        >
          <option value="ALL">All Collectors</option>
          {collectors.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Report Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-950 text-xs text-slate-500 border-b border-slate-200 dark:border-slate-800">
              <tr>
                {reportData.headers.map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {reportData.rows.map((row, idx) => (
                <tr key={idx}>
                  {row.map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      className={`px-4 py-3 ${
                        typeof cell === 'number' ? 'font-mono tabular-nums font-semibold' : ''
                      }`}
                    >
                      {typeof cell === 'string' && ['SENT', 'DELIVERED', 'READ', 'FAILED', 'QUEUED'].includes(cell) ? (
                        <StatusLabel status={cell} />
                      ) : (
                        cell
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              {reportData.rows.length === 0 && (
                <tr>
                  <td colSpan={reportData.headers.length} className="px-4 py-8 text-center text-sm text-slate-500">
                    {t(language, 'noRecords')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

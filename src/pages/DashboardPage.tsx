import React, { useMemo, useState } from 'react';
import {
  UserPlus,
  IndianRupee,
  Clock,
  Receipt as ReceiptIcon,
  FileBarChart2,
  Send,
} from 'lucide-react';
import { useMaa } from '../context/MaaContext';
import {
  computeDashboardStats,
  formatDateIN,
  formatINR,
  formatMonthLabel,
  paiseToRupees,
} from '../lib/chandaEngine';
import { PAYMENT_METHOD_LABELS, t } from '../lib/i18n';
import { ChartCanvas } from '../components/ChartCanvas';
import { StatusLabel } from '../components/StatusLabel';
import { ReceiptModal } from '../components/ReceiptModal';
import { Receipt } from '../types/maa';

export const DashboardPage: React.FC = () => {
  const {
    language,
    members,
    collectionMonths,
    ledgers,
    payments,
    expenses,
    receipts,
    selectedMonthKey,
    setSelectedMonthKey,
    setActivePage,
    currentUser,
  } = useMaa();

  const [previewReceipt, setPreviewReceipt] = useState<Receipt | null>(null);

  const stats = useMemo(
    () =>
      computeDashboardStats({
        members,
        collectionMonths,
        ledgers,
        payments,
        expenses,
        selectedMonthKey,
        lang: language,
      }),
    [members, collectionMonths, ledgers, payments, expenses, selectedMonthKey, language]
  );

  const recentPayments = useMemo(
    () =>
      [...payments]
        .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))
        .slice(0, 8),
    [payments]
  );

  const kpiCards = [
    { label: t(language, 'kpiTotalMembers'), value: String(stats.totalRegisteredMembers), tone: 'default' },
    { label: t(language, 'kpiActiveMembers'), value: String(stats.activeMembers), tone: 'success' },
    { label: t(language, 'kpiInactiveMembers'), value: String(stats.inactiveMembers), tone: 'muted' },
    { label: t(language, 'kpiMonthlyExpected'), value: formatINR(stats.monthlyExpectedPaise), tone: 'navy' },
    { label: t(language, 'kpiThisMonthCollection'), value: formatINR(stats.thisMonthCollectionPaise), tone: 'success' },
    { label: t(language, 'kpiTotalPending'), value: formatINR(stats.totalPendingPaise), tone: 'pending' },
    { label: t(language, 'kpiFullyPaid'), value: String(stats.fullyPaidMembers), tone: 'success' },
    { label: t(language, 'kpiPartiallyPaid'), value: String(stats.partiallyPaidMembers), tone: 'pending' },
    { label: t(language, 'kpiUnpaid'), value: String(stats.unpaidMembers), tone: 'danger' },
    { label: t(language, 'kpiAdvancePayments'), value: formatINR(stats.totalAdvancePaise), tone: 'navy' },
    { label: t(language, 'kpiTotalExpenses'), value: formatINR(stats.totalPujaExpensesPaise), tone: 'danger' },
    { label: t(language, 'kpiAvailableBalance'), value: formatINR(stats.availableBalancePaise), tone: 'navy' },
  ];

  // 1. Monthly collection graph
  const monthlyCollectionConfig = useMemo(
    () => ({
      type: 'bar' as const,
      data: {
        labels: stats.monthlySeries.map((s) => s.label),
        datasets: [
          {
            label: language === 'bn' ? 'প্রত্যাশিত (₹)' : 'Expected (₹)',
            data: stats.monthlySeries.map((s) => paiseToRupees(s.expectedPaise)),
            backgroundColor: '#CBD5E1',
            borderRadius: 4,
          },
          {
            label: language === 'bn' ? 'সংগৃহীত (₹)' : 'Collected (₹)',
            data: stats.monthlySeries.map((s) => paiseToRupees(s.collectedPaise)),
            backgroundColor: '#0F2143',
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' as const } },
      },
    }),
    [stats.monthlySeries, language]
  );

  // 2. Paid vs Unpaid member chart
  const paidVsUnpaidConfig = useMemo(
    () => ({
      type: 'doughnut' as const,
      data: {
        labels: [
          t(language, 'statusPaid'),
          t(language, 'statusPartial'),
          t(language, 'statusUnpaid'),
        ],
        datasets: [
          {
            data: [stats.fullyPaidMembers, stats.partiallyPaidMembers, stats.unpaidMembers],
            backgroundColor: ['#16A34A', '#D97706', '#DC2626'],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' as const } },
      },
    }),
    [stats, language]
  );

  // 3. Monthly income vs expense chart
  const incomeVsExpenseConfig = useMemo(
    () => ({
      type: 'bar' as const,
      data: {
        labels: stats.monthlySeries.map((s) => s.label),
        datasets: [
          {
            label: language === 'bn' ? 'আয় / চাঁদা (₹)' : 'Income (₹)',
            data: stats.monthlySeries.map((s) => paiseToRupees(s.collectedPaise)),
            backgroundColor: '#16A34A',
            borderRadius: 4,
          },
          {
            label: language === 'bn' ? 'পুজো খরচ (₹)' : 'Expenses (₹)',
            data: stats.monthlySeries.map((s) => paiseToRupees(s.expensePaise)),
            backgroundColor: '#EA580C',
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' as const } },
      },
    }),
    [stats.monthlySeries, language]
  );

  // 4. Collection trend graph
  const collectionTrendConfig = useMemo(
    () => ({
      type: 'line' as const,
      data: {
        labels: stats.monthlySeries.map((s) => s.label),
        datasets: [
          {
            label: language === 'bn' ? 'সংগ্রহের প্রবণতা (₹)' : 'Collection Trend (₹)',
            data: stats.monthlySeries.map((s) => paiseToRupees(s.collectedPaise)),
            borderColor: '#B48327',
            backgroundColor: 'rgba(180, 131, 39, 0.14)',
            fill: true,
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' as const } },
      },
    }),
    [stats.monthlySeries, language]
  );

  const isSuperOrCollector =
    currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'COLLECTION_ADMIN';

  return (
    <div className="space-y-6">
      {/* Month Selector & Summary Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {t(language, 'nav_dashboard')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {formatMonthLabel(selectedMonthKey, language)} ·{' '}
            {language === 'bn' ? 'সকল পরিসংখ্যান ডাটাবেস থেকে সরাসরি গণনাকৃত' : 'Live metrics computed directly from database records'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="dash-month" className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {language === 'bn' ? 'মাস:' : 'Month:'}
          </label>
          <select
            id="dash-month"
            value={selectedMonthKey}
            onChange={(e) => setSelectedMonthKey(e.target.value)}
            className="px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100"
          >
            {[...collectionMonths]
              .sort((a, b) => b.monthKey.localeCompare(a.monthKey))
              .map((cm) => (
                <option key={cm.monthKey} value={cm.monthKey}>
                  {formatMonthLabel(cm.monthKey, language)}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Quick Actions */}
      {isSuperOrCollector && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <button
            type="button"
            onClick={() => setActivePage('add-member')}
            className="flex items-center gap-2.5 px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:border-[#0F2143] text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors"
          >
            <UserPlus className="w-4 h-4 text-[#0F2143] dark:text-amber-400 shrink-0" />
            <span className="truncate">{t(language, 'qaAddMember')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActivePage('collect')}
            className="flex items-center gap-2.5 px-3.5 py-2.5 bg-[#0F2143] text-white rounded-lg hover:bg-[#162D59] text-xs font-semibold transition-colors"
          >
            <IndianRupee className="w-4 h-4 text-amber-300 shrink-0" />
            <span className="truncate">{t(language, 'qaCollectChanda')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActivePage('pending')}
            className="flex items-center gap-2.5 px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:border-[#D95D16] text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors"
          >
            <Clock className="w-4 h-4 text-[#D95D16] shrink-0" />
            <span className="truncate">{t(language, 'qaViewPending')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActivePage('expenses')}
            className="flex items-center gap-2.5 px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:border-[#0F2143] text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors"
          >
            <ReceiptIcon className="w-4 h-4 text-red-600 shrink-0" />
            <span className="truncate">{t(language, 'qaAddExpense')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActivePage('reports')}
            className="flex items-center gap-2.5 px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:border-[#0F2143] text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors"
          >
            <FileBarChart2 className="w-4 h-4 text-[#B48327] shrink-0" />
            <span className="truncate">{t(language, 'qaGenerateReport')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActivePage('pending')}
            className="flex items-center gap-2.5 px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:border-emerald-700 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors"
          >
            <Send className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <span className="truncate">{t(language, 'qaSendReminder')}</span>
          </button>
        </div>
      )}

      {/* 12 Live KPI Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => {
          const valColor =
            kpi.tone === 'success'
              ? 'text-emerald-700 dark:text-emerald-400'
              : kpi.tone === 'pending'
              ? 'text-amber-700 dark:text-amber-400'
              : kpi.tone === 'danger'
              ? 'text-red-700 dark:text-red-400'
              : kpi.tone === 'navy'
              ? 'text-[#0F2143] dark:text-amber-300'
              : 'text-slate-900 dark:text-slate-100';

          return (
            <div
              key={kpi.label}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4"
            >
              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {kpi.label}
              </div>
              <div className={`text-xl font-bold font-mono tabular-nums mt-1.5 ${valColor}`}>
                {kpi.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* 4 Dashboard Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
            {language === 'bn' ? '১. মাসিক চাঁদা সংগ্রহ গ্রাফ' : '1. Monthly Collection Graph'}
          </h3>
          <ChartCanvas config={monthlyCollectionConfig} height={240} />
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
            {language === 'bn' ? '২. পরিশোধিত বনাম বকেয়া সদস্য' : '2. Paid vs Unpaid Members'} ({formatMonthLabel(selectedMonthKey, language)})
          </h3>
          <ChartCanvas config={paidVsUnpaidConfig} height={240} />
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
            {language === 'bn' ? '৩. মাসিক আয় বনাম পুজো খরচ' : '3. Monthly Income vs Expense'}
          </h3>
          <ChartCanvas config={incomeVsExpenseConfig} height={240} />
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
            {language === 'bn' ? '৪. সংগ্রহের প্রবণতা গ্রাফ' : '4. Collection Trend Graph'}
          </h3>
          <ChartCanvas config={collectionTrendConfig} height={240} />
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t(language, 'recentTransactions')}
          </h3>
          <button
            type="button"
            onClick={() => setActivePage('payments')}
            className="text-xs font-medium text-[#0F2143] dark:text-amber-300 hover:underline"
          >
            {language === 'bn' ? 'সব লেনদেন দেখুন' : 'View all'}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-950 text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 font-medium">{language === 'bn' ? 'তারিখ' : 'Date'}</th>
                <th className="px-4 py-3 font-medium">{language === 'bn' ? 'রসিদ' : 'Receipt'}</th>
                <th className="px-4 py-3 font-medium">{language === 'bn' ? 'সদস্য' : 'Member'}</th>
                <th className="px-4 py-3 font-medium">{language === 'bn' ? 'মাস' : 'Month'}</th>
                <th className="px-4 py-3 font-medium">{language === 'bn' ? 'মাধ্যম' : 'Method'}</th>
                <th className="px-4 py-3 font-medium text-right">{language === 'bn' ? 'পরিমাণ' : 'Amount'}</th>
                <th className="px-4 py-3 font-medium">{language === 'bn' ? 'অবস্থা' : 'Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {recentPayments.map((p) => {
                const matchedReceipt = receipts.find((r) => r.paymentId === p.id);
                return (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-mono text-xs tabular-nums text-slate-600 dark:text-slate-400">
                      {formatDateIN(p.paymentDate)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {matchedReceipt ? (
                        <button
                          type="button"
                          onClick={() => setPreviewReceipt(matchedReceipt)}
                          className="text-[#0F2143] dark:text-amber-300 hover:underline font-medium"
                        >
                          {p.receiptNumber}
                        </button>
                      ) : (
                        p.receiptNumber
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{p.memberName}</div>
                      <div className="font-mono text-[11px] text-slate-500">{p.memberCode}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                      {formatMonthLabel(p.monthKey, language)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                      {PAYMENT_METHOD_LABELS[p.paymentMethod]?.[language] || p.paymentMethod}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {formatINR(p.amountPaise)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusLabel
                        status={p.status}
                        label={
                          p.status === 'COMPLETED'
                            ? t(language, 'statusCompleted')
                            : t(language, 'statusReversed')
                        }
                      />
                    </td>
                  </tr>
                );
              })}
              {recentPayments.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                    {t(language, 'noRecords')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ReceiptModal receipt={previewReceipt} onClose={() => setPreviewReceipt(null)} />
    </div>
  );
};

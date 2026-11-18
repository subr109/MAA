import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  IndianRupee,
  Plus,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
} from 'lucide-react';
import { useMaa } from '../context/MaaContext';
import {
  calculatePaymentAllocation,
  computeMemberFinancialSummary,
  formatDateIN,
  formatINR,
  formatMonthLabel,
  getCurrentISTDateISO,
  paiseToRupees,
  rupeesToPaise,
} from '../lib/chandaEngine';
import { PAYMENT_METHOD_LABELS, t } from '../lib/i18n';
import { AllocationMode, Payment, PaymentMethod, Receipt, WhatsappNotification } from '../types/maa';
import { StatusLabel } from '../components/StatusLabel';
import { ReceiptModal } from '../components/ReceiptModal';

/* =========================================================
 * Page 6: Monthly Collection Management
 * ========================================================= */
export const MonthlyCollectionPage: React.FC = () => {
  const {
    language,
    members,
    collectionMonths,
    ledgers,
    selectedMonthKey,
    setSelectedMonthKey,
    settings,
    createCollectionMonth,
    updateLedgerDue,
    setPrefillCollectMemberId,
    setActivePage,
  } = useMaa();

  const [tab, setTab] = useState<'ALL' | 'PAID' | 'PARTIAL' | 'UNPAID' | 'ADVANCE'>('ALL');
  const [newMonthKey, setNewMonthKey] = useState('2026-12');
  const [newFY, setNewFY] = useState(settings.financialYear || '2026-27');
  const [newDefaultRupees, setNewDefaultRupees] = useState(
    String(paiseToRupees(settings.defaultMonthlyChandaPaise))
  );
  const [creating, setCreating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [editingDueMemberId, setEditingDueMemberId] = useState<string | null>(null);
  const [editingDueRupees, setEditingDueRupees] = useState('');

  const handleCreateMonth = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setCreating(true);
    try {
      await createCollectionMonth({
        monthKey: newMonthKey,
        financialYear: newFY,
        defaultAmountPaise: rupeesToPaise(newDefaultRupees),
      });
      setFeedback(`Created ${newMonthKey} and generated monthly dues for all active members.`);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Unable to create month');
    } finally {
      setCreating(false);
    }
  };

  const monthRows = useMemo(() => {
    return members
      .filter((m) => m.status === 'ACTIVE')
      .map((m) => {
        const ledger = ledgers.find(
          (l) => l.memberId === m.id && l.monthKey === selectedMonthKey
        );
        const duePaise = ledger?.duePaise ?? m.monthlyChandaPaise;
        const paidPaise = ledger?.paidPaise ?? 0;
        const status = ledger?.status ?? (duePaise === 0 ? 'PAID' : 'UNPAID');
        return {
          member: m,
          duePaise,
          paidPaise,
          remainingPaise: Math.max(0, duePaise - paidPaise),
          status,
        };
      })
      .filter((row) => {
        if (tab === 'ALL') return true;
        if (tab === 'ADVANCE') return (row.member.advanceBalancePaise || 0) > 0;
        return row.status === tab;
      });
  }, [members, ledgers, selectedMonthKey, tab]);

  const monthTotals = useMemo(() => {
    let expected = 0;
    let collected = 0;
    for (const r of monthRows) {
      expected += r.duePaise;
      collected += r.paidPaise;
    }
    return { expected, collected, pending: Math.max(0, expected - collected) };
  }, [monthRows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {t(language, 'nav_monthly-collection')}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {formatMonthLabel(selectedMonthKey, language)} · Expected{' '}
            <span className="font-mono font-semibold">{formatINR(monthTotals.expected)}</span> ·
            Collected{' '}
            <span className="font-mono font-semibold text-emerald-700">
              {formatINR(monthTotals.collected)}
            </span>{' '}
            · Pending{' '}
            <span className="font-mono font-semibold text-amber-700">
              {formatINR(monthTotals.pending)}
            </span>
          </p>
        </div>

        <select
          value={selectedMonthKey}
          onChange={(e) => setSelectedMonthKey(e.target.value)}
          className="px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
        >
          {[...collectionMonths]
            .sort((a, b) => b.monthKey.localeCompare(a.monthKey))
            .map((cm) => (
              <option key={cm.monthKey} value={cm.monthKey}>
                {formatMonthLabel(cm.monthKey, language)} ({cm.financialYear})
              </option>
            ))}
        </select>
      </div>

      {/* Create New Collection Month */}
      <form
        onSubmit={handleCreateMonth}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
      >
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            {language === 'bn' ? 'নতুন সংগ্রহ মাস (YYYY-MM)' : 'New Month (YYYY-MM)'}
          </label>
          <input
            type="month"
            required
            value={newMonthKey}
            onChange={(e) => setNewMonthKey(e.target.value)}
            className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            {language === 'bn' ? 'অর্থবর্ষ' : 'Financial Year'}
          </label>
          <input
            type="text"
            required
            value={newFY}
            onChange={(e) => setNewFY(e.target.value)}
            className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            {language === 'bn' ? 'ডিফল্ট চাঁদা (₹)' : 'Default Monthly Chanda (₹)'}
          </label>
          <input
            type="number"
            min="0"
            required
            value={newDefaultRupees}
            onChange={(e) => setNewDefaultRupees(e.target.value)}
            className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
          />
        </div>
        <button
          type="submit"
          disabled={creating}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-lg bg-[#0F2143] text-white hover:bg-[#162D59] disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          {language === 'bn' ? 'মাস ও বকেয়া তৈরি করুন' : 'Create Month & Generate Dues'}
        </button>
      </form>

      {feedback && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
          {feedback}
        </div>
      )}

      {/* Segmented Status Filter */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg w-fit">
        {(['ALL', 'PAID', 'PARTIAL', 'UNPAID', 'ADVANCE'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              tab === k
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            {k === 'ALL'
              ? language === 'bn'
                ? 'সকল সদস্য'
                : 'All Members'
              : k === 'ADVANCE'
              ? language === 'bn'
                ? 'অগ্রিম ব্যালেন্স'
                : 'Advance Balance'
              : t(language, `status${k[0] + k.slice(1).toLowerCase()}`)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-950 text-xs text-slate-500 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">{language === 'bn' ? 'সদস্য' : 'Member'}</th>
                <th className="px-4 py-3 font-medium text-right">{language === 'bn' ? 'নির্ধারিত চাঁদা' : 'Monthly Due'}</th>
                <th className="px-4 py-3 font-medium text-right">{language === 'bn' ? 'জমা' : 'Paid'}</th>
                <th className="px-4 py-3 font-medium text-right">{language === 'bn' ? 'বাকি' : 'Remaining'}</th>
                <th className="px-4 py-3 font-medium text-right">{language === 'bn' ? 'অগ্রিম' : 'Advance'}</th>
                <th className="px-4 py-3 font-medium">{language === 'bn' ? 'স্থিতি' : 'Status'}</th>
                <th className="px-4 py-3 font-medium text-right">{language === 'bn' ? 'কার্যক্রম' : 'Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {monthRows.map((row) => (
                <tr key={row.member.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-mono text-xs">{row.member.memberCode}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.member.fullName}</div>
                    <div className="text-xs text-slate-500">{row.member.area}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {editingDueMemberId === row.member.id ? (
                      <div className="inline-flex items-center gap-1">
                        <input
                          type="number"
                          value={editingDueRupees}
                          onChange={(e) => setEditingDueRupees(e.target.value)}
                          className="w-20 px-2 py-1 text-xs border rounded"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            await updateLedgerDue(
                              row.member.id,
                              selectedMonthKey,
                              rupeesToPaise(editingDueRupees)
                            );
                            setEditingDueMemberId(null);
                          }}
                          className="text-xs text-emerald-700 font-semibold"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingDueMemberId(row.member.id);
                          setEditingDueRupees(String(paiseToRupees(row.duePaise)));
                        }}
                        className="hover:underline"
                        title="Click to customize month due"
                      >
                        {formatINR(row.duePaise)}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-700">
                    {formatINR(row.paidPaise)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-amber-700">
                    {formatINR(row.remainingPaise)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-[#0F2143] dark:text-amber-300">
                    {formatINR(row.member.advanceBalancePaise || 0)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusLabel status={row.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setPrefillCollectMemberId(row.member.id);
                        setActivePage('collect');
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-[#0F2143] text-white hover:bg-[#162D59]"
                    >
                      <IndianRupee className="w-3 h-3" />
                      {language === 'bn' ? 'সংগ্রহ' : 'Collect'}
                    </button>
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
 * Page 7: New Collection Entry
 * ========================================================= */
export const NewCollectionEntryPage: React.FC = () => {
  const {
    language,
    members,
    collectionMonths,
    ledgers,
    selectedMonthKey,
    prefillCollectMemberId,
    setPrefillCollectMemberId,
    currentUser,
    recordPayment,
  } = useMaa();

  const activeMembers = useMemo(
    () => members.filter((m) => m.status === 'ACTIVE'),
    [members]
  );

  const [memberId, setMemberId] = useState<string>(
    prefillCollectMemberId || activeMembers[0]?.id || ''
  );
  const [monthKey, setMonthKey] = useState<string>(selectedMonthKey);
  const [amountRupees, setAmountRupees] = useState<string>('500');
  const [paymentDate, setPaymentDate] = useState<string>(getCurrentISTDateISO());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [transactionRef, setTransactionRef] = useState<string>('');
  const [allocationMode, setAllocationMode] = useState<AllocationMode>('AUTO_OLDEST');
  const [notes, setNotes] = useState<string>('');
  const [sendWhatsApp, setSendWhatsApp] = useState<boolean>(true);
  const [step, setStep] = useState<'FORM' | 'CONFIRM' | 'DONE'>('FORM');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultReceipt, setResultReceipt] = useState<Receipt | null>(null);
  const [waResult, setWaResult] = useState<WhatsappNotification | undefined>(undefined);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  const selectedMember = useMemo(
    () => activeMembers.find((m) => m.id === memberId) || activeMembers[0],
    [activeMembers, memberId]
  );

  const memberLedgers = useMemo(
    () => (selectedMember ? ledgers.filter((l) => l.memberId === selectedMember.id) : []),
    [ledgers, selectedMember]
  );

  const currentMonthLedger = memberLedgers.find((l) => l.monthKey === monthKey);
  const totalOutstandingPaise = memberLedgers.reduce(
    (acc, l) => acc + Math.max(0, l.duePaise - l.paidPaise),
    0
  );

  const previewAlloc = useMemo(() => {
    const amtPaise = rupeesToPaise(amountRupees);
    if (!selectedMember || amtPaise <= 0) return null;
    try {
      return calculatePaymentAllocation({
        amountPaise: amtPaise,
        allocationMode,
        selectedMonthKey: monthKey,
        memberLedgers,
        collectionMonths,
        currentAdvancePaise: selectedMember.advanceBalancePaise || 0,
        defaultMemberMonthlyPaise: selectedMember.monthlyChandaPaise,
      });
    } catch {
      return null;
    }
  }, [
    amountRupees,
    selectedMember,
    allocationMode,
    monthKey,
    memberLedgers,
    collectionMonths,
  ]);

  const handleConfirmSubmit = async () => {
    if (!selectedMember) return;
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const txId = `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const res = await recordPayment({
        memberId: selectedMember.id,
        monthKey,
        amountPaise: rupeesToPaise(amountRupees),
        paymentDate,
        paymentMethod,
        transactionRef,
        allocationMode,
        notes,
        sendWhatsApp,
        transactionId: txId,
      });
      setResultReceipt(res.receipt);
      setWaResult(res.whatsappNotification);
      setPrefillCollectMemberId(null);
      setStep('DONE');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Payment could not be saved.');
      setStep('FORM');
    } finally {
      setSubmitting(false);
    }
  };

  if (!selectedMember) {
    return <div className="p-6 text-sm text-slate-500">{t(language, 'noRecords')}</div>;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {t(language, 'nav_collect')}
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {language === 'bn'
            ? 'অ্যাটমিক পেমেন্ট এন্ট্রি · স্বয়ংক্রিয় রসিদ ও হোয়াটসঅ্যাপ বিজ্ঞপ্তি'
            : 'Atomic payment entry with automatic allocation preview, receipt generation, and WhatsApp dispatch'}
        </p>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {step === 'DONE' && resultReceipt && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-start gap-3 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-6 h-6 shrink-0" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {language === 'bn' ? 'পেমেন্ট সফলভাবে সংরক্ষিত হয়েছে' : 'Payment Recorded Successfully'}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Receipt Number: <span className="font-mono font-bold">{resultReceipt.receiptNumber}</span> · Amount:{' '}
                <span className="font-mono font-bold">{formatINR(resultReceipt.amountPaise)}</span>
              </p>
            </div>
          </div>

          {waResult && (
            <div
              className={`p-3.5 rounded-lg border text-xs ${
                waResult.status === 'FAILED'
                  ? 'bg-red-50 border-red-200 text-red-900'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}
            >
              <div className="font-semibold">
                WhatsApp Notification Status: {waResult.status}
              </div>
              {waResult.errorMessage && (
                <div className="mt-1">
                  Note (Payment is safely saved): {waResult.errorMessage}
                </div>
              )}
              {waResult.metaMessageId && (
                <div className="mt-1 font-mono">Meta Message ID: {waResult.metaMessageId}</div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setShowReceiptModal(true)}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#0F2143] text-white hover:bg-[#162D59]"
            >
              {language === 'bn' ? 'ডিজিটাল রসিদ দেখুন / প্রিন্ট' : 'View / Print / PDF Receipt'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('FORM');
                setResultReceipt(null);
                setWaResult(undefined);
                setTransactionRef('');
                setNotes('');
              }}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800"
            >
              {language === 'bn' ? 'আরেকটি পেমেন্ট এন্ট্রি করুন' : 'Collect Another Payment'}
            </button>
          </div>
        </div>
      )}

      {step !== 'DONE' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'bn' ? '১. সদস্য নির্বাচন করুন *' : '1. Select Member *'}
                </label>
                <select
                  value={selectedMember.id}
                  disabled={step === 'CONFIRM'}
                  onChange={(e) => {
                    const m = activeMembers.find((x) => x.id === e.target.value);
                    setMemberId(e.target.value);
                    if (m) setAmountRupees(String(paiseToRupees(m.monthlyChandaPaise)));
                  }}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
                >
                  {activeMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.memberCode} — {m.fullName} ({m.mobile})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'bn' ? '২. সদস্য আইডি' : '2. Member ID'}
                </label>
                <input
                  type="text"
                  readOnly
                  value={selectedMember.memberCode}
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'bn' ? '৩. মোবাইল নম্বর' : '3. Mobile Number'}
                </label>
                <input
                  type="text"
                  readOnly
                  value={selectedMember.mobile}
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'bn' ? '৪. চাঁদার মাস' : '4. Collection Month'}
                </label>
                <select
                  value={monthKey}
                  disabled={step === 'CONFIRM'}
                  onChange={(e) => setMonthKey(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
                >
                  {[...collectionMonths]
                    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
                    .map((cm) => (
                      <option key={cm.monthKey} value={cm.monthKey}>
                        {formatMonthLabel(cm.monthKey, language)}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'bn' ? '৫. জমার পরিমাণ (₹) *' : '5. Payment Amount (₹) *'}
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  disabled={step === 'CONFIRM'}
                  value={amountRupees}
                  onChange={(e) => setAmountRupees(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'bn' ? '৬. পেমেন্টের তারিখ' : '6. Payment Date'}
                </label>
                <input
                  type="date"
                  disabled={step === 'CONFIRM'}
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'bn' ? '৭. পেমেন্ট মাধ্যম' : '7. Payment Method'}
                </label>
                <select
                  value={paymentMethod}
                  disabled={step === 'CONFIRM'}
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
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'bn' ? '৮. ট্রানজ্যাকশন রেফারেন্স' : '8. Transaction Reference'}
                </label>
                <input
                  type="text"
                  disabled={step === 'CONFIRM'}
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  placeholder="UPI / UTR Ref"
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'bn' ? '৯. সংগ্রহকারী' : '9. Collected By'}
                </label>
                <input
                  type="text"
                  readOnly
                  value={currentUser?.name || ''}
                  className="w-full px-3 py-2 text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'bn' ? 'বণ্টন নিয়ম (Allocation Rule)' : 'Allocation Rule'}
                </label>
                <select
                  value={allocationMode}
                  disabled={step === 'CONFIRM'}
                  onChange={(e) => setAllocationMode(e.target.value as AllocationMode)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
                >
                  <option value="AUTO_OLDEST">
                    {language === 'bn'
                      ? 'স্বয়ংক্রিয়: পুরনো বকেয়া আগে পরিশোধ (অতিরিক্ত অংশ অগ্রিম/পরবর্তী মাসে)'
                      : 'Automatic: Oldest Pending Month First (then excess to Advance)'}
                  </option>
                  <option value="MANUAL">
                    {language === 'bn'
                      ? 'নির্বাচিত মাস + অতিরিক্ত অগ্রিম ব্যালেন্সে জমা'
                      : 'Manual: Selected Month Only + Excess to Advance Balance'}
                  </option>
                  <option value="ADVANCE">
                    {language === 'bn'
                      ? 'সম্পূর্ণ পরিমাণ অগ্রিম ব্যালেন্সে জমা'
                      : 'Advance Only: Add Entire Payment to Advance Balance'}
                  </option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'bn' ? '১০. মন্তব্য' : '10. Notes'}
                </label>
                <input
                  type="text"
                  disabled={step === 'CONFIRM'}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    disabled={step === 'CONFIRM' || !selectedMember.whatsappConsent}
                    checked={sendWhatsApp && selectedMember.whatsappConsent}
                    onChange={(e) => setSendWhatsApp(e.target.checked)}
                  />
                  <span>
                    {selectedMember.whatsappConsent
                      ? language === 'bn'
                        ? 'সংরক্ষণের পর অফিসিয়াল হোয়াটসঅ্যাপ রসিদ পাঠান'
                        : 'Send official WhatsApp template receipt after saving'
                      : language === 'bn'
                      ? 'সদস্য হোয়াটসঅ্যাপ সম্মতি দেননি (WhatsApp disabled)'
                      : 'Member has not opted into WhatsApp notifications'}
                  </span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              {step === 'FORM' ? (
                <button
                  type="button"
                  disabled={rupeesToPaise(amountRupees) <= 0}
                  onClick={() => setStep('CONFIRM')}
                  className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-[#0F2143] text-white hover:bg-[#162D59] disabled:opacity-50"
                >
                  {t(language, 'confirmPayment')}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setStep('FORM')}
                    className="px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700"
                  >
                    {t(language, 'backToEdit')}
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleConfirmSubmit}
                    className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {submitting ? t(language, 'loading') : t(language, 'submitPayment')}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Live Calculation Summary */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 h-fit">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-2.5">
              {language === 'bn' ? 'স্বয়ংক্রিয় হিসাব প্রিভিউ' : 'Live Allocation Preview'}
            </h3>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Monthly Chanda</span>
                <span className="font-mono font-semibold">{formatINR(selectedMember.monthlyChandaPaise)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Month Paid So Far</span>
                <span className="font-mono">{formatINR(currentMonthLedger?.paidPaise ?? 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Outstanding</span>
                <span className="font-mono font-semibold text-amber-700">
                  {formatINR(totalOutstandingPaise)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Current Advance</span>
                <span className="font-mono">{formatINR(selectedMember.advanceBalancePaise || 0)}</span>
              </div>
            </div>

            {previewAlloc && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  {language === 'bn' ? 'এই পেমেন্টের পর:' : 'After This Payment:'}
                </div>
                {previewAlloc.allocations.map((a) => (
                  <div key={a.monthKey} className="flex justify-between text-emerald-700 dark:text-emerald-400">
                    <span>{formatMonthLabel(a.monthKey, language)}</span>
                    <span className="font-mono">+{formatINR(a.allocatedPaise)}</span>
                  </div>
                ))}
                {previewAlloc.advanceAddedPaise > 0 && (
                  <div className="flex justify-between text-[#0F2143] dark:text-amber-300 font-medium">
                    <span>Added to Advance</span>
                    <span className="font-mono">+{formatINR(previewAlloc.advanceAddedPaise)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-800 font-semibold">
                  <span>Remaining Due</span>
                  <span className="font-mono">{formatINR(previewAlloc.remainingDuePaise)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Updated Advance</span>
                  <span className="font-mono">{formatINR(previewAlloc.newAdvanceBalancePaise)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <ReceiptModal receipt={showReceiptModal ? resultReceipt : null} onClose={() => setShowReceiptModal(false)} />
    </div>
  );
};

/* =========================================================
 * Page 8: Payment History
 * ========================================================= */
export const PaymentHistoryPage: React.FC = () => {
  const { language, payments, receipts, currentUser, reversePayment } = useMaa();
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [previewReceipt, setPreviewReceipt] = useState<Receipt | null>(null);
  const [reversingPayment, setReversingPayment] = useState<Payment | null>(null);
  const [reverseReason, setReverseReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...payments]
      .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))
      .filter((p) => {
        if (methodFilter !== 'ALL' && p.paymentMethod !== methodFilter) return false;
        if (!q) return true;
        return (
          p.memberName.toLowerCase().includes(q) ||
          p.memberCode.toLowerCase().includes(q) ||
          p.receiptNumber.toLowerCase().includes(q) ||
          (p.transactionRef || '').toLowerCase().includes(q)
        );
      });
  }, [payments, search, methodFilter]);

  const canReverse = currentUser?.role === 'SUPER_ADMIN' || currentUser?.canReversePayments;

  const handleConfirmReversal = async () => {
    if (!reversingPayment || !reverseReason.trim()) return;
    setErrorMsg(null);
    try {
      await reversePayment(reversingPayment.id, reverseReason.trim());
      setReversingPayment(null);
      setReverseReason('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Reversal failed');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {t(language, 'nav_payments')}
          </h2>
          <p className="text-xs text-slate-500">{filtered.length} transactions</p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Receipt / Member / Ref..."
              className="pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
            />
          </div>
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
          >
            <option value="ALL">All Methods</option>
            <option value="CASH">Cash</option>
            <option value="UPI">UPI</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
          {errorMsg}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-950 text-xs text-slate-500 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Receipt #</th>
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Month</th>
                <th className="px-4 py-3 font-medium">Method / Ref</th>
                <th className="px-4 py-3 font-medium">Collector</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filtered.map((p) => {
                const rcp = receipts.find((r) => r.paymentId === p.id);
                return (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono text-xs">{formatDateIN(p.paymentDate)}</td>
                    <td className="px-4 py-3 font-mono text-xs font-medium">{p.receiptNumber}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{p.memberName}</div>
                      <div className="font-mono text-[11px] text-slate-500">{p.memberCode}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">{formatMonthLabel(p.monthKey, language)}</td>
                    <td className="px-4 py-3 text-xs">
                      <div>{PAYMENT_METHOD_LABELS[p.paymentMethod]?.[language] || p.paymentMethod}</div>
                      {p.transactionRef && <div className="font-mono text-[11px] text-slate-500">{p.transactionRef}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                      {p.collectedByName}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">
                      {formatINR(p.amountPaise)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusLabel status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {rcp && (
                          <button
                            type="button"
                            onClick={() => setPreviewReceipt(rcp)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                            title="View Receipt"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canReverse && p.status === 'COMPLETED' && (
                          <button
                            type="button"
                            onClick={() => setReversingPayment(p)}
                            className="p-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
                            title="Reverse Payment"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reversal Confirmation Modal */}
      {reversingPayment && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-red-700">
              <ShieldAlert className="w-5 h-5" />
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Reverse Payment ({reversingPayment.receiptNumber})
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Financial records are never permanently deleted. Reversing marks this payment as REVERSED, voids the receipt, restores the member&apos;s ledger due, and logs an audit entry.
            </p>
            <div>
              <label className="block text-xs font-medium mb-1">Mandatory Reversal Reason *</label>
              <textarea
                rows={3}
                value={reverseReason}
                onChange={(e) => setReverseReason(e.target.value)}
                placeholder="e.g., Duplicate UPI entry or cheque bounce"
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReversingPayment(null)}
                className="px-3.5 py-2 text-xs font-medium border border-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!reverseReason.trim()}
                onClick={handleConfirmReversal}
                className="px-4 py-2 text-xs font-semibold bg-red-700 text-white rounded-lg hover:bg-red-800 disabled:opacity-50"
              >
                Confirm Reversal
              </button>
            </div>
          </div>
        </div>
      )}

      <ReceiptModal receipt={previewReceipt} onClose={() => setPreviewReceipt(null)} />
    </div>
  );
};

/* =========================================================
 * Page 9: Pending Members
 * ========================================================= */
export const PendingMembersPage: React.FC = () => {
  const {
    language,
    members,
    collectionMonths,
    ledgers,
    payments,
    setSelectedMemberId,
    setPrefillCollectMemberId,
    setActivePage,
    sendWhatsappReminder,
    sendBulkWhatsappReminders,
    currentUser,
  } = useMaa();

  const [monthFilter, setMonthFilter] = useState('ALL');
  const [areaFilter, setAreaFilter] = useState('ALL');
  const [collectorFilter, setCollectorFilter] = useState('ALL');
  const [minDueRupees, setMinDueRupees] = useState('0');
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [sendingBulk, setSendingBulk] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState<string | null>(null);

  const areas = useMemo(
    () => Array.from(new Set(members.map((m) => m.area).filter(Boolean) as string[])).sort(),
    [members]
  );
  const collectors = useMemo(
    () => Array.from(new Set(members.map((m) => m.assignedCollectorName).filter(Boolean) as string[])).sort(),
    [members]
  );

  const pendingRows = useMemo(() => {
    const minPaise = rupeesToPaise(minDueRupees);
    return members
      .filter((m) => m.status === 'ACTIVE')
      .map((m) => {
        const relevantLedgers = ledgers.filter(
          (l) =>
            l.memberId === m.id &&
            (monthFilter === 'ALL' || l.monthKey === monthFilter) &&
            l.duePaise > l.paidPaise
        );
        const totalDuePaise = relevantLedgers.reduce(
          (acc, l) => acc + (l.duePaise - l.paidPaise),
          0
        );
        const summary = computeMemberFinancialSummary(m, ledgers, payments);
        return {
          member: m,
          totalDuePaise,
          pendingMonths: relevantLedgers.map((l) => l.monthKey).sort(),
          lastPaymentDate: summary.lastPaymentDate,
        };
      })
      .filter((r) => {
        if (r.totalDuePaise <= 0 || r.totalDuePaise < minPaise) return false;
        if (areaFilter !== 'ALL' && r.member.area !== areaFilter) return false;
        if (collectorFilter !== 'ALL' && r.member.assignedCollectorName !== collectorFilter)
          return false;
        return true;
      })
      .sort((a, b) => b.totalDuePaise - a.totalDuePaise);
  }, [members, ledgers, payments, monthFilter, areaFilter, collectorFilter, minDueRupees]);

  const eligibleForBulk = pendingRows.filter((r) => r.member.whatsappConsent);

  const handleBulkSend = async () => {
    setSendingBulk(true);
    setBulkFeedback(null);
    try {
      const results = await sendBulkWhatsappReminders(
        eligibleForBulk.map((r) => ({
          member: r.member,
          pendingMonthsText:
            r.pendingMonths.map((mk) => formatMonthLabel(mk, language)).join(', '),
          totalDuePaise: r.totalDuePaise,
        }))
      );
      const sent = results.filter((x) => x.status === 'SENT').length;
      const failed = results.filter((x) => x.status === 'FAILED').length;
      setBulkFeedback(
        `Processed ${results.length} opted-in members (max 25/batch): ${sent} SENT, ${failed} FAILED. Check WhatsApp Logs for details.`
      );
    } catch (err) {
      setBulkFeedback(err instanceof Error ? err.message : 'Bulk send failed');
    } finally {
      setSendingBulk(false);
      setBulkConfirmOpen(false);
    }
  };

  const canBulk =
    currentUser?.role === 'SUPER_ADMIN' || currentUser?.canSendBulkWhatsApp;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {t(language, 'nav_pending')}
          </h2>
          <p className="text-xs text-slate-500">
            {pendingRows.length} members with pending dues · {eligibleForBulk.length} opted-in for WhatsApp
          </p>
        </div>

        {canBulk && (
          <button
            type="button"
            disabled={eligibleForBulk.length === 0 || sendingBulk}
            onClick={() => setBulkConfirmOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-45"
          >
            <Send className="w-3.5 h-3.5" />
            {language === 'bn'
              ? `সম্মতিপ্রাপ্তদের রিমাইন্ডার পাঠান (${eligibleForBulk.length})`
              : `Bulk WhatsApp Reminder (${eligibleForBulk.length} Opted-in)`}
          </button>
        )}
      </div>

      {bulkFeedback && (
        <div className="p-3.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
          {bulkFeedback}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <select
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
        >
          <option value="ALL">All Pending Months</option>
          {collectionMonths.map((cm) => (
            <option key={cm.monthKey} value={cm.monthKey}>
              {formatMonthLabel(cm.monthKey, language)}
            </option>
          ))}
        </select>
        <select
          value={areaFilter}
          onChange={(e) => setAreaFilter(e.target.value)}
          className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
        >
          <option value="ALL">All Areas</option>
          {areas.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select
          value={collectorFilter}
          onChange={(e) => setCollectorFilter(e.target.value)}
          className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
        >
          <option value="ALL">All Collectors</option>
          {collectors.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          type="number"
          min="0"
          value={minDueRupees}
          onChange={(e) => setMinDueRupees(e.target.value)}
          placeholder="Min Outstanding (₹)"
          className="px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-950 text-xs text-slate-500 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Mobile</th>
                <th className="px-4 py-3 font-medium text-right">Monthly</th>
                <th className="px-4 py-3 font-medium text-right">Total Due</th>
                <th className="px-4 py-3 font-medium">Months Pending</th>
                <th className="px-4 py-3 font-medium">Last Payment</th>
                <th className="px-4 py-3 font-medium">Collector</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {pendingRows.map((r) => (
                <tr key={r.member.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{r.member.fullName}</div>
                    <div className="font-mono text-[11px] text-slate-500">{r.member.memberCode} · {r.member.area}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{r.member.mobile}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{formatINR(r.member.monthlyChandaPaise)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold tabular-nums text-amber-700">
                    {formatINR(r.totalDuePaise)}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.pendingMonths.length} ({r.pendingMonths.join(', ')})
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{formatDateIN(r.lastPaymentDate)}</td>
                  <td className="px-4 py-3 text-xs">{r.member.assignedCollectorName || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMemberId(r.member.id);
                          setActivePage('member-details');
                        }}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700"
                        title="View Member"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPrefillCollectMemberId(r.member.id);
                          setActivePage('collect');
                        }}
                        className="p-1.5 rounded-lg bg-[#0F2143] text-white"
                        title="Collect Payment"
                      >
                        <IndianRupee className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={!r.member.whatsappConsent}
                        onClick={async () => {
                          try {
                            const res = await sendWhatsappReminder(
                              r.member,
                              r.pendingMonths.map((mk) => formatMonthLabel(mk, language)).join(', '),
                              r.totalDuePaise
                            );
                            setBulkFeedback(
                              res.status === 'FAILED'
                                ? `${r.member.fullName}: Failed — ${res.errorMessage}`
                                : `${r.member.fullName}: WhatsApp ${res.status}`
                            );
                          } catch (err) {
                            setBulkFeedback(err instanceof Error ? err.message : 'Error');
                          }
                        }}
                        className="p-1.5 rounded-lg bg-emerald-700 text-white disabled:opacity-40"
                        title="Send WhatsApp Reminder"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {pendingRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                    {t(language, 'noRecords')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Confirmation Modal */}
      {bulkConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold">Confirm Bulk WhatsApp Reminders</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              This will send approved WhatsApp template reminders only to{' '}
              <strong>{Math.min(25, eligibleForBulk.length)}</strong> opted-in members (rate-limited at 25/batch). Members without WhatsApp consent are automatically skipped.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBulkConfirmOpen(false)}
                className="px-3.5 py-2 text-xs font-medium border border-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={sendingBulk}
                onClick={handleBulkSend}
                className="px-4 py-2 text-xs font-semibold bg-emerald-700 text-white rounded-lg"
              >
                {sendingBulk ? 'Dispatching...' : 'Send Approved Reminders'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* =========================================================
 * Page 10: Member Ledger Matrix
 * ========================================================= */
export const MemberLedgerPage: React.FC = () => {
  const { language, members, collectionMonths, ledgers, setSelectedMemberId, setActivePage } =
    useMaa();
  const [search, setSearch] = useState('');

  const sortedMonths = useMemo(
    () => [...collectionMonths].sort((a, b) => a.monthKey.localeCompare(b.monthKey)),
    [collectionMonths]
  );

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter(
      (m) =>
        m.status !== 'ARCHIVED' &&
        (!q || m.fullName.toLowerCase().includes(q) || m.memberCode.toLowerCase().includes(q))
    );
  }, [members, search]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {t(language, 'nav_ledger')}
          </h2>
          <p className="text-xs text-slate-500">
            {language === 'bn' ? 'সকল সদস্যের মাসভিত্তিক সম্পূর্ণ লেজার ম্যাট্রিক্স' : 'Complete month-by-month dues & payment ledger matrix'}
          </p>
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search member..."
          className="px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
        />
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-3 py-3 font-medium">Member</th>
                {sortedMonths.map((cm) => (
                  <th key={cm.monthKey} className="px-3 py-3 font-medium text-center whitespace-nowrap">
                    {cm.monthKey}
                  </th>
                ))}
                <th className="px-3 py-3 font-medium text-right">Advance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredMembers.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMemberId(m.id);
                        setActivePage('member-details');
                      }}
                      className="font-semibold text-slate-900 dark:text-slate-100 hover:underline"
                    >
                      {m.memberCode} · {m.fullName}
                    </button>
                  </td>
                  {sortedMonths.map((cm) => {
                    const l = ledgers.find((x) => x.memberId === m.id && x.monthKey === cm.monthKey);
                    if (!l) {
                      return (
                        <td key={cm.monthKey} className="px-3 py-2.5 text-center text-slate-400">
                          —
                        </td>
                      );
                    }
                    const color =
                      l.status === 'PAID'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : l.status === 'PARTIAL'
                        ? 'text-amber-700 dark:text-amber-400'
                        : 'text-red-700 dark:text-red-400';
                    return (
                      <td key={cm.monthKey} className={`px-3 py-2.5 text-center font-mono tabular-nums ${color}`}>
                        {formatINR(l.paidPaise)}/{formatINR(l.duePaise)}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-[#0F2143] dark:text-amber-300">
                    {formatINR(m.advanceBalancePaise || 0)}
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

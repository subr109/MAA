import React from 'react';
import { Download, Printer, Send, X } from 'lucide-react';
import { Receipt } from '../types/maa';
import { useMaa } from '../context/MaaContext';
import { formatDateIN, formatINR, formatMonthLabel } from '../lib/chandaEngine';
import { downloadReceiptPDF } from '../lib/exporters';
import { PAYMENT_METHOD_LABELS, t } from '../lib/i18n';
import { buildReceiptMessageBody } from '../lib/whatsappTemplates';
import { MaaLogo } from './MaaLogo';
import { StatusLabel } from './StatusLabel';

interface ReceiptModalProps {
  receipt: Receipt | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ receipt, onClose }) => {
  const { settings, language, members } = useMaa();

  if (!receipt) return null;

  const member = members.find((m) => m.id === receipt.memberId);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    downloadReceiptPDF(receipt, settings);
  };

  const handleWhatsAppShareText = () => {
    const msg = buildReceiptMessageBody(
      {
        memberName: receipt.memberName,
        monthKey: receipt.monthKey,
        amountPaise: receipt.amountPaise,
        paymentDate: receipt.paymentDate,
        receiptNumber: receipt.receiptNumber,
        remainingDuePaise: receipt.remainingDuePaise,
        committeeName: settings.committeeName,
      },
      language
    );
    if (navigator.clipboard) {
      navigator.clipboard.writeText(msg);
    }
    const phone = (receipt.mobile || member?.whatsappNumber || member?.mobile || '').replace(/\D/g, '');
    const waUrl = `https://wa.me/${phone.length === 10 ? '91' + phone : phone}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-xl w-full overflow-hidden shadow-lg">
        {/* Modal Action Bar */}
        <div className="no-print flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {language === 'bn' ? 'ডিজিটাল পেমেন্ট রসিদ' : 'Digital Payment Receipt'}
            </span>
            <span className="text-slate-400">·</span>
            <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
              {receipt.receiptNumber}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable Receipt Body */}
        <div className="p-6 space-y-5">
          <div className="bg-[#0F2143] text-white rounded-lg p-5 flex items-start justify-between gap-4 border-b-4 border-[#EA580C]">
            <div className="flex items-center gap-3.5">
              <MaaLogo size={46} />
              <div>
                <h3 className="text-lg font-bold tracking-tight">MAA · Monthly Association Account</h3>
                <p className="text-xs text-slate-200 mt-0.5">{settings.committeeName}</p>
                {settings.committeeAddress && (
                  <p className="text-[11px] text-slate-300 mt-0.5">{settings.committeeAddress}</p>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[11px] text-amber-300 font-medium">
                {receipt.status === 'VOID' ? 'VOID RECEIPT' : 'OFFICIAL RECEIPT'}
              </div>
              <div className="font-mono text-xs mt-1">{receipt.receiptNumber}</div>
              <div className="font-mono text-xs text-slate-300 mt-0.5">
                {formatDateIN(receipt.paymentDate)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'bn' ? 'সদস্যের নাম' : 'Member Name'}
              </div>
              <div className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                {receipt.memberName}
              </div>
              <div className="font-mono text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                {receipt.memberCode} · {receipt.mobile || '—'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'bn' ? 'চাঁদার মাস' : 'Payment Month'}
              </div>
              <div className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                {formatMonthLabel(receipt.monthKey, language)}
              </div>
              <div className="mt-1 flex justify-end">
                <StatusLabel status={receipt.status} />
              </div>
            </div>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-lg divide-y divide-slate-200 dark:divide-slate-800 text-sm">
            <div className="flex justify-between px-4 py-2.5">
              <span className="text-slate-600 dark:text-slate-400">
                {language === 'bn' ? 'জমার পরিমাণ' : 'Amount Paid'}
              </span>
              <span className="font-mono font-bold text-base text-[#0F2143] dark:text-amber-300 tabular-nums">
                {formatINR(receipt.amountPaise)}
              </span>
            </div>
            <div className="flex justify-between px-4 py-2">
              <span className="text-slate-600 dark:text-slate-400">
                {language === 'bn' ? 'পেমেন্ট মাধ্যম' : 'Payment Method'}
              </span>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {PAYMENT_METHOD_LABELS[receipt.paymentMethod]?.[language] || receipt.paymentMethod}
              </span>
            </div>
            {receipt.transactionRef && (
              <div className="flex justify-between px-4 py-2">
                <span className="text-slate-600 dark:text-slate-400">
                  {language === 'bn' ? 'ট্রানজ্যাকশন আইডি' : 'Transaction ID'}
                </span>
                <span className="font-mono text-xs text-slate-800 dark:text-slate-200">
                  {receipt.transactionRef}
                </span>
              </div>
            )}
            <div className="flex justify-between px-4 py-2">
              <span className="text-slate-600 dark:text-slate-400">
                {language === 'bn' ? 'পূর্ববর্তী বকেয়া' : 'Previous Due'}
              </span>
              <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
                {formatINR(receipt.previousDuePaise)}
              </span>
            </div>
            <div className="flex justify-between px-4 py-2">
              <span className="text-slate-600 dark:text-slate-400">
                {language === 'bn' ? 'অবশিষ্ট বকেয়া' : 'Remaining Due'}
              </span>
              <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                {formatINR(receipt.remainingDuePaise)}
              </span>
            </div>
            <div className="flex justify-between px-4 py-2">
              <span className="text-slate-600 dark:text-slate-400">
                {language === 'bn' ? 'অগ্রিম ব্যালেন্স' : 'Advance Balance'}
              </span>
              <span className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                {formatINR(receipt.advanceBalancePaise)}
              </span>
            </div>
            <div className="flex justify-between px-4 py-2">
              <span className="text-slate-600 dark:text-slate-400">
                {language === 'bn' ? 'সংগ্রহকারী' : 'Collector Name'}
              </span>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {receipt.collectorName}
              </span>
            </div>
          </div>

          <p className="text-center text-xs text-slate-500 dark:text-slate-400">
            {t(language, 'tagline')} · {settings.contactNumber}
          </p>
        </div>

        {/* Footer Buttons */}
        <div className="no-print flex flex-wrap items-center justify-end gap-2.5 px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            {t(language, 'print')}
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg bg-[#0F2143] text-white hover:bg-[#162D59] whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            {t(language, 'downloadPdf')}
          </button>
          <button
            type="button"
            onClick={handleWhatsAppShareText}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 whitespace-nowrap"
          >
            <Send className="w-3.5 h-3.5" />
            {language === 'bn' ? 'হোয়াটসঅ্যাপে শেয়ার' : 'Share on WhatsApp'}
          </button>
        </div>
      </div>
    </div>
  );
};

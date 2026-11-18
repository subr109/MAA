import { Language } from '../types/maa';
import { formatDateIN, formatINR, formatMonthLabel } from './chandaEngine';

export interface ReceiptTemplateVars {
  memberName: string;
  monthKey: string;
  amountPaise: number;
  paymentDate: string;
  receiptNumber: string;
  remainingDuePaise: number;
  committeeName?: string;
}

export interface ReminderTemplateVars {
  memberName: string;
  pendingMonthsText: string;
  totalDuePaise: number;
  committeeName: string;
}

export const DEFAULT_COMMITTEE_NAME = 'শ্রী শ্রী শ্যামা পূজা মাশুন্ডা বুনিয়াদি স্কুল মাঠ কমিটি';

export function buildReceiptMessageBody(vars: ReceiptTemplateVars, lang: Language): string {
  const monthLabel = formatMonthLabel(vars.monthKey, lang);
  const amountStr = formatINR(vars.amountPaise).replace('₹', '');
  const dateStr = formatDateIN(vars.paymentDate);
  const dueStr = formatINR(vars.remainingDuePaise).replace('₹', '');
  const committee = vars.committeeName || DEFAULT_COMMITTEE_NAME;

  if (lang === 'bn') {
    return `নমস্কার ${vars.memberName},
আপনার ${monthLabel} মাসের পুজোর চাঁদা সফলভাবে জমা হয়েছে।
জমার পরিমাণ: ₹${amountStr}
জমার তারিখ: ${dateStr}
রসিদ নম্বর: ${vars.receiptNumber}
বর্তমান বকেয়া: ₹${dueStr}
${committee}-এর পক্ষ থেকে ধন্যবাদ।
🙏 শুভেচ্ছান্তে।`;
  }

  return `Dear ${vars.memberName},
Your Puja Chanda payment has been successfully recorded.
Month: ${monthLabel}
Amount Paid: ₹${amountStr}
Payment Date: ${dateStr}
Receipt Number: ${vars.receiptNumber}
Outstanding Balance: ₹${dueStr}
Thank you for supporting ${committee}.
- MAA Puja Committee`;
}

export function buildReminderMessageBody(vars: ReminderTemplateVars, lang: Language): string {
  const dueStr = formatINR(vars.totalDuePaise).replace('₹', '');
  if (lang === 'bn') {
    return `নমস্কার ${vars.memberName},
আপনার ${vars.pendingMonthsText} মাসের পুজোর চাঁদা বাবদ মোট ₹${dueStr} বকেয়া রয়েছে। অনুগ্রহ করে সুবিধামতো সময়ে জমা দিয়ে ডিজিটাল রসিদ সংগ্রহ করুন।
ধন্যবাদান্তে — ${vars.committeeName}`;
  }
  return `Dear ${vars.memberName},
This is a gentle reminder that your Puja Chanda of ₹${dueStr} for ${vars.pendingMonthsText} is currently pending. Kindly remit at your convenience to receive your digital receipt.
Regards — ${vars.committeeName}`;
}

export function formatWhatsAppE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return digits;
}

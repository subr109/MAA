export type Language = 'bn' | 'en';
export type UserRole = 'SUPER_ADMIN' | 'COLLECTION_ADMIN' | 'MEMBER';
export type MemberCategory = 'GENERAL' | 'PATRON' | 'SENIOR' | 'YOUTH' | 'FAMILY';
export type MemberStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type PaymentMethod = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'OTHER';
export type AllocationMode = 'AUTO_OLDEST' | 'MANUAL' | 'ADVANCE';
export type PaymentStatus = 'COMPLETED' | 'REVERSED';
export type LedgerStatus = 'UNPAID' | 'PARTIAL' | 'PAID';
export type ReceiptStatus = 'ACTIVE' | 'VOID';
export type ExpenseCategory =
  | 'PUJA_DECORATION'
  | 'LIGHTING'
  | 'SOUND_SYSTEM'
  | 'IDOL'
  | 'FLOWERS'
  | 'PRASAD'
  | 'FOOD_DISTRIBUTION'
  | 'SECURITY'
  | 'ELECTRICITY'
  | 'TRANSPORTATION'
  | 'MISCELLANEOUS';
export type WhatsappStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
export type WhatsappType = 'RECEIPT' | 'REMINDER' | 'ANNOUNCEMENT';
export type AnnouncementCategory =
  | 'PUJA_SCHEDULE'
  | 'MEETING_NOTICE'
  | 'CULTURAL_PROGRAM'
  | 'COLLECTION_UPDATE'
  | 'IMPORTANT'
  | 'EMERGENCY';

// Validation Synchronicity Constants (synchronized with firebase-blueprint.json & firestore.rules)
export const VALIDATION_LIMITS = {
  ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
  MEMBER_CODE_PATTERN: /^MAA-[0-9]{4,}$/,
  MONTH_KEY_PATTERN: /^[0-9]{4}-[0-9]{2}$/,
  MAX_NAME_LENGTH: 120,
  MAX_MOBILE_LENGTH: 20,
  MAX_ADDRESS_LENGTH: 300,
  MAX_AREA_LENGTH: 100,
  MAX_NOTES_LENGTH: 500,
  MAX_DESCRIPTION_LENGTH: 300,
  MAX_ALLOCATIONS_COUNT: 24,
  MAX_ANNOUNCEMENT_TITLE: 200,
  MAX_ANNOUNCEMENT_BODY: 2000,
} as const;

export interface AppUser {
  id: string;
  uid: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  memberId?: string;
  status: 'ACTIVE' | 'INACTIVE';
  canAddMembers: boolean;
  canReversePayments: boolean;
  canManageExpenses: boolean;
  canSendBulkWhatsApp: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Member {
  id: string;
  memberCode: string;
  fullName: string;
  mobile: string;
  whatsappNumber?: string;
  address?: string;
  area?: string;
  joiningDate?: string;
  monthlyChandaPaise: number;
  category: MemberCategory;
  status: MemberStatus;
  whatsappConsent: boolean;
  notes?: string;
  photoUrl?: string;
  assignedCollectorUid?: string;
  assignedCollectorName?: string;
  advanceBalancePaise: number;
  userUid?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionMonth {
  id: string;
  monthKey: string; // YYYY-MM
  label: string;
  financialYear: string;
  defaultAmountPaise: number;
  dueDate?: string;
  status: 'OPEN' | 'CLOSED';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentAllocationItem {
  monthKey: string;
  allocatedPaise: number;
}

export interface Payment {
  id: string;
  transactionId: string;
  receiptNumber: string;
  memberId: string;
  memberCode: string;
  memberName: string;
  memberUserUid?: string;
  monthKey: string;
  amountPaise: number;
  paymentDate: string; // YYYY-MM-DD
  paymentMethod: PaymentMethod;
  transactionRef?: string;
  collectedByUid: string;
  collectedByName: string;
  allocationMode: AllocationMode;
  allocations: PaymentAllocationItem[];
  advanceAddedPaise: number;
  previousDuePaise: number;
  remainingDuePaise: number;
  status: PaymentStatus;
  reversalReason?: string;
  reversedBy?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemberLedger {
  id: string; // ${memberId}_${monthKey}
  memberId: string;
  memberCode: string;
  memberUserUid?: string;
  monthKey: string;
  duePaise: number;
  paidPaise: number;
  status: LedgerStatus;
  updatedAt: string;
}

export interface Receipt {
  id: string;
  receiptNumber: string;
  paymentId: string;
  memberId: string;
  memberCode: string;
  memberName: string;
  memberUserUid?: string;
  mobile?: string;
  monthKey: string;
  amountPaise: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  transactionRef?: string;
  previousDuePaise: number;
  remainingDuePaise: number;
  advanceBalancePaise: number;
  collectorName: string;
  status: ReceiptStatus;
  createdBy: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  expenseCode: string;
  expenseDate: string;
  category: ExpenseCategory;
  description: string;
  amountPaise: number;
  vendorName?: string;
  paymentMethod: PaymentMethod;
  attachmentName?: string;
  attachmentDataUrl?: string;
  addedByUid: string;
  addedByName: string;
  notes?: string;
  status: 'ACTIVE' | 'ARCHIVED';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsappNotification {
  id: string;
  notificationId: string;
  memberId: string;
  memberName: string;
  recipientPhone: string;
  type: WhatsappType;
  templateName: string;
  language: Language;
  messageBody?: string;
  relatedPaymentId?: string;
  metaMessageId?: string;
  status: WhatsappStatus;
  errorMessage?: string;
  sentByUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface Announcement {
  id: string;
  titleBn: string;
  titleEn: string;
  bodyBn: string;
  bodyEn: string;
  category: AnnouncementCategory;
  publishDate: string;
  status: 'PUBLISHED' | 'ARCHIVED';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  entityType: string;
  recordId: string;
  previousValue?: string;
  newValue?: string;
  createdAt: string;
}

export interface CommitteeSettings {
  id: string;
  committeeName: string;
  committeeAddress?: string;
  contactNumber?: string;
  email?: string;
  pujaYear?: string;
  defaultMonthlyChandaPaise: number;
  financialYear: string;
  dueDay?: number;
  collectionStartDate?: string;
  collectionEndDate?: string;
  whatsappEnabled: boolean;
  whatsappPhoneNumberId?: string;
  whatsappBusinessAccountId?: string;
  whatsappApiVersion?: string;
  whatsappReceiptTemplate?: string;
  whatsappReminderTemplate?: string;
  whatsappAnnouncementTemplate?: string;
  whatsappDefaultLanguage?: Language;
  defaultLanguage: Language;
  theme?: 'light' | 'dark';
  ledgerResetAt?: string;
  updatedBy?: string;
  updatedAt: string;
}

export type PageId =
  | 'dashboard'
  | 'members'
  | 'add-member'
  | 'member-details'
  | 'monthly-collection'
  | 'collect'
  | 'payments'
  | 'pending'
  | 'ledger'
  | 'receipts'
  | 'qr-scanner'
  | 'expenses'
  | 'reports'
  | 'whatsapp'
  | 'announcements'
  | 'admins'
  | 'audit-logs'
  | 'settings';

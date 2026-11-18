import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  AllocationMode,
  Announcement,
  AppUser,
  AuditLog,
  CollectionMonth,
  CommitteeSettings,
  Expense,
  Language,
  Member,
  MemberLedger,
  PageId,
  Payment,
  PaymentMethod,
  Receipt,
  UserRole,
  WhatsappNotification,
} from '../types/maa';
import {
  auth,
  BOOTSTRAPPED_SUPER_ADMIN_EMAIL,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  testFirestoreConnection,
} from '../lib/firebase';
import {
  calculatePaymentAllocation,
  deriveLedgerStatus,
  formatMonthLabel,
  generateExpenseCode,
  generateNextMemberCode,
  generateReceiptNumber,
  getCurrentISTDateISO,
  isDuplicateTransaction,
} from '../lib/chandaEngine';
import { buildCommitteeDataset } from '../lib/committeeData';
import {
  buildReceiptMessageBody,
  buildReminderMessageBody,
  formatWhatsAppE164,
} from '../lib/whatsappTemplates';

export interface ServerWhatsappHealth {
  tokenConfigured: boolean;
  phoneNumberIdConfigured: boolean;
  businessAccountIdConfigured: boolean;
  webhookVerifyConfigured: boolean;
  apiVersion: string;
}

export interface RecordPaymentInput {
  memberId: string;
  monthKey: string;
  amountPaise: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  transactionRef?: string;
  allocationMode: AllocationMode;
  notes?: string;
  sendWhatsApp: boolean;
  transactionId: string;
}

export interface RecordPaymentOutput {
  payment: Payment;
  receipt: Receipt;
  whatsappNotification?: WhatsappNotification;
}

interface MaaContextValue {
  mode: 'NONE' | 'MEMBER_PORTAL' | 'LOCAL_ADMIN' | 'FIREBASE';
  authReady: boolean;
  firebaseConnected: boolean;
  currentUser: AppUser | null;
  language: Language;
  setLanguage: (lang: Language) => void;
  activePage: PageId;
  setActivePage: (page: PageId) => void;
  selectedMemberId: string | null;
  setSelectedMemberId: (id: string | null) => void;
  selectedMonthKey: string;
  setSelectedMonthKey: (mk: string) => void;
  prefillCollectMemberId: string | null;
  setPrefillCollectMemberId: (id: string | null) => void;
  // Data collections
  users: AppUser[];
  members: Member[];
  collectionMonths: CollectionMonth[];
  ledgers: MemberLedger[];
  payments: Payment[];
  receipts: Receipt[];
  expenses: Expense[];
  whatsappNotifications: WhatsappNotification[];
  announcements: Announcement[];
  auditLogs: AuditLog[];
  settings: CommitteeSettings;
  serverWhatsappHealth: ServerWhatsappHealth;
  // Auth actions
  loginWithGoogle: () => Promise<void>;
  loginWithAdminCredentials: (adminId: string, password: string) => Promise<void>;
  enterMemberPortal: (memberIdentifier?: string) => void;
  resetToFreshCommitteeLedger: () => void;
  logout: () => Promise<void>;
  refreshServerHealth: () => Promise<void>;
  // Domain actions
  addMember: (payload: Omit<Member, 'id' | 'memberCode' | 'advanceBalancePaise' | 'createdBy' | 'createdAt' | 'updatedAt'>) => Promise<Member>;
  updateMember: (id: string, updates: Partial<Member>) => Promise<void>;
  importMembersBulk: (rows: Array<{ fullName: string; mobile: string; whatsappNumber?: string; address?: string; area?: string; monthlyChandaPaise: number; category: Member['category']; whatsappConsent: boolean }>) => Promise<number>;
  createCollectionMonth: (payload: { monthKey: string; financialYear: string; defaultAmountPaise: number; dueDate?: string }) => Promise<void>;
  updateLedgerDue: (memberId: string, monthKey: string, duePaise: number) => Promise<void>;
  recordPayment: (input: RecordPaymentInput) => Promise<RecordPaymentOutput>;
  reversePayment: (paymentId: string, reason: string) => Promise<void>;
  addExpense: (payload: Omit<Expense, 'id' | 'expenseCode' | 'addedByUid' | 'addedByName' | 'status' | 'createdBy' | 'createdAt' | 'updatedAt'>) => Promise<Expense>;
  archiveExpense: (expenseId: string) => Promise<void>;
  sendWhatsappReminder: (member: Member, pendingMonthsText: string, totalDuePaise: number) => Promise<WhatsappNotification>;
  sendBulkWhatsappReminders: (targets: Array<{ member: Member; pendingMonthsText: string; totalDuePaise: number }>) => Promise<WhatsappNotification[]>;
  resendWhatsappNotification: (notifId: string) => Promise<WhatsappNotification>;
  publishAnnouncement: (payload: Omit<Announcement, 'id' | 'status' | 'createdBy' | 'createdAt' | 'updatedAt'>, broadcastWhatsApp: boolean) => Promise<void>;
  saveAdminUser: (payload: { email: string; name: string; role: UserRole; phone?: string; canAddMembers: boolean; canReversePayments: boolean; canManageExpenses: boolean; canSendBulkWhatsApp: boolean; existingUid?: string }) => Promise<void>;
  toggleAdminStatus: (userId: string) => Promise<void>;
  updateSettings: (updates: Partial<CommitteeSettings>) => Promise<void>;
  restoreBackupJson: (jsonText: string) => Promise<void>;
  syncWebhookStatuses: () => Promise<void>;
}

const MaaContext = createContext<MaaContextValue | null>(null);

export const useMaa = () => {
  const ctx = useContext(MaaContext);
  if (!ctx) throw new Error('useMaa must be used inside MaaProvider');
  return ctx;
};

const DEFAULT_COMMITTEE_DATA = buildCommitteeDataset();

function sanitizeForId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}

function stripUndefined<T extends object>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

const ADMIN_SESSION_STORAGE_KEY = 'maa_mashunda_admin_session_v1';
const MEMBER_SESSION_STORAGE_KEY = 'maa_mashunda_member_session_v1';
const ADMIN_STATE_STORAGE_KEY = 'maa_mashunda_admin_state_v1';

interface PersistedLocalCommitteeState {
  users: AppUser[];
  members: Member[];
  collectionMonths: CollectionMonth[];
  ledgers: MemberLedger[];
  payments: Payment[];
  receipts: Receipt[];
  expenses: Expense[];
  whatsappNotifications: WhatsappNotification[];
  announcements: Announcement[];
  auditLogs: AuditLog[];
  settings: CommitteeSettings;
}

export const MaaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<'NONE' | 'MEMBER_PORTAL' | 'LOCAL_ADMIN' | 'FIREBASE'>('NONE');
  const [authReady, setAuthReady] = useState(false);
  const [firebaseConnected, setFirebaseConnected] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);

  const [language, setLanguageState] = useState<Language>('bn');
  const [activePage, setActivePage] = useState<PageId>('dashboard');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>('2026-11');
  const [prefillCollectMemberId, setPrefillCollectMemberId] = useState<string | null>(null);

  // Collections State
  const [users, setUsers] = useState<AppUser[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [collectionMonths, setCollectionMonths] = useState<CollectionMonth[]>([]);
  const [ledgers, setLedgers] = useState<MemberLedger[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [whatsappNotifications, setWhatsappNotifications] = useState<WhatsappNotification[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<CommitteeSettings>(DEFAULT_COMMITTEE_DATA.settings);
  const [serverWhatsappHealth, setServerWhatsappHealth] = useState<ServerWhatsappHealth>({
    tokenConfigured: false,
    phoneNumberIdConfigured: false,
    businessAccountIdConfigured: false,
    webhookVerifyConfigured: false,
    apiVersion: 'v21.0',
  });

  const refreshServerHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const json = (await res.json()) as { whatsapp?: ServerWhatsappHealth };
        if (json.whatsapp) setServerWhatsappHealth(json.whatsapp);
      }
    } catch {
      // Ignore transient health check error
    }
  }, []);

  useEffect(() => {
    refreshServerHealth();
    testFirestoreConnection().then(setFirebaseConnected);
  }, [refreshServerHealth]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    document.documentElement.lang = lang;
  }, []);

  // Theme synchronization with dark class
  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme]);

  // Restore persisted Committee Admin or Member Portal session if present and not signed into Firebase
  useEffect(() => {
    try {
      const rawAdminSession = localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
      if (rawAdminSession) {
        const savedUser = JSON.parse(rawAdminSession) as AppUser;
        const rawState = localStorage.getItem(ADMIN_STATE_STORAGE_KEY);
        const dataset = rawState
          ? (JSON.parse(rawState) as PersistedLocalCommitteeState)
          : buildCommitteeDataset();
        setUsers(dataset.users);
        setMembers(dataset.members);
        setCollectionMonths(dataset.collectionMonths);
        setLedgers(dataset.ledgers);
        setPayments(dataset.payments);
        setReceipts(dataset.receipts);
        setExpenses(dataset.expenses);
        setWhatsappNotifications(dataset.whatsappNotifications);
        setAnnouncements(dataset.announcements);
        setAuditLogs(dataset.auditLogs);
        setSettings(dataset.settings);
        setCurrentUser(savedUser);
        setMode('LOCAL_ADMIN');
        return;
      }

      const rawMemberSession = localStorage.getItem(MEMBER_SESSION_STORAGE_KEY);
      if (rawMemberSession) {
        const savedMemberId = String(rawMemberSession);
        const rawState = localStorage.getItem(ADMIN_STATE_STORAGE_KEY);
        const dataset = rawState
          ? (JSON.parse(rawState) as PersistedLocalCommitteeState)
          : buildCommitteeDataset();
        const target = dataset.members.find((m) => m.id === savedMemberId);
        if (target) {
          setUsers([]);
          setMembers([target]);
          setCollectionMonths(dataset.collectionMonths);
          setLedgers(dataset.ledgers.filter((l) => l.memberId === target.id));
          setPayments(dataset.payments.filter((p) => p.memberId === target.id));
          setReceipts(dataset.receipts.filter((r) => r.memberId === target.id));
          setExpenses([]);
          setWhatsappNotifications([]);
          setAnnouncements(dataset.announcements.filter((a) => a.status === 'PUBLISHED'));
          setAuditLogs([]);
          setSettings(dataset.settings);
          setCurrentUser({
            id: `member-portal-${target.id}`,
            uid: `member-portal-${target.id}`,
            name: target.fullName,
            email: '',
            phone: target.mobile,
            role: 'MEMBER',
            memberId: target.id,
            status: target.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
            canAddMembers: false,
            canReversePayments: false,
            canManageExpenses: false,
            canSendBulkWhatsApp: false,
            createdAt: target.createdAt,
            updatedAt: target.updatedAt,
          });
          setSelectedMemberId(target.id);
          setActivePage('member-details');
          setMode('MEMBER_PORTAL');
        }
      }
    } catch {
      // Ignore malformed local session storage
    }
  }, []);

  // Persist Committee Admin local workspace automatically
  useEffect(() => {
    if (mode !== 'LOCAL_ADMIN' || !currentUser) return;
    try {
      const snapshot: PersistedLocalCommitteeState = {
        users,
        members,
        collectionMonths,
        ledgers,
        payments,
        receipts,
        expenses,
        whatsappNotifications,
        announcements,
        auditLogs,
        settings,
      };
      localStorage.setItem(ADMIN_STATE_STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // Ignore storage quota errors
    }
  }, [
    mode,
    currentUser,
    users,
    members,
    collectionMonths,
    ledgers,
    payments,
    receipts,
    expenses,
    whatsappNotifications,
    announcements,
    auditLogs,
    settings,
  ]);

  // Firebase Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (!fbUser) {
        setAuthReady(true);
        setMode((prev) => {
          if (prev === 'FIREBASE') {
            setCurrentUser(null);
            return 'NONE';
          }
          return prev;
        });
        return;
      }

      try {
        const isBootstrappedAdmin =
          fbUser.emailVerified && fbUser.email?.toLowerCase() === BOOTSTRAPPED_SUPER_ADMIN_EMAIL.toLowerCase();

        const userRef = doc(db, 'users', fbUser.uid);
        const adminRef = doc(db, 'admins', fbUser.uid);

        let userSnap = await getDoc(userRef);
        let adminSnap = await getDoc(adminRef);

        if (isBootstrappedAdmin && !adminSnap.exists()) {
          await setDoc(adminRef, {
            uid: fbUser.uid,
            email: fbUser.email || BOOTSTRAPPED_SUPER_ADMIN_EMAIL,
            role: 'SUPER_ADMIN',
            active: true,
            createdAt: serverTimestamp(),
          });
          adminSnap = await getDoc(adminRef);
        }

        const adminData = adminSnap.exists() ? adminSnap.data() : null;
        const resolvedRole: UserRole = isBootstrappedAdmin
          ? 'SUPER_ADMIN'
          : adminData?.active && adminData?.role === 'SUPER_ADMIN'
          ? 'SUPER_ADMIN'
          : adminData?.active && adminData?.role === 'COLLECTION_ADMIN'
          ? 'COLLECTION_ADMIN'
          : 'MEMBER';

        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: fbUser.uid,
            name: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
            email: fbUser.email || '',
            role: resolvedRole,
            status: 'ACTIVE',
            canAddMembers: resolvedRole !== 'MEMBER',
            canReversePayments: resolvedRole === 'SUPER_ADMIN',
            canManageExpenses: resolvedRole !== 'MEMBER',
            canSendBulkWhatsApp: resolvedRole === 'SUPER_ADMIN',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          userSnap = await getDoc(userRef);
        }

        const uData = userSnap.data() || {};
        const appUser: AppUser = {
          id: fbUser.uid,
          uid: fbUser.uid,
          name: String(uData.name || fbUser.displayName || 'User'),
          email: String(uData.email || fbUser.email || ''),
          phone: uData.phone ? String(uData.phone) : undefined,
          role: resolvedRole,
          memberId: uData.memberId ? String(uData.memberId) : undefined,
          status: uData.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
          canAddMembers: Boolean(uData.canAddMembers ?? resolvedRole !== 'MEMBER'),
          canReversePayments: Boolean(uData.canReversePayments ?? resolvedRole === 'SUPER_ADMIN'),
          canManageExpenses: Boolean(uData.canManageExpenses ?? resolvedRole !== 'MEMBER'),
          canSendBulkWhatsApp: Boolean(uData.canSendBulkWhatsApp ?? resolvedRole === 'SUPER_ADMIN'),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        setCurrentUser(appUser);
        setMode('FIREBASE');
        setAuthReady(true);
      } catch (err) {
        console.error('Firebase user bootstrap error:', err);
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

  // Attach Firestore real-time listeners strictly when authReady && mode === 'FIREBASE' && currentUser
  useEffect(() => {
    if (!authReady || mode !== 'FIREBASE' || !currentUser || !firebaseUser) return;

    const unsubs: Array<() => void> = [];
    const isAdmin = currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'COLLECTION_ADMIN';
    const isSuper = currentUser.role === 'SUPER_ADMIN';

    // 1. Settings
    unsubs.push(
      onSnapshot(
        doc(db, 'settings', 'committee'),
        (snap) => {
          if (snap.exists()) {
            const d = snap.data();
            setSettings({
              ...(DEFAULT_COMMITTEE_DATA.settings as CommitteeSettings),
              ...d,
              id: snap.id,
              updatedAt: d.updatedAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
            } as CommitteeSettings);
          }
        },
        (err) => handleFirestoreError(err, OperationType.GET, 'settings/committee')
      )
    );

    // 2. Collection Months
    unsubs.push(
      onSnapshot(
        query(collection(db, 'collectionMonths'), where('status', 'in', ['OPEN', 'CLOSED'])),
        (snap) => {
          setCollectionMonths(
            snap.docs.map((d) => ({
              ...(d.data() as CollectionMonth),
              id: d.id,
              createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() || '',
              updatedAt: d.data().updatedAt?.toDate?.()?.toISOString?.() || '',
            }))
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'collectionMonths')
      )
    );

    // 3. Announcements
    unsubs.push(
      onSnapshot(
        query(collection(db, 'announcements'), where('status', '==', 'PUBLISHED')),
        (snap) => {
          setAnnouncements(
            snap.docs.map((d) => ({
              ...(d.data() as Announcement),
              id: d.id,
              createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() || '',
              updatedAt: d.data().updatedAt?.toDate?.()?.toISOString?.() || '',
            }))
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'announcements')
      )
    );

    // 4. Members, Payments, Ledgers, Receipts
    const memberQ = isAdmin
      ? collection(db, 'members')
      : query(collection(db, 'members'), where('userUid', '==', currentUser.uid));

    unsubs.push(
      onSnapshot(
        memberQ,
        (snap) => {
          setMembers(
            snap.docs.map((d) => ({
              ...(d.data() as Member),
              id: d.id,
              createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() || '',
              updatedAt: d.data().updatedAt?.toDate?.()?.toISOString?.() || '',
            }))
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'members')
      )
    );

    const paymentQ = isAdmin
      ? collection(db, 'payments')
      : query(collection(db, 'payments'), where('memberUserUid', '==', currentUser.uid));

    unsubs.push(
      onSnapshot(
        paymentQ,
        (snap) => {
          setPayments(
            snap.docs.map((d) => ({
              ...(d.data() as Payment),
              id: d.id,
              createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() || '',
              updatedAt: d.data().updatedAt?.toDate?.()?.toISOString?.() || '',
            }))
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'payments')
      )
    );

    const ledgerQ = isAdmin
      ? collection(db, 'memberLedgers')
      : query(collection(db, 'memberLedgers'), where('memberUserUid', '==', currentUser.uid));

    unsubs.push(
      onSnapshot(
        ledgerQ,
        (snap) => {
          setLedgers(
            snap.docs.map((d) => ({
              ...(d.data() as MemberLedger),
              id: d.id,
              updatedAt: d.data().updatedAt?.toDate?.()?.toISOString?.() || '',
            }))
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'memberLedgers')
      )
    );

    const receiptQ = isAdmin
      ? collection(db, 'receipts')
      : query(collection(db, 'receipts'), where('memberUserUid', '==', currentUser.uid));

    unsubs.push(
      onSnapshot(
        receiptQ,
        (snap) => {
          setReceipts(
            snap.docs.map((d) => ({
              ...(d.data() as Receipt),
              id: d.id,
              createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() || '',
            }))
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'receipts')
      )
    );

    if (isAdmin) {
      unsubs.push(
        onSnapshot(
          collection(db, 'expenses'),
          (snap) => {
            setExpenses(
              snap.docs.map((d) => ({
                ...(d.data() as Expense),
                id: d.id,
                createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() || '',
                updatedAt: d.data().updatedAt?.toDate?.()?.toISOString?.() || '',
              }))
            );
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'expenses')
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'whatsappNotifications'),
          (snap) => {
            setWhatsappNotifications(
              snap.docs.map((d) => ({
                ...(d.data() as WhatsappNotification),
                id: d.id,
                createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() || '',
                updatedAt: d.data().updatedAt?.toDate?.()?.toISOString?.() || '',
              }))
            );
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'whatsappNotifications')
        )
      );
    }

    if (isSuper) {
      unsubs.push(
        onSnapshot(
          collection(db, 'users'),
          (snap) => {
            setUsers(
              snap.docs.map((d) => ({
                ...(d.data() as AppUser),
                id: d.id,
                createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() || '',
                updatedAt: d.data().updatedAt?.toDate?.()?.toISOString?.() || '',
              }))
            );
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'users')
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'auditLogs'),
          (snap) => {
            setAuditLogs(
              snap.docs.map((d) => ({
                ...(d.data() as AuditLog),
                id: d.id,
                createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() || '',
              }))
            );
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'auditLogs')
        )
      );
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [authReady, mode, currentUser, firebaseUser]);

  const loginWithGoogle = useCallback(async () => {
    localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    localStorage.removeItem(MEMBER_SESSION_STORAGE_KEY);
    await signInWithPopup(auth, googleProvider);
  }, []);

  const loginWithAdminCredentials = useCallback(async (adminId: string, password: string) => {
    localStorage.removeItem(MEMBER_SESSION_STORAGE_KEY);
    const res = await fetch('/api/auth/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId, password }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      user?: AppUser;
    };
    if (!res.ok || !data.ok || !data.user) {
      throw new Error(data.error || 'Invalid Admin ID or Password.');
    }

    let dataset: PersistedLocalCommitteeState;
    try {
      const rawState = localStorage.getItem(ADMIN_STATE_STORAGE_KEY);
      dataset = rawState
        ? (JSON.parse(rawState) as PersistedLocalCommitteeState)
        : buildCommitteeDataset();
    } catch {
      dataset = buildCommitteeDataset();
    }

    const adminUser = data.user;
    const mergedUsers = dataset.users.some((u) => u.uid === adminUser.uid)
      ? dataset.users
      : [adminUser, ...dataset.users];

    setUsers(mergedUsers);
    setMembers(dataset.members);
    setCollectionMonths(dataset.collectionMonths);
    setLedgers(dataset.ledgers);
    setPayments(dataset.payments);
    setReceipts(dataset.receipts);
    setExpenses(dataset.expenses);
    setWhatsappNotifications(dataset.whatsappNotifications);
    setAnnouncements(dataset.announcements);
    setAuditLogs(dataset.auditLogs);
    setSettings(dataset.settings);

    localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(adminUser));
    setCurrentUser(adminUser);
    setMode('LOCAL_ADMIN');
    setActivePage('dashboard');
  }, []);

  const enterMemberPortal = useCallback((memberIdentifier?: string) => {
    localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    let dataset: PersistedLocalCommitteeState;
    try {
      const rawState = localStorage.getItem(ADMIN_STATE_STORAGE_KEY);
      dataset = rawState
        ? (JSON.parse(rawState) as PersistedLocalCommitteeState)
        : buildCommitteeDataset();
    } catch {
      dataset = buildCommitteeDataset();
    }

    const queryText = (memberIdentifier || '').trim();
    const digitsOnly = queryText.replace(/\D/g, '').slice(-10);

    let targetMember: Member | undefined;
    if (queryText) {
      targetMember = dataset.members.find(
        (m) =>
          m.memberCode.toLowerCase() === queryText.toLowerCase() ||
          (digitsOnly.length >= 10 &&
            (m.mobile.replace(/\D/g, '').slice(-10) === digitsOnly ||
              (m.whatsappNumber || '').replace(/\D/g, '').slice(-10) === digitsOnly))
      );
      if (!targetMember) {
        throw new Error(
          'No member found matching that Member ID or 10-digit Mobile Number.'
        );
      }
    } else {
      targetMember =
        dataset.members.find((m) => m.status === 'ACTIVE') || dataset.members[0];
      if (!targetMember) {
        throw new Error(
          'No registered members exist yet. Please ask the committee admin to add members first.'
        );
      }
    }

    // Scope context strictly to the logged-in member's own records & public notices
    setUsers([]);
    setMembers([targetMember]);
    setCollectionMonths(dataset.collectionMonths);
    setLedgers(dataset.ledgers.filter((l) => l.memberId === targetMember.id));
    setPayments(dataset.payments.filter((p) => p.memberId === targetMember.id));
    setReceipts(dataset.receipts.filter((r) => r.memberId === targetMember.id));
    setExpenses([]);
    setWhatsappNotifications([]);
    setAnnouncements(dataset.announcements.filter((a) => a.status === 'PUBLISHED'));
    setAuditLogs([]);
    setSettings(dataset.settings);

    const memberUser: AppUser = {
      id: `member-portal-${targetMember.id}`,
      uid: `member-portal-${targetMember.id}`,
      name: targetMember.fullName,
      email: '',
      phone: targetMember.mobile,
      role: 'MEMBER',
      memberId: targetMember.id,
      status: targetMember.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      canAddMembers: false,
      canReversePayments: false,
      canManageExpenses: false,
      canSendBulkWhatsApp: false,
      createdAt: targetMember.createdAt,
      updatedAt: targetMember.updatedAt,
    };

    localStorage.setItem(MEMBER_SESSION_STORAGE_KEY, targetMember.id);
    setCurrentUser(memberUser);
    setSelectedMemberId(targetMember.id);
    setMode('MEMBER_PORTAL');
    setActivePage('member-details');
  }, []);

  const resetToFreshCommitteeLedger = useCallback(() => {
    if (mode !== 'LOCAL_ADMIN') return;
    const base = buildCommitteeDataset();
    const adminUsers = currentUser ? [currentUser] : base.users.slice(0, 1);
    const currentMonthKey = getCurrentISTDateISO().slice(0, 7);
    const freshMonth: CollectionMonth = {
      id: currentMonthKey,
      monthKey: currentMonthKey,
      label: formatMonthLabel(currentMonthKey, 'en'),
      financialYear: settings.financialYear || '2026-27',
      defaultAmountPaise: settings.defaultMonthlyChandaPaise || 50000,
      dueDate: `${currentMonthKey}-${String(settings.dueDay || 10).padStart(2, '0')}`,
      status: 'OPEN',
      createdBy: currentUser?.uid || 'committee-super-admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setUsers(adminUsers);
    setMembers([]);
    setCollectionMonths([freshMonth]);
    setLedgers([]);
    setPayments([]);
    setReceipts([]);
    setExpenses([]);
    setWhatsappNotifications([]);
    setAnnouncements([]);
    setAuditLogs([]);
    setSelectedMonthKey(currentMonthKey);
  }, [mode, currentUser, settings.financialYear, settings.defaultMonthlyChandaPaise, settings.dueDay]);

  const logout = useCallback(async () => {
    localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    localStorage.removeItem(MEMBER_SESSION_STORAGE_KEY);
    if (mode === 'FIREBASE') {
      await signOut(auth);
    }
    setMode('NONE');
    setCurrentUser(null);
    setSelectedMemberId(null);
    setActivePage('dashboard');
  }, [mode]);

  const appendAuditLog = useCallback(
    async (action: string, entityType: string, recordId: string, previousValue: string, newValue: string) => {
      if (!currentUser) return;
      const logId = `aud_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const entry: AuditLog = {
        id: logId,
        userId: currentUser.uid,
        userName: currentUser.name,
        userRole: currentUser.role,
        action,
        entityType,
        recordId,
        previousValue: previousValue.slice(0, 1900),
        newValue: newValue.slice(0, 1900),
        createdAt: new Date().toISOString(),
      };

      if (mode === 'LOCAL_ADMIN') {
        setAuditLogs((prev) => [entry, ...prev]);
        return;
      }

      try {
        await setDoc(doc(db, 'auditLogs', logId), {
          ...stripUndefined(entry),
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `auditLogs/${logId}`);
      }
    },
    [currentUser, mode]
  );

  const addMember: MaaContextValue['addMember'] = useCallback(
    async (payload) => {
      if (!currentUser) throw new Error('Not authenticated');
      const memberCode = generateNextMemberCode(members);
      const id = sanitizeForId(`mem_${memberCode}_${Date.now()}`);
      const now = new Date().toISOString();
      const newMember: Member = {
        ...payload,
        id,
        memberCode,
        advanceBalancePaise: 0,
        createdBy: currentUser.uid,
        createdAt: now,
        updatedAt: now,
      };

      if (mode === 'LOCAL_ADMIN') {
        setMembers((prev) => [...prev, newMember]);
        // Generate ledgers for existing open months
        const newLedgers: MemberLedger[] = collectionMonths.map((cm) => ({
          id: `${id}_${cm.monthKey}`,
          memberId: id,
          memberCode,
          memberUserUid: newMember.userUid,
          monthKey: cm.monthKey,
          duePaise: newMember.monthlyChandaPaise,
          paidPaise: 0,
          status: newMember.monthlyChandaPaise === 0 ? 'PAID' : 'UNPAID',
          updatedAt: now,
        }));
        setLedgers((prev) => [...prev, ...newLedgers]);
        await appendAuditLog('ADD_MEMBER', 'Member', memberCode, '—', `${newMember.fullName} (${memberCode})`);
        return newMember;
      }

      try {
        const batch = writeBatch(db);
        const { id: _ignore, ...firestorePayload } = newMember;
        batch.set(
          doc(db, 'members', id),
          stripUndefined({
            ...firestorePayload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
        for (const cm of collectionMonths) {
          const lid = `${id}_${cm.monthKey}`;
          batch.set(
            doc(db, 'memberLedgers', lid),
            stripUndefined({
              memberId: id,
              memberCode,
              memberUserUid: newMember.userUid,
              monthKey: cm.monthKey,
              duePaise: newMember.monthlyChandaPaise,
              paidPaise: 0,
              status: newMember.monthlyChandaPaise === 0 ? 'PAID' : 'UNPAID',
              updatedAt: serverTimestamp(),
            })
          );
        }
        await batch.commit();
        await appendAuditLog('ADD_MEMBER', 'Member', memberCode, '—', `${newMember.fullName} (${memberCode})`);
        return newMember;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `members/${id}`);
      }
    },
    [currentUser, members, mode, collectionMonths, appendAuditLog]
  );

  const updateMember: MaaContextValue['updateMember'] = useCallback(
    async (id, updates) => {
      const existing = members.find((m) => m.id === id);
      if (!existing) throw new Error('Member not found');
      const now = new Date().toISOString();
      const updated = { ...existing, ...updates, updatedAt: now };

      if (mode === 'LOCAL_ADMIN') {
        setMembers((prev) => prev.map((m) => (m.id === id ? updated : m)));
        await appendAuditLog(
          'EDIT_MEMBER',
          'Member',
          existing.memberCode,
          `${existing.fullName} / ${existing.status}`,
          `${updated.fullName} / ${updated.status}`
        );
        return;
      }

      try {
        const { id: _id, createdAt: _ca, createdBy: _cb, memberCode: _mc, ...rest } = updated;
        await updateDoc(
          doc(db, 'members', id),
          stripUndefined({
            ...rest,
            updatedAt: serverTimestamp(),
          })
        );
        await appendAuditLog(
          'EDIT_MEMBER',
          'Member',
          existing.memberCode,
          `${existing.fullName} / ${existing.status}`,
          `${updated.fullName} / ${updated.status}`
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `members/${id}`);
      }
    },
    [members, mode, appendAuditLog]
  );

  const importMembersBulk: MaaContextValue['importMembersBulk'] = useCallback(
    async (rows) => {
      let count = 0;
      const workingMembers = [...members];
      for (const row of rows) {
        const code = generateNextMemberCode(workingMembers);
        const created = await addMember({
          fullName: row.fullName,
          mobile: row.mobile,
          whatsappNumber: row.whatsappNumber || row.mobile,
          address: row.address || '',
          area: row.area || 'General',
          joiningDate: getCurrentISTDateISO(),
          monthlyChandaPaise: row.monthlyChandaPaise,
          category: row.category,
          status: 'ACTIVE',
          whatsappConsent: row.whatsappConsent,
          notes: 'Imported via Excel/CSV',
        });
        workingMembers.push(created);
        count += 1;
      }
      return count;
    },
    [members, addMember]
  );

  const createCollectionMonth: MaaContextValue['createCollectionMonth'] = useCallback(
    async ({ monthKey, financialYear, defaultAmountPaise, dueDate }) => {
      if (!currentUser) throw new Error('Not authenticated');
      if (collectionMonths.some((m) => m.monthKey === monthKey)) {
        throw new Error(`Collection month ${monthKey} already exists.`);
      }
      const now = new Date().toISOString();
      const newMonth: CollectionMonth = {
        id: monthKey,
        monthKey,
        label: formatMonthLabel(monthKey, 'en'),
        financialYear,
        defaultAmountPaise,
        dueDate: dueDate || `${monthKey}-10`,
        status: 'OPEN',
        createdBy: currentUser.uid,
        createdAt: now,
        updatedAt: now,
      };

      const activeMembers = members.filter((m) => m.status === 'ACTIVE');
      const newLedgers: MemberLedger[] = activeMembers.map((m) => ({
        id: `${m.id}_${monthKey}`,
        memberId: m.id,
        memberCode: m.memberCode,
        memberUserUid: m.userUid,
        monthKey,
        duePaise: m.monthlyChandaPaise > 0 ? m.monthlyChandaPaise : defaultAmountPaise,
        paidPaise: 0,
        status: 'UNPAID',
        updatedAt: now,
      }));

      if (mode === 'LOCAL_ADMIN') {
        setCollectionMonths((prev) => [...prev, newMonth]);
        setLedgers((prev) => [...prev, ...newLedgers]);
        setSelectedMonthKey(monthKey);
        await appendAuditLog('CREATE_COLLECTION_MONTH', 'CollectionMonth', monthKey, '—', `Created ${monthKey}`);
        return;
      }

      try {
        const batch = writeBatch(db);
        const { id: _id, ...monthPayload } = newMonth;
        batch.set(
          doc(db, 'collectionMonths', monthKey),
          stripUndefined({
            ...monthPayload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
        for (const l of newLedgers) {
          const { id: lid, ...lPayload } = l;
          batch.set(
            doc(db, 'memberLedgers', lid),
            stripUndefined({
              ...lPayload,
              updatedAt: serverTimestamp(),
            })
          );
        }
        await batch.commit();
        setSelectedMonthKey(monthKey);
        await appendAuditLog('CREATE_COLLECTION_MONTH', 'CollectionMonth', monthKey, '—', `Created ${monthKey}`);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `collectionMonths/${monthKey}`);
      }
    },
    [currentUser, collectionMonths, members, mode, appendAuditLog]
  );

  const updateLedgerDue: MaaContextValue['updateLedgerDue'] = useCallback(
    async (memberId, monthKey, duePaise) => {
      const lid = `${memberId}_${monthKey}`;
      const existing = ledgers.find((l) => l.id === lid);
      const member = members.find((m) => m.id === memberId);
      if (!member) return;
      const paidPaise = existing?.paidPaise ?? 0;
      const status = deriveLedgerStatus(duePaise, paidPaise);
      const now = new Date().toISOString();

      const updated: MemberLedger = {
        id: lid,
        memberId,
        memberCode: member.memberCode,
        memberUserUid: member.userUid,
        monthKey,
        duePaise,
        paidPaise,
        status,
        updatedAt: now,
      };

      if (mode === 'LOCAL_ADMIN') {
        setLedgers((prev) =>
          existing ? prev.map((l) => (l.id === lid ? updated : l)) : [...prev, updated]
        );
        return;
      }

      try {
        const { id: _id, ...payload } = updated;
        await setDoc(
          doc(db, 'memberLedgers', lid),
          stripUndefined({
            ...payload,
            updatedAt: serverTimestamp(),
          })
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `memberLedgers/${lid}`);
      }
    },
    [ledgers, members, mode]
  );

  const dispatchWhatsappToServer = useCallback(
    async (notif: WhatsappNotification, parameters: string[]): Promise<WhatsappNotification> => {
      try {
        const res = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notificationId: notif.notificationId,
            to: notif.recipientPhone,
            templateName: notif.templateName,
            language: notif.language,
            parameters,
            phoneNumberIdOverride: settings.whatsappPhoneNumberId,
            apiVersionOverride: settings.whatsappApiVersion,
          }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          status?: 'SENT' | 'FAILED';
          metaMessageId?: string;
          error?: string;
        };

        const updatedNotif: WhatsappNotification = {
          ...notif,
          status: data.ok ? 'SENT' : 'FAILED',
          metaMessageId: data.metaMessageId,
          errorMessage: data.error,
          updatedAt: new Date().toISOString(),
        };

        if (mode === 'LOCAL_ADMIN') {
          setWhatsappNotifications((prev) =>
            prev.map((w) => (w.id === notif.id ? updatedNotif : w))
          );
        } else {
          await updateDoc(
            doc(db, 'whatsappNotifications', notif.id),
            stripUndefined({
              status: updatedNotif.status,
              metaMessageId: updatedNotif.metaMessageId || '',
              errorMessage: updatedNotif.errorMessage || '',
              updatedAt: serverTimestamp(),
            })
          );
        }
        return updatedNotif;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Server communication error';
        const failedNotif: WhatsappNotification = {
          ...notif,
          status: 'FAILED',
          errorMessage: errorMsg,
          updatedAt: new Date().toISOString(),
        };
        if (mode === 'LOCAL_ADMIN') {
          setWhatsappNotifications((prev) =>
            prev.map((w) => (w.id === notif.id ? failedNotif : w))
          );
        }
        return failedNotif;
      }
    },
    [mode, settings.whatsappApiVersion, settings.whatsappPhoneNumberId]
  );

  const recordPayment: MaaContextValue['recordPayment'] = useCallback(
    async (input) => {
      if (!currentUser) throw new Error('Not authenticated');
      const member = members.find((m) => m.id === input.memberId);
      if (!member) throw new Error('Member not found');

      if (
        isDuplicateTransaction(
          payments,
          input.transactionId,
          input.memberId,
          input.amountPaise,
          input.paymentMethod,
          input.transactionRef
        )
      ) {
        throw new Error(
          'Duplicate transaction detected (matching Transaction ID, Transaction Ref, or rapid identical entry).'
        );
      }

      const memberLedgers = ledgers.filter((l) => l.memberId === member.id);
      const alloc = calculatePaymentAllocation({
        amountPaise: input.amountPaise,
        allocationMode: input.allocationMode,
        selectedMonthKey: input.monthKey,
        memberLedgers,
        collectionMonths,
        currentAdvancePaise: member.advanceBalancePaise || 0,
        defaultMemberMonthlyPaise: member.monthlyChandaPaise,
      });

      const receiptNumber = generateReceiptNumber(receipts, input.paymentDate);
      const paymentId = sanitizeForId(`pay_${input.transactionId}`);
      const receiptId = sanitizeForId(`rcp_${paymentId}`);
      const now = new Date().toISOString();

      const newPayment: Payment = {
        id: paymentId,
        transactionId: input.transactionId,
        receiptNumber,
        memberId: member.id,
        memberCode: member.memberCode,
        memberName: member.fullName,
        memberUserUid: member.userUid,
        monthKey: input.monthKey,
        amountPaise: input.amountPaise,
        paymentDate: input.paymentDate,
        paymentMethod: input.paymentMethod,
        transactionRef: input.transactionRef || '',
        collectedByUid: currentUser.uid,
        collectedByName: currentUser.name,
        allocationMode: input.allocationMode,
        allocations: alloc.allocations,
        advanceAddedPaise: alloc.advanceAddedPaise,
        previousDuePaise: alloc.previousDuePaise,
        remainingDuePaise: alloc.remainingDuePaise,
        status: 'COMPLETED',
        notes: input.notes || '',
        createdBy: currentUser.uid,
        createdAt: now,
        updatedAt: now,
      };

      const newReceipt: Receipt = {
        id: receiptId,
        receiptNumber,
        paymentId,
        memberId: member.id,
        memberCode: member.memberCode,
        memberName: member.fullName,
        memberUserUid: member.userUid,
        mobile: member.mobile,
        monthKey: input.monthKey,
        amountPaise: input.amountPaise,
        paymentDate: input.paymentDate,
        paymentMethod: input.paymentMethod,
        transactionRef: input.transactionRef || '',
        previousDuePaise: alloc.previousDuePaise,
        remainingDuePaise: alloc.remainingDuePaise,
        advanceBalancePaise: alloc.newAdvanceBalancePaise,
        collectorName: currentUser.name,
        status: 'ACTIVE',
        createdBy: currentUser.uid,
        createdAt: now,
      };

      if (mode === 'LOCAL_ADMIN') {
        setPayments((prev) => [newPayment, ...prev]);
        setReceipts((prev) => [newReceipt, ...prev]);
        setMembers((prev) =>
          prev.map((m) =>
            m.id === member.id
              ? { ...m, advanceBalancePaise: alloc.newAdvanceBalancePaise, updatedAt: now }
              : m
          )
        );
        setLedgers((prev) => {
          const map = new Map(prev.map((l) => [l.id, l]));
          for (const ul of alloc.updatedLedgers) {
            map.set(ul.id, ul);
          }
          return Array.from(map.values());
        });
      } else {
        try {
          await runTransaction(db, async (tx) => {
            const pRef = doc(db, 'payments', paymentId);
            const pSnap = await tx.get(pRef);
            if (pSnap.exists()) {
              throw new Error('Duplicate payment transaction ID.');
            }
            const { id: _pid, ...pPayload } = newPayment;
            tx.set(
              pRef,
              stripUndefined({
                ...pPayload,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              })
            );

            const rRef = doc(db, 'receipts', receiptId);
            const { id: _rid, ...rPayload } = newReceipt;
            tx.set(
              rRef,
              stripUndefined({
                ...rPayload,
                createdAt: serverTimestamp(),
              })
            );

            tx.update(doc(db, 'members', member.id), {
              advanceBalancePaise: alloc.newAdvanceBalancePaise,
              updatedAt: serverTimestamp(),
            });

            for (const ul of alloc.updatedLedgers) {
              const { id: lid, ...lPayload } = ul;
              tx.set(
                doc(db, 'memberLedgers', lid),
                stripUndefined({
                  ...lPayload,
                  updatedAt: serverTimestamp(),
                })
              );
            }
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `payments/${paymentId}`);
        }
      }

      await appendAuditLog(
        'COLLECT_PAYMENT',
        'Payment',
        receiptNumber,
        `Due: ₹${alloc.previousDuePaise / 100}`,
        `Paid: ₹${input.amountPaise / 100} (${member.memberCode})`
      );

      let whatsappNotification: WhatsappNotification | undefined;
      if (input.sendWhatsApp && settings.whatsappEnabled && member.whatsappConsent) {
        const waLang = settings.whatsappDefaultLanguage || language;
        const notifId = sanitizeForId(`notif_${paymentId}`);
        const templateName =
          settings.whatsappReceiptTemplate ||
          (waLang === 'bn' ? 'maa_chanda_receipt_bn' : 'maa_chanda_receipt_en');
        const msgBody = buildReceiptMessageBody(
          {
            memberName: member.fullName,
            monthKey: input.monthKey,
            amountPaise: input.amountPaise,
            paymentDate: input.paymentDate,
            receiptNumber,
            remainingDuePaise: alloc.remainingDuePaise,
            committeeName: settings.committeeName,
          },
          waLang
        );

        const initialNotif: WhatsappNotification = {
          id: notifId,
          notificationId: notifId,
          memberId: member.id,
          memberName: member.fullName,
          recipientPhone: formatWhatsAppE164(member.whatsappNumber || member.mobile),
          type: 'RECEIPT',
          templateName,
          language: waLang,
          messageBody: msgBody,
          relatedPaymentId: paymentId,
          status: 'QUEUED',
          sentByUid: currentUser.uid,
          createdAt: now,
          updatedAt: now,
        };

        if (mode === 'LOCAL_ADMIN') {
          setWhatsappNotifications((prev) => [initialNotif, ...prev]);
        } else {
          const { id: _nid, ...nPayload } = initialNotif;
          await setDoc(
            doc(db, 'whatsappNotifications', notifId),
            stripUndefined({
              ...nPayload,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          );
        }

        whatsappNotification = await dispatchWhatsappToServer(initialNotif, [
          member.fullName,
          formatMonthLabel(input.monthKey, waLang),
          String(Math.round(input.amountPaise / 100)),
          input.paymentDate,
          receiptNumber,
          String(Math.round(alloc.remainingDuePaise / 100)),
        ]);
      }

      return { payment: newPayment, receipt: newReceipt, whatsappNotification };
    },
    [
      currentUser,
      members,
      payments,
      ledgers,
      collectionMonths,
      receipts,
      mode,
      appendAuditLog,
      settings,
      language,
      dispatchWhatsappToServer,
    ]
  );

  const reversePayment: MaaContextValue['reversePayment'] = useCallback(
    async (paymentId, reason) => {
      if (!currentUser) throw new Error('Not authenticated');
      const payment = payments.find((p) => p.id === paymentId);
      if (!payment || payment.status === 'REVERSED') {
        throw new Error('Payment not found or already reversed.');
      }
      const member = members.find((m) => m.id === payment.memberId);
      const now = new Date().toISOString();

      if (mode === 'LOCAL_ADMIN') {
        setPayments((prev) =>
          prev.map((p) =>
            p.id === paymentId
              ? {
                  ...p,
                  status: 'REVERSED',
                  reversalReason: reason,
                  reversedBy: currentUser.uid,
                  updatedAt: now,
                }
              : p
          )
        );
        setReceipts((prev) =>
          prev.map((r) => (r.paymentId === paymentId ? { ...r, status: 'VOID' } : r))
        );
        if (member) {
          setMembers((prev) =>
            prev.map((m) =>
              m.id === member.id
                ? {
                    ...m,
                    advanceBalancePaise: Math.max(0, (m.advanceBalancePaise || 0) - payment.advanceAddedPaise),
                    updatedAt: now,
                  }
                : m
            )
          );
        }
        setLedgers((prev) =>
          prev.map((l) => {
            if (l.memberId !== payment.memberId) return l;
            const allocItem = payment.allocations.find((a) => a.monthKey === l.monthKey);
            if (!allocItem) return l;
            const nextPaid = Math.max(0, l.paidPaise - allocItem.allocatedPaise);
            return {
              ...l,
              paidPaise: nextPaid,
              status: deriveLedgerStatus(l.duePaise, nextPaid),
              updatedAt: now,
            };
          })
        );
        await appendAuditLog(
          'REVERSE_PAYMENT',
          'Payment',
          payment.receiptNumber,
          `COMPLETED ₹${payment.amountPaise / 100}`,
          `REVERSED: ${reason}`
        );
        return;
      }

      try {
        await runTransaction(db, async (tx) => {
          tx.update(doc(db, 'payments', paymentId), {
            status: 'REVERSED',
            reversalReason: reason,
            reversedBy: currentUser.uid,
            updatedAt: serverTimestamp(),
          });
          tx.update(doc(db, 'receipts', `rcp_${paymentId}`), {
            status: 'VOID',
          });
          if (member) {
            tx.update(doc(db, 'members', member.id), {
              advanceBalancePaise: Math.max(0, (member.advanceBalancePaise || 0) - payment.advanceAddedPaise),
              updatedAt: serverTimestamp(),
            });
          }
          for (const allocItem of payment.allocations) {
            const lid = `${payment.memberId}_${allocItem.monthKey}`;
            const lRef = doc(db, 'memberLedgers', lid);
            const lSnap = await tx.get(lRef);
            if (lSnap.exists()) {
              const d = lSnap.data();
              const nextPaid = Math.max(0, Number(d.paidPaise || 0) - allocItem.allocatedPaise);
              const due = Number(d.duePaise || 0);
              tx.update(lRef, {
                paidPaise: nextPaid,
                status: deriveLedgerStatus(due, nextPaid),
                updatedAt: serverTimestamp(),
              });
            }
          }
        });
        await appendAuditLog(
          'REVERSE_PAYMENT',
          'Payment',
          payment.receiptNumber,
          `COMPLETED ₹${payment.amountPaise / 100}`,
          `REVERSED: ${reason}`
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `payments/${paymentId}`);
      }
    },
    [currentUser, payments, members, mode, appendAuditLog]
  );

  const addExpense: MaaContextValue['addExpense'] = useCallback(
    async (payload) => {
      if (!currentUser) throw new Error('Not authenticated');
      const expenseCode = generateExpenseCode(expenses);
      const id = sanitizeForId(`exp_${expenseCode}_${Date.now()}`);
      const now = new Date().toISOString();
      const newExpense: Expense = {
        ...payload,
        id,
        expenseCode,
        addedByUid: currentUser.uid,
        addedByName: currentUser.name,
        status: 'ACTIVE',
        createdBy: currentUser.uid,
        createdAt: now,
        updatedAt: now,
      };

      if (mode === 'LOCAL_ADMIN') {
        setExpenses((prev) => [newExpense, ...prev]);
        await appendAuditLog(
          'ADD_EXPENSE',
          'Expense',
          expenseCode,
          '—',
          `${newExpense.description} (₹${newExpense.amountPaise / 100})`
        );
        return newExpense;
      }

      try {
        const { id: _id, attachmentDataUrl: _dataUrl, ...firestorePayload } = newExpense;
        await setDoc(
          doc(db, 'expenses', id),
          stripUndefined({
            ...firestorePayload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
        await appendAuditLog(
          'ADD_EXPENSE',
          'Expense',
          expenseCode,
          '—',
          `${newExpense.description} (₹${newExpense.amountPaise / 100})`
        );
        return newExpense;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `expenses/${id}`);
      }
    },
    [currentUser, expenses, mode, appendAuditLog]
  );

  const archiveExpense: MaaContextValue['archiveExpense'] = useCallback(
    async (expenseId) => {
      const existing = expenses.find((e) => e.id === expenseId);
      if (!existing) return;
      if (mode === 'LOCAL_ADMIN') {
        setExpenses((prev) =>
          prev.map((e) => (e.id === expenseId ? { ...e, status: 'ARCHIVED' } : e))
        );
        await appendAuditLog('ARCHIVE_EXPENSE', 'Expense', existing.expenseCode, 'ACTIVE', 'ARCHIVED');
        return;
      }
      try {
        await updateDoc(doc(db, 'expenses', expenseId), {
          status: 'ARCHIVED',
          updatedAt: serverTimestamp(),
        });
        await appendAuditLog('ARCHIVE_EXPENSE', 'Expense', existing.expenseCode, 'ACTIVE', 'ARCHIVED');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `expenses/${expenseId}`);
      }
    },
    [expenses, mode, appendAuditLog]
  );

  const sendWhatsappReminder: MaaContextValue['sendWhatsappReminder'] = useCallback(
    async (member, pendingMonthsText, totalDuePaise) => {
      if (!currentUser) throw new Error('Not authenticated');
      if (!member.whatsappConsent) {
        throw new Error(`${member.fullName} has not opted in for WhatsApp notifications.`);
      }
      const waLang = settings.whatsappDefaultLanguage || language;
      const notifId = sanitizeForId(`rem_${member.id}_${Date.now()}`);
      const templateName =
        settings.whatsappReminderTemplate ||
        (waLang === 'bn' ? 'maa_chanda_reminder_bn' : 'maa_chanda_reminder_en');
      const msgBody = buildReminderMessageBody(
        {
          memberName: member.fullName,
          pendingMonthsText,
          totalDuePaise,
          committeeName: settings.committeeName,
        },
        waLang
      );
      const now = new Date().toISOString();
      const notif: WhatsappNotification = {
        id: notifId,
        notificationId: notifId,
        memberId: member.id,
        memberName: member.fullName,
        recipientPhone: formatWhatsAppE164(member.whatsappNumber || member.mobile),
        type: 'REMINDER',
        templateName,
        language: waLang,
        messageBody: msgBody,
        status: 'QUEUED',
        sentByUid: currentUser.uid,
        createdAt: now,
        updatedAt: now,
      };

      if (mode === 'LOCAL_ADMIN') {
        setWhatsappNotifications((prev) => [notif, ...prev]);
      } else {
        const { id: _id, ...payload } = notif;
        await setDoc(
          doc(db, 'whatsappNotifications', notifId),
          stripUndefined({
            ...payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      }

      const result = await dispatchWhatsappToServer(notif, [
        member.fullName,
        pendingMonthsText,
        String(Math.round(totalDuePaise / 100)),
        settings.committeeName,
      ]);

      await appendAuditLog(
        'SEND_WHATSAPP_REMINDER',
        'WhatsappNotification',
        notifId,
        'QUEUED',
        `${result.status} (${member.memberCode})`
      );
      return result;
    },
    [currentUser, settings, language, mode, dispatchWhatsappToServer, appendAuditLog]
  );

  const sendBulkWhatsappReminders: MaaContextValue['sendBulkWhatsappReminders'] = useCallback(
    async (targets) => {
      const eligible = targets.filter((t) => t.member.whatsappConsent);
      const results: WhatsappNotification[] = [];
      for (const target of eligible.slice(0, 25)) {
        const r = await sendWhatsappReminder(
          target.member,
          target.pendingMonthsText,
          target.totalDuePaise
        );
        results.push(r);
      }
      return results;
    },
    [sendWhatsappReminder]
  );

  const resendWhatsappNotification: MaaContextValue['resendWhatsappNotification'] = useCallback(
    async (notifId) => {
      const existing = whatsappNotifications.find((w) => w.id === notifId);
      if (!existing) throw new Error('Notification record not found');
      const freshNotif: WhatsappNotification = {
        ...existing,
        notificationId: sanitizeForId(`${existing.notificationId}_retry_${Date.now()}`),
        status: 'QUEUED',
        errorMessage: undefined,
        updatedAt: new Date().toISOString(),
      };
      return dispatchWhatsappToServer(freshNotif, [existing.memberName, existing.messageBody || '']);
    },
    [whatsappNotifications, dispatchWhatsappToServer]
  );

  const publishAnnouncement: MaaContextValue['publishAnnouncement'] = useCallback(
    async (payload, broadcastWhatsApp) => {
      if (!currentUser) throw new Error('Not authenticated');
      const id = sanitizeForId(`ann_${Date.now()}`);
      const now = new Date().toISOString();
      const ann: Announcement = {
        ...payload,
        id,
        status: 'PUBLISHED',
        createdBy: currentUser.uid,
        createdAt: now,
        updatedAt: now,
      };
      if (mode === 'LOCAL_ADMIN') {
        setAnnouncements((prev) => [ann, ...prev]);
      } else {
        const { id: _id, ...p } = ann;
        await setDoc(
          doc(db, 'announcements', id),
          stripUndefined({
            ...p,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      }
      await appendAuditLog('PUBLISH_ANNOUNCEMENT', 'Announcement', id, '—', payload.titleEn);

      if (broadcastWhatsApp && settings.whatsappEnabled) {
        const optedIn = members.filter((m) => m.status === 'ACTIVE' && m.whatsappConsent).slice(0, 25);
        for (const m of optedIn) {
          const nid = sanitizeForId(`ann_wa_${id}_${m.id}`);
          const waLang = settings.whatsappDefaultLanguage || language;
          const notif: WhatsappNotification = {
            id: nid,
            notificationId: nid,
            memberId: m.id,
            memberName: m.fullName,
            recipientPhone: formatWhatsAppE164(m.whatsappNumber || m.mobile),
            type: 'ANNOUNCEMENT',
            templateName: settings.whatsappAnnouncementTemplate || 'maa_puja_announcement_bn',
            language: waLang,
            messageBody: waLang === 'bn' ? `${payload.titleBn}\n${payload.bodyBn}` : `${payload.titleEn}\n${payload.bodyEn}`,
            status: 'QUEUED',
            sentByUid: currentUser.uid,
            createdAt: now,
            updatedAt: now,
          };
          if (mode === 'LOCAL_ADMIN') {
            setWhatsappNotifications((prev) => [notif, ...prev]);
          }
          await dispatchWhatsappToServer(notif, [
            m.fullName,
            waLang === 'bn' ? payload.titleBn : payload.titleEn,
            waLang === 'bn' ? payload.bodyBn : payload.bodyEn,
          ]);
        }
      }
    },
    [currentUser, mode, appendAuditLog, settings, members, language, dispatchWhatsappToServer]
  );

  const saveAdminUser: MaaContextValue['saveAdminUser'] = useCallback(
    async (payload) => {
      if (!currentUser) throw new Error('Not authenticated');
      const uid = payload.existingUid || sanitizeForId(`usr_${payload.email.split('@')[0]}_${Date.now()}`);
      const now = new Date().toISOString();
      const userObj: AppUser = {
        id: uid,
        uid,
        name: payload.name,
        email: payload.email,
        phone: payload.phone || '',
        role: payload.role,
        status: 'ACTIVE',
        canAddMembers: payload.canAddMembers,
        canReversePayments: payload.canReversePayments,
        canManageExpenses: payload.canManageExpenses,
        canSendBulkWhatsApp: payload.canSendBulkWhatsApp,
        createdAt: now,
        updatedAt: now,
      };

      if (mode === 'LOCAL_ADMIN') {
        setUsers((prev) => {
          const exists = prev.some((u) => u.uid === uid);
          return exists ? prev.map((u) => (u.uid === uid ? userObj : u)) : [...prev, userObj];
        });
        await appendAuditLog('MANAGE_ADMIN', 'User', uid, '—', `${payload.email} (${payload.role})`);
        return;
      }

      try {
        const { id: _id, ...uPayload } = userObj;
        await setDoc(
          doc(db, 'users', uid),
          stripUndefined({
            ...uPayload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
        if (payload.role === 'SUPER_ADMIN' || payload.role === 'COLLECTION_ADMIN') {
          await setDoc(doc(db, 'admins', uid), {
            uid,
            email: payload.email,
            role: payload.role,
            active: true,
            createdAt: serverTimestamp(),
          });
        }
        await appendAuditLog('MANAGE_ADMIN', 'User', uid, '—', `${payload.email} (${payload.role})`);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
      }
    },
    [currentUser, mode, appendAuditLog]
  );

  const toggleAdminStatus: MaaContextValue['toggleAdminStatus'] = useCallback(
    async (userId) => {
      const target = users.find((u) => u.id === userId);
      if (!target) return;
      const nextStatus = target.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      if (mode === 'LOCAL_ADMIN') {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, status: nextStatus } : u))
        );
        await appendAuditLog('TOGGLE_USER_STATUS', 'User', target.email, target.status, nextStatus);
        return;
      }

      try {
        await updateDoc(doc(db, 'users', userId), {
          status: nextStatus,
          updatedAt: serverTimestamp(),
        });
        if (target.role !== 'MEMBER') {
          await updateDoc(doc(db, 'admins', userId), {
            active: nextStatus === 'ACTIVE',
          });
        }
        await appendAuditLog('TOGGLE_USER_STATUS', 'User', target.email, target.status, nextStatus);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
      }
    },
    [users, mode, appendAuditLog]
  );

  const updateSettings: MaaContextValue['updateSettings'] = useCallback(
    async (updates) => {
      if (!currentUser) throw new Error('Not authenticated');
      const next: CommitteeSettings = {
        ...settings,
        ...updates,
        updatedBy: currentUser.uid,
        updatedAt: new Date().toISOString(),
      };
      if (mode === 'LOCAL_ADMIN') {
        setSettings(next);
        await appendAuditLog('UPDATE_SETTINGS', 'Settings', 'committee', '—', 'Updated application/WhatsApp settings');
        return;
      }
      try {
        const { id: _id, ...payload } = next;
        await setDoc(
          doc(db, 'settings', 'committee'),
          stripUndefined({
            ...payload,
            updatedAt: serverTimestamp(),
          })
        );
        await appendAuditLog('UPDATE_SETTINGS', 'Settings', 'committee', '—', 'Updated application/WhatsApp settings');
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'settings/committee');
      }
    },
    [currentUser, settings, mode, appendAuditLog]
  );

  const restoreBackupJson: MaaContextValue['restoreBackupJson'] = useCallback(
    async (jsonText) => {
      const parsed = JSON.parse(jsonText) as Partial<{
        members: Member[];
        collectionMonths: CollectionMonth[];
        ledgers: MemberLedger[];
        payments: Payment[];
        receipts: Receipt[];
        expenses: Expense[];
        announcements: Announcement[];
        settings: CommitteeSettings;
      }>;
      if (mode === 'LOCAL_ADMIN') {
        if (Array.isArray(parsed.members)) setMembers(parsed.members);
        if (Array.isArray(parsed.collectionMonths)) setCollectionMonths(parsed.collectionMonths);
        if (Array.isArray(parsed.ledgers)) setLedgers(parsed.ledgers);
        if (Array.isArray(parsed.payments)) setPayments(parsed.payments);
        if (Array.isArray(parsed.receipts)) setReceipts(parsed.receipts);
        if (Array.isArray(parsed.expenses)) setExpenses(parsed.expenses);
        if (Array.isArray(parsed.announcements)) setAnnouncements(parsed.announcements);
        if (parsed.settings) setSettings(parsed.settings);
        await appendAuditLog('RESTORE_BACKUP', 'System', 'backup', '—', 'Restored JSON backup in Committee Admin session');
        return;
      }
      throw new Error('Live Firestore restore should be performed via Firebase CLI import/export for data integrity.');
    },
    [mode, appendAuditLog]
  );

  const syncWebhookStatuses = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp/webhook-statuses');
      if (!res.ok) return;
      const data = (await res.json()) as {
        statuses: Array<{
          metaMessageId: string;
          status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
          errorMessage?: string;
          updatedAt: string;
        }>;
      };
      if (!data.statuses?.length) return;
      const byMetaId = new Map(data.statuses.map((s) => [s.metaMessageId, s]));
      setWhatsappNotifications((prev) =>
        prev.map((w) => {
          if (!w.metaMessageId) return w;
          const match = byMetaId.get(w.metaMessageId);
          if (!match || match.status === w.status) return w;
          return {
            ...w,
            status: match.status,
            errorMessage: match.errorMessage || w.errorMessage,
            updatedAt: match.updatedAt,
          };
        })
      );
    } catch {
      // Ignore polling error
    }
  }, []);

  const value = useMemo<MaaContextValue>(
    () => ({
      mode,
      authReady,
      firebaseConnected,
      currentUser,
      language,
      setLanguage,
      activePage,
      setActivePage,
      selectedMemberId,
      setSelectedMemberId,
      selectedMonthKey,
      setSelectedMonthKey,
      prefillCollectMemberId,
      setPrefillCollectMemberId,
      users,
      members,
      collectionMonths,
      ledgers,
      payments,
      receipts,
      expenses,
      whatsappNotifications,
      announcements,
      auditLogs,
      settings,
      serverWhatsappHealth,
      loginWithGoogle,
      loginWithAdminCredentials,
      enterMemberPortal,
      resetToFreshCommitteeLedger,
      logout,
      refreshServerHealth,
      addMember,
      updateMember,
      importMembersBulk,
      createCollectionMonth,
      updateLedgerDue,
      recordPayment,
      reversePayment,
      addExpense,
      archiveExpense,
      sendWhatsappReminder,
      sendBulkWhatsappReminders,
      resendWhatsappNotification,
      publishAnnouncement,
      saveAdminUser,
      toggleAdminStatus,
      updateSettings,
      restoreBackupJson,
      syncWebhookStatuses,
    }),
    [
      mode,
      authReady,
      firebaseConnected,
      currentUser,
      language,
      setLanguage,
      activePage,
      selectedMemberId,
      selectedMonthKey,
      prefillCollectMemberId,
      users,
      members,
      collectionMonths,
      ledgers,
      payments,
      receipts,
      expenses,
      whatsappNotifications,
      announcements,
      auditLogs,
      settings,
      serverWhatsappHealth,
      loginWithGoogle,
      loginWithAdminCredentials,
      enterMemberPortal,
      resetToFreshCommitteeLedger,
      logout,
      refreshServerHealth,
      addMember,
      updateMember,
      importMembersBulk,
      createCollectionMonth,
      updateLedgerDue,
      recordPayment,
      reversePayment,
      addExpense,
      archiveExpense,
      sendWhatsappReminder,
      sendBulkWhatsappReminders,
      resendWhatsappNotification,
      publishAnnouncement,
      saveAdminUser,
      toggleAdminStatus,
      updateSettings,
      restoreBackupJson,
      syncWebhookStatuses,
    ]
  );

  return <MaaContext.Provider value={value}>{children}</MaaContext.Provider>;
};

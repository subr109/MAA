import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Megaphone,
  RefreshCw,
  RotateCcw,
  Send,
  Shield,
  Upload,
  UserPlus,
} from 'lucide-react';
import { useMaa } from '../context/MaaContext';
import {
  formatDateIN,
  formatDateTimeIN,
  getCurrentISTDateISO,
  paiseToRupees,
  rupeesToPaise,
} from '../lib/chandaEngine';
import { t } from '../lib/i18n';
import { AnnouncementCategory, Language, UserRole } from '../types/maa';
import { StatusLabel } from '../components/StatusLabel';

/* =========================================================
 * Page 15: WhatsApp Notifications
 * ========================================================= */
export const WhatsappNotificationsPage: React.FC = () => {
  const {
    language,
    whatsappNotifications,
    serverWhatsappHealth,
    refreshServerHealth,
    syncWebhookStatuses,
    resendWhatsappNotification,
  } = useMaa();

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [resendingId, setResendingId] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      [...whatsappNotifications]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .filter((w) => statusFilter === 'ALL' || w.status === statusFilter),
    [whatsappNotifications, statusFilter]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {t(language, 'nav_whatsapp')}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Official Meta WhatsApp Business Cloud API · Webhook-verified delivery statuses
          </p>
        </div>

        <button
          type="button"
          onClick={async () => {
            await refreshServerHealth();
            await syncWebhookStatuses();
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Sync Webhook & Server Status
        </button>
      </div>

      {/* Server Credential Diagnostic (Honest Status — Never Fakes Delivery) */}
      <div
        className={`p-4 rounded-xl border text-xs flex items-start gap-3 ${
          serverWhatsappHealth.tokenConfigured && serverWhatsappHealth.phoneNumberIdConfigured
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}
      >
        {serverWhatsappHealth.tokenConfigured && serverWhatsappHealth.phoneNumberIdConfigured ? (
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        )}
        <div className="space-y-1">
          <div className="font-semibold">
            {serverWhatsappHealth.tokenConfigured && serverWhatsappHealth.phoneNumberIdConfigured
              ? `Meta Cloud API Configured (${serverWhatsappHealth.apiVersion})`
              : 'WhatsApp Business API Server Secrets Not Yet Configured'}
          </div>
          <p>
            WHATSAPP_ACCESS_TOKEN:{' '}
            <strong>{serverWhatsappHealth.tokenConfigured ? 'Configured' : 'Missing'}</strong> ·
            WHATSAPP_PHONE_NUMBER_ID:{' '}
            <strong>
              {serverWhatsappHealth.phoneNumberIdConfigured ? 'Configured' : 'Missing'}
            </strong>{' '}
            · Webhook Verify Token:{' '}
            <strong>
              {serverWhatsappHealth.webhookVerifyConfigured ? 'Configured' : 'Missing'}
            </strong>
          </p>
          {!serverWhatsappHealth.tokenConfigured && (
            <p className="text-[11px]">
              Set <code>WHATSAPP_ACCESS_TOKEN</code> and <code>WHATSAPP_PHONE_NUMBER_ID</code> in
              server environment secrets. Delivery statuses are never marked Delivered unless
              confirmed by Meta&apos;s webhook.
            </p>
          )}
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex flex-wrap gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg w-fit">
        {['ALL', 'QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED'].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md ${
              statusFilter === s
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Logs Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-950 text-xs text-slate-500 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 font-medium">Timestamp (IST)</th>
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Type & Template</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Meta Message ID / Error</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filtered.map((w) => (
                <tr key={w.id}>
                  <td className="px-4 py-3 font-mono text-xs">{formatDateTimeIN(w.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{w.memberName}</div>
                    <div className="font-mono text-[11px] text-slate-500">+{w.recipientPhone}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="font-medium">{w.type}</div>
                    <div className="font-mono text-[11px] text-slate-500">{w.templateName} ({w.language})</div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusLabel status={w.status} />
                  </td>
                  <td className="px-4 py-3 text-xs max-w-xs break-words">
                    {w.metaMessageId && <div className="font-mono text-[11px]">{w.metaMessageId}</div>}
                    {w.errorMessage && <div className="text-red-700 dark:text-red-400">{w.errorMessage}</div>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={resendingId === w.id}
                      onClick={async () => {
                        setResendingId(w.id);
                        try {
                          await resendWhatsappNotification(w.id);
                        } finally {
                          setResendingId(null);
                        }
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Resend
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
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

/* =========================================================
 * Page 16: Announcements
 * ========================================================= */
export const AnnouncementsPage: React.FC = () => {
  const { language, announcements, currentUser, publishAnnouncement } = useMaa();

  const [titleBn, setTitleBn] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [bodyBn, setBodyBn] = useState('');
  const [bodyEn, setBodyEn] = useState('');
  const [category, setCategory] = useState<AnnouncementCategory>('PUJA_SCHEDULE');
  const [broadcastWa, setBroadcastWa] = useState(false);
  const [saving, setSaving] = useState(false);

  const isAdmin = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'COLLECTION_ADMIN';

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleBn.trim() || !titleEn.trim() || !bodyBn.trim() || !bodyEn.trim()) return;
    setSaving(true);
    try {
      await publishAnnouncement(
        {
          titleBn: titleBn.trim(),
          titleEn: titleEn.trim(),
          bodyBn: bodyBn.trim(),
          bodyEn: bodyEn.trim(),
          category,
          publishDate: getCurrentISTDateISO(),
        },
        broadcastWa
      );
      setTitleBn('');
      setTitleEn('');
      setBodyBn('');
      setBodyEn('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {t(language, 'nav_announcements')}
        </h2>
        <p className="text-xs text-slate-500">
          {language === 'bn'
            ? 'পুজো সূচি, মিটিং নোটিশ ও জরুরি বিজ্ঞপ্তি (বাংলা ও ইংরেজি)'
            : 'Bilingual Puja schedule, meeting notices & committee updates'}
        </p>
      </div>

      {isAdmin && (
        <form
          onSubmit={handlePublish}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Megaphone className="w-4 h-4 text-[#D95D16]" />
            <span>{language === 'bn' ? 'নতুন ঘোষণা প্রকাশ করুন' : 'Publish Bilingual Announcement'}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              type="text"
              required
              value={titleBn}
              onChange={(e) => setTitleBn(e.target.value)}
              placeholder="শিরোনাম (বাংলায়)"
              className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
            />
            <input
              type="text"
              required
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
              placeholder="Title (English)"
              className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
            />
            <textarea
              rows={3}
              required
              value={bodyBn}
              onChange={(e) => setBodyBn(e.target.value)}
              placeholder="বিস্তারিত বার্তা (বাংলায়)"
              className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
            />
            <textarea
              rows={3}
              required
              value={bodyEn}
              onChange={(e) => setBodyEn(e.target.value)}
              placeholder="Message Body (English)"
              className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as AnnouncementCategory)}
              className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
            >
              <option value="PUJA_SCHEDULE">Puja Schedule</option>
              <option value="MEETING_NOTICE">Meeting Notice</option>
              <option value="CULTURAL_PROGRAM">Cultural Program</option>
              <option value="COLLECTION_UPDATE">Collection Update</option>
              <option value="IMPORTANT">Important</option>
              <option value="EMERGENCY">Emergency</option>
            </select>
            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={broadcastWa}
                onChange={(e) => setBroadcastWa(e.target.checked)}
              />
              <span>Broadcast to opted-in members via WhatsApp Cloud API</span>
            </label>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#0F2143] text-white"
            >
              <Send className="w-3.5 h-3.5" />
              {saving ? 'Publishing...' : 'Publish Announcement'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {[...announcements]
          .sort((a, b) => b.publishDate.localeCompare(a.publishDate))
          .map((a) => (
            <div
              key={a.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>
                  {a.category.replace('_', ' ')} · {formatDateIN(a.publishDate)}
                </span>
                <StatusLabel status={a.status} />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {language === 'bn' ? a.titleBn : a.titleEn}
              </h3>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {language === 'bn' ? a.bodyBn : a.bodyEn}
              </p>
              <p className="text-xs text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
                {language === 'bn' ? a.titleEn : a.titleBn} — {language === 'bn' ? a.bodyEn : a.bodyBn}
              </p>
            </div>
          ))}
      </div>
    </div>
  );
};

/* =========================================================
 * Page 17: Admin Management
 * ========================================================= */
export const AdminManagementPage: React.FC = () => {
  const { language, users, saveAdminUser, toggleAdminStatus } = useMaa();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('COLLECTION_ADMIN');
  const [canAddMembers, setCanAddMembers] = useState(true);
  const [canReversePayments, setCanReversePayments] = useState(false);
  const [canManageExpenses, setCanManageExpenses] = useState(true);
  const [canSendBulkWhatsApp, setCanSendBulkWhatsApp] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    await saveAdminUser({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      role,
      canAddMembers,
      canReversePayments,
      canManageExpenses,
      canSendBulkWhatsApp,
    });
    setName('');
    setEmail('');
    setPhone('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {t(language, 'nav_admins')}
        </h2>
        <p className="text-xs text-slate-500">
          Super Admin role-based access control & collector permission management
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          <UserPlus className="w-4 h-4 text-[#0F2143] dark:text-amber-300" />
          <span>Add Admin / Collector Account</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full Name"
            className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
          />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Google Email"
            className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
          />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Mobile"
            className="px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
          >
            <option value="COLLECTION_ADMIN">Collection Admin</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="MEMBER">Member</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-5 text-xs">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={canAddMembers} onChange={(e) => setCanAddMembers(e.target.checked)} />
            Can Add Members
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={canManageExpenses} onChange={(e) => setCanManageExpenses(e.target.checked)} />
            Can Manage Expenses
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={canReversePayments} onChange={(e) => setCanReversePayments(e.target.checked)} />
            Can Reverse Payments
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={canSendBulkWhatsApp} onChange={(e) => setCanSendBulkWhatsApp(e.target.checked)} />
            Can Send Bulk WhatsApp
          </label>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#0F2143] text-white"
          >
            Save User Role
          </button>
        </div>
      </form>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-950 text-xs text-slate-500 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 font-medium">Name & Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Permissions</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{u.name}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{u.role}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                    {[
                      u.canAddMembers && 'Members',
                      u.canManageExpenses && 'Expenses',
                      u.canReversePayments && 'Reversal',
                      u.canSendBulkWhatsApp && 'Bulk WA',
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Read-only'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusLabel status={u.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => toggleAdminStatus(u.id)}
                      className="px-3 py-1 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-md"
                    >
                      {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
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
 * Page 18: Audit Logs
 * ========================================================= */
export const AuditLogsPage: React.FC = () => {
  const { language, auditLogs } = useMaa();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...auditLogs]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .filter(
        (a) =>
          !q ||
          a.action.toLowerCase().includes(q) ||
          a.userName.toLowerCase().includes(q) ||
          a.recordId.toLowerCase().includes(q)
      );
  }, [auditLogs, search]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {t(language, 'nav_audit-logs')}
          </h2>
          <p className="text-xs text-slate-500">
            Immutable append-only log of financial & administrative operations
          </p>
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search action, user, or record..."
          className="px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
        />
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-950 text-xs text-slate-500 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 font-medium">Timestamp (IST)</th>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Record</th>
                <th className="px-4 py-3 font-medium">Previous → New</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filtered.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-3 font-mono text-xs">{formatDateTimeIN(l.createdAt)}</td>
                  <td className="px-4 py-3 text-xs">
                    <div className="font-medium">{l.userName}</div>
                    <div className="text-slate-500">{l.userRole}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold">{l.action}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {l.entityType} · {l.recordId}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                    {l.previousValue || '—'} → {l.newValue || '—'}
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
 * Page 19: Settings (Committee, Collection, WhatsApp, Backup)
 * ========================================================= */
export const SettingsPage: React.FC = () => {
  const {
    mode,
    language,
    setLanguage,
    settings,
    updateSettings,
    resetToFreshCommitteeLedger,
    serverWhatsappHealth,
    members,
    collectionMonths,
    ledgers,
    payments,
    receipts,
    expenses,
    announcements,
    restoreBackupJson,
  } = useMaa();

  const [confirmFreshReset, setConfirmFreshReset] = useState(false);

  const [committeeName, setCommitteeName] = useState(settings.committeeName);
  const [committeeAddress, setCommitteeAddress] = useState(settings.committeeAddress || '');
  const [contactNumber, setContactNumber] = useState(settings.contactNumber || '');
  const [email, setEmail] = useState(settings.email || '');
  const [pujaYear, setPujaYear] = useState(settings.pujaYear || '');
  const [defaultChandaRupees, setDefaultChandaRupees] = useState(
    String(paiseToRupees(settings.defaultMonthlyChandaPaise))
  );
  const [financialYear, setFinancialYear] = useState(settings.financialYear);
  const [dueDay, setDueDay] = useState(String(settings.dueDay || 10));
  const [whatsappEnabled, setWhatsappEnabled] = useState(settings.whatsappEnabled);
  const [whatsappPhoneNumberId, setWhatsappPhoneNumberId] = useState(
    settings.whatsappPhoneNumberId || ''
  );
  const [whatsappBusinessAccountId, setWhatsappBusinessAccountId] = useState(
    settings.whatsappBusinessAccountId || ''
  );
  const [whatsappApiVersion, setWhatsappApiVersion] = useState(
    settings.whatsappApiVersion || 'v21.0'
  );
  const [whatsappReceiptTemplate, setWhatsappReceiptTemplate] = useState(
    settings.whatsappReceiptTemplate || 'maa_chanda_receipt_bn'
  );
  const [whatsappReminderTemplate, setWhatsappReminderTemplate] = useState(
    settings.whatsappReminderTemplate || 'maa_chanda_reminder_bn'
  );
  const [whatsappDefaultLanguage, setWhatsappDefaultLanguage] = useState<Language>(
    settings.whatsappDefaultLanguage || 'bn'
  );
  const [theme, setTheme] = useState<'light' | 'dark'>(settings.theme || 'light');
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const restoreRef = useRef<HTMLInputElement | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavedNotice(null);
    await updateSettings({
      committeeName,
      committeeAddress,
      contactNumber,
      email,
      pujaYear,
      defaultMonthlyChandaPaise: rupeesToPaise(defaultChandaRupees),
      financialYear,
      dueDay: Math.max(1, Math.min(28, Number(dueDay) || 10)),
      whatsappEnabled,
      whatsappPhoneNumberId,
      whatsappBusinessAccountId,
      whatsappApiVersion,
      whatsappReceiptTemplate,
      whatsappReminderTemplate,
      whatsappDefaultLanguage,
      defaultLanguage: language,
      theme,
    });
    setSavedNotice('Settings saved.');
  };

  const handleBackupDownload = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      settings,
      members,
      collectionMonths,
      ledgers,
      payments,
      receipts,
      expenses,
      announcements,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MAA_Backup_${getCurrentISTDateISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestoreUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await restoreBackupJson(text);
      setSavedNotice('JSON backup restored.');
    } catch (err) {
      setSavedNotice(err instanceof Error ? err.message : 'Restore failed');
    }
  };

  const webhookUrl = `${window.location.origin}/api/whatsapp/webhook`;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {t(language, 'nav_settings')}
        </h2>
        <p className="text-xs text-slate-500">
          Committee details, collection rules, Meta WhatsApp Cloud API config & JSON backup
        </p>
      </div>

      {savedNotice && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
          {savedNotice}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Committee Details */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold border-b border-slate-200 dark:border-slate-800 pb-2">
            Committee & Collection Settings
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1">Committee Name</label>
              <input
                type="text"
                value={committeeName}
                onChange={(e) => setCommitteeName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1">Committee Address</label>
              <input
                type="text"
                value={committeeAddress}
                onChange={(e) => setCommitteeAddress(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Contact Number</label>
              <input
                type="text"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Puja Year</label>
              <input
                type="text"
                value={pujaYear}
                onChange={(e) => setPujaYear(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Default Monthly Chanda (₹)</label>
              <input
                type="number"
                value={defaultChandaRupees}
                onChange={(e) => setDefaultChandaRupees(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Financial Year</label>
              <input
                type="text"
                value={financialYear}
                onChange={(e) => setFinancialYear(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Monthly Due Day (1–28)</label>
              <input
                type="number"
                min="1"
                max="28"
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* WhatsApp Cloud API Settings (Non-secret IDs only; Token stays strictly in server env) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <h3 className="text-sm font-semibold">Official Meta WhatsApp Business Cloud API</h3>
            <span className="text-xs text-slate-500">
              Server Token: {serverWhatsappHealth.tokenConfigured ? 'Configured' : 'Not Configured'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-semibold">
              <Shield className="w-3.5 h-3.5 text-[#0F2143] dark:text-amber-300" />
              <span>Security Notice</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400">
              Permanent Access Token (<code>WHATSAPP_ACCESS_TOKEN</code>) and App Secret are stored strictly in server-side environment secrets and are never saved in Firestore or browser storage.
            </p>
            <p className="font-mono text-[11px] text-slate-700 dark:text-slate-300 pt-1">
              Webhook Callback URL: {webhookUrl}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="sm:col-span-2 flex items-center gap-2 text-xs font-medium">
              <input
                type="checkbox"
                checked={whatsappEnabled}
                onChange={(e) => setWhatsappEnabled(e.target.checked)}
              />
              <span>Enable automatic WhatsApp notifications after payment</span>
            </label>

            <div>
              <label className="block text-xs font-medium mb-1">Phone Number ID</label>
              <input
                type="text"
                value={whatsappPhoneNumberId}
                onChange={(e) => setWhatsappPhoneNumberId(e.target.value)}
                placeholder="Configured via env or enter ID"
                className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Business Account ID (WABA)</label>
              <input
                type="text"
                value={whatsappBusinessAccountId}
                onChange={(e) => setWhatsappBusinessAccountId(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Graph API Version</label>
              <input
                type="text"
                value={whatsappApiVersion}
                onChange={(e) => setWhatsappApiVersion(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Default Template Language</label>
              <select
                value={whatsappDefaultLanguage}
                onChange={(e) => setWhatsappDefaultLanguage(e.target.value as Language)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
              >
                <option value="bn">Bengali (bn)</option>
                <option value="en">English (en_US)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Approved Receipt Template Name</label>
              <input
                type="text"
                value={whatsappReceiptTemplate}
                onChange={(e) => setWhatsappReceiptTemplate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Approved Reminder Template Name</label>
              <input
                type="text"
                value={whatsappReminderTemplate}
                onChange={(e) => setWhatsappReminderTemplate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* App Preferences & Backup */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold border-b border-slate-200 dark:border-slate-800 pb-2">
            Application Preferences & Data Backup
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Interface Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
              >
                <option value="bn">বাংলা (Bengali — Default)</option>
                <option value="en">English</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Theme</label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
              >
                <option value="light">Light (Crisp White)</option>
                <option value="dark">Dark (Deep Slate)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleBackupDownload}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg"
              >
                <Download className="w-3.5 h-3.5" />
                Download JSON Backup
              </button>
              <input
                ref={restoreRef}
                type="file"
                accept=".json"
                onChange={handleRestoreUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => restoreRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg"
              >
                <Upload className="w-3.5 h-3.5" />
                Restore JSON Backup
              </button>
            </div>

            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold rounded-lg bg-[#0F2143] text-white hover:bg-[#162D59]"
            >
              Save Settings
            </button>
          </div>

          {mode !== 'FIREBASE' && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                {language === 'bn'
                  ? 'নমুনা তথ্য মুছে সম্পূর্ণ নতুন করে কমিটির হিসাব শুরু করতে চাইলে নিচের বোতাম ব্যবহার করুন।'
                  : 'Want to start with an empty committee ledger? Clear sample members, payments, and expenses.'}
              </p>
              {!confirmFreshReset ? (
                <button
                  type="button"
                  onClick={() => setConfirmFreshReset(true)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40 whitespace-nowrap"
                >
                  {language === 'bn' ? 'নমুনা তথ্য মুছুন (নতুন শুরু)' : 'Clear Sample Data'}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      resetToFreshCommitteeLedger();
                      setConfirmFreshReset(false);
                      setSavedNotice(
                        language === 'bn'
                          ? 'নমুনা তথ্য মুছে নতুন কমিটির হিসাব শুরু করা হয়েছে।'
                          : 'Cleared sample records. Fresh committee ledger ready.'
                      );
                    }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 whitespace-nowrap"
                  >
                    {language === 'bn' ? 'হ্যাঁ, সব নমুনা মুছুন' : 'Confirm Clear All'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmFreshReset(false)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 whitespace-nowrap"
                  >
                    {t(language, 'cancel')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </form>
    </div>
  );
};

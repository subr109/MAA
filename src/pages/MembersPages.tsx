import React, { useMemo, useRef, useState } from 'react';
import {
  Archive,
  Download,
  Edit3,
  Eye,
  IndianRupee,
  Plus,
  Search,
  Send,
  Upload,
  UserCheck,
  UserX,
  AlertTriangle,
  ArrowLeft,
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useMaa } from '../context/MaaContext';
import {
  computeMemberFinancialSummary,
  findDuplicateMobile,
  formatDateIN,
  formatINR,
  formatMonthLabel,
  generateNextMemberCode,
  getCurrentISTDateISO,
  paiseToRupees,
  rupeesToPaise,
} from '../lib/chandaEngine';
import { exportReportExcel, parseMembersSpreadsheet } from '../lib/exporters';
import { t } from '../lib/i18n';
import { Member, MemberCategory, Receipt, VALIDATION_LIMITS } from '../types/maa';
import { StatusLabel } from '../components/StatusLabel';
import { ReceiptModal } from '../components/ReceiptModal';

/* =========================================================
 * Page 3: Member List
 * ========================================================= */
export const MemberListPage: React.FC<{ onEditMember: (member: Member) => void }> = ({
  onEditMember,
}) => {
  const {
    language,
    members,
    ledgers,
    payments,
    setActivePage,
    setSelectedMemberId,
    setPrefillCollectMemberId,
    updateMember,
    importMembersBulk,
  } = useMaa();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [areaFilter, setAreaFilter] = useState<string>('ALL');
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const areas = useMemo(
    () => Array.from(new Set(members.map((m) => m.area).filter(Boolean) as string[])).sort(),
    [members]
  );

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return members.filter((m) => {
      if (statusFilter !== 'ALL' && m.status !== statusFilter) return false;
      if (statusFilter === 'ALL' && m.status === 'ARCHIVED') return false;
      if (categoryFilter !== 'ALL' && m.category !== categoryFilter) return false;
      if (areaFilter !== 'ALL' && m.area !== areaFilter) return false;
      if (!q) return true;
      return (
        m.fullName.toLowerCase().includes(q) ||
        m.memberCode.toLowerCase().includes(q) ||
        m.mobile.includes(q) ||
        (m.area || '').toLowerCase().includes(q)
      );
    });
  }, [members, searchTerm, statusFilter, categoryFilter, areaFilter]);

  const handleExportExcel = () => {
    const headers = [
      'Member ID',
      'Full Name',
      'Mobile',
      'WhatsApp',
      'Area',
      'Category',
      'Monthly Chanda (INR)',
      'Status',
      'WhatsApp Consent',
      'Advance (INR)',
    ];
    const rows = filtered.map((m) => [
      m.memberCode,
      m.fullName,
      m.mobile,
      m.whatsappNumber || m.mobile,
      m.area || '',
      m.category,
      paiseToRupees(m.monthlyChandaPaise),
      m.status,
      m.whatsappConsent ? 'Yes' : 'No',
      paiseToRupees(m.advanceBalancePaise || 0),
    ]);
    exportReportExcel('MAA_Members_List', 'Members', headers, rows);
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseMembersSpreadsheet(file);
      if (parsed.length === 0) {
        setImportFeedback('No valid member rows found (need Full Name and 10-digit Mobile).');
        return;
      }
      const imported = await importMembersBulk(
        parsed.map((r) => ({
          fullName: r.fullName,
          mobile: r.mobile,
          whatsappNumber: r.whatsappNumber,
          address: r.address,
          area: r.area,
          monthlyChandaPaise: rupeesToPaise(r.monthlyChandaRupees),
          category: r.category,
          whatsappConsent: r.whatsappConsent,
        }))
      );
      setImportFeedback(`Successfully imported ${imported} members.`);
    } catch (err) {
      setImportFeedback(err instanceof Error ? err.message : 'Failed to import file');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {t(language, 'nav_members')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {filtered.length} {language === 'bn' ? 'জন সদস্য প্রদর্শিত হচ্ছে' : 'members shown'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileImport}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50"
          >
            <Upload className="w-3.5 h-3.5" />
            {t(language, 'importCsv')}
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50"
          >
            <Download className="w-3.5 h-3.5" />
            {t(language, 'exportExcel')}
          </button>
          <button
            type="button"
            onClick={() => setActivePage('add-member')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#0F2143] text-white hover:bg-[#162D59]"
          >
            <Plus className="w-3.5 h-3.5" />
            {t(language, 'nav_add-member')}
          </button>
        </div>
      </div>

      {importFeedback && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between">
          <span>{importFeedback}</span>
          <button type="button" onClick={() => setImportFeedback(null)} className="underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={language === 'bn' ? 'নাম, MAA-ID বা মোবাইল...' : 'Name, MAA-ID, or mobile...'}
            className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
        >
          <option value="ALL">{language === 'bn' ? 'সকল স্ট্যাটাস (আর্কাইভ ছাড়া)' : 'All Statuses (Excl. Archived)'}</option>
          <option value="ACTIVE">{t(language, 'statusActive')}</option>
          <option value="INACTIVE">{t(language, 'statusInactive')}</option>
          <option value="ARCHIVED">{t(language, 'statusArchived')}</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
        >
          <option value="ALL">{language === 'bn' ? 'সকল ক্যাটাগরি' : 'All Categories'}</option>
          <option value="GENERAL">General</option>
          <option value="PATRON">Patron</option>
          <option value="FAMILY">Family</option>
          <option value="SENIOR">Senior</option>
          <option value="YOUTH">Youth</option>
        </select>
        <select
          value={areaFilter}
          onChange={(e) => setAreaFilter(e.target.value)}
          className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
        >
          <option value="ALL">{language === 'bn' ? 'সকল এলাকা' : 'All Areas'}</option>
          {areas.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      {/* Member Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-950 text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">{language === 'bn' ? 'নাম ও এলাকা' : 'Name & Area'}</th>
                <th className="px-4 py-3 font-medium">{language === 'bn' ? 'মোবাইল' : 'Mobile'}</th>
                <th className="px-4 py-3 font-medium text-right">{language === 'bn' ? 'মাসিক চাঁদা' : 'Monthly'}</th>
                <th className="px-4 py-3 font-medium text-right">{language === 'bn' ? 'মোট বকেয়া' : 'Outstanding'}</th>
                <th className="px-4 py-3 font-medium">{language === 'bn' ? 'অবস্থা' : 'Status'}</th>
                <th className="px-4 py-3 font-medium text-right">{language === 'bn' ? 'কার্যক্রম' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filtered.map((m) => {
                const summary = computeMemberFinancialSummary(m, ledgers, payments);
                return (
                  <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-[#0F2143] dark:text-amber-300">
                      {m.memberCode}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMemberId(m.id);
                          setActivePage('member-details');
                        }}
                        className="font-semibold text-slate-900 dark:text-slate-100 hover:underline text-left"
                      >
                        {m.fullName}
                      </button>
                      <div className="text-xs text-slate-500">
                        {m.area || '—'} · {m.category}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">
                      {m.mobile}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {formatINR(m.monthlyChandaPaise)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold">
                      <span
                        className={
                          summary.totalOutstandingPaise > 0
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }
                      >
                        {formatINR(summary.totalOutstandingPaise)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusLabel status={m.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          title="View Details"
                          onClick={() => {
                            setSelectedMemberId(m.id);
                            setActivePage('member-details');
                          }}
                          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          title="Collect Chanda"
                          onClick={() => {
                            setPrefillCollectMemberId(m.id);
                            setActivePage('collect');
                          }}
                          className="p-1.5 rounded-lg text-[#D95D16] hover:bg-amber-50 dark:hover:bg-slate-800"
                        >
                          <IndianRupee className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          title="Edit"
                          onClick={() => onEditMember(m)}
                          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          title={m.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                          onClick={() =>
                            updateMember(m.id, {
                              status: m.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                            })
                          }
                          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          {m.status === 'ACTIVE' ? (
                            <UserX className="w-4 h-4 text-amber-600" />
                          ) : (
                            <UserCheck className="w-4 h-4 text-emerald-600" />
                          )}
                        </button>
                        {m.status !== 'ARCHIVED' && (
                          <button
                            type="button"
                            title="Archive"
                            onClick={() => updateMember(m.id, { status: 'ARCHIVED' })}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
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
    </div>
  );
};

/* =========================================================
 * Page 4: Add / Edit Member
 * ========================================================= */
export const AddMemberPage: React.FC<{
  editingMember: Member | null;
  onDone: () => void;
}> = ({ editingMember, onDone }) => {
  const { language, members, settings, addMember, updateMember, setActivePage } = useMaa();

  const nextCode = useMemo(
    () => (editingMember ? editingMember.memberCode : generateNextMemberCode(members)),
    [editingMember, members]
  );

  const [fullName, setFullName] = useState(editingMember?.fullName || '');
  const [mobile, setMobile] = useState(editingMember?.mobile || '');
  const [whatsappNumber, setWhatsappNumber] = useState(editingMember?.whatsappNumber || '');
  const [address, setAddress] = useState(editingMember?.address || '');
  const [area, setArea] = useState(editingMember?.area || '');
  const [joiningDate, setJoiningDate] = useState(
    editingMember?.joiningDate || getCurrentISTDateISO()
  );
  const [monthlyChandaRupees, setMonthlyChandaRupees] = useState(
    editingMember
      ? String(paiseToRupees(editingMember.monthlyChandaPaise))
      : String(paiseToRupees(settings.defaultMonthlyChandaPaise))
  );
  const [category, setCategory] = useState<MemberCategory>(editingMember?.category || 'GENERAL');
  const [status, setStatus] = useState<Member['status']>(editingMember?.status || 'ACTIVE');
  const [whatsappConsent, setWhatsappConsent] = useState<boolean>(
    editingMember ? editingMember.whatsappConsent : true
  );
  const [notes, setNotes] = useState(editingMember?.notes || '');
  const [allowDuplicateMobile, setAllowDuplicateMobile] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const duplicateMember = useMemo(
    () => findDuplicateMobile(members, mobile, editingMember?.id),
    [members, mobile, editingMember?.id]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName.trim() || fullName.trim().length > VALIDATION_LIMITS.MAX_NAME_LENGTH) {
      setErrorMsg('Full name is required (max 120 characters).');
      return;
    }
    if (mobile.replace(/\D/g, '').length < 10) {
      setErrorMsg('Valid 10-digit mobile number is required.');
      return;
    }
    if (duplicateMember && !allowDuplicateMobile) {
      setErrorMsg(
        `Mobile number already belongs to ${duplicateMember.fullName} (${duplicateMember.memberCode}). Tick "Authorize duplicate mobile" if intentional.`
      );
      return;
    }

    setSaving(true);
    try {
      const payload = {
        fullName: fullName.trim().slice(0, VALIDATION_LIMITS.MAX_NAME_LENGTH),
        mobile: mobile.trim().slice(0, VALIDATION_LIMITS.MAX_MOBILE_LENGTH),
        whatsappNumber: (whatsappNumber.trim() || mobile.trim()).slice(0, VALIDATION_LIMITS.MAX_MOBILE_LENGTH),
        address: address.trim().slice(0, VALIDATION_LIMITS.MAX_ADDRESS_LENGTH),
        area: area.trim().slice(0, VALIDATION_LIMITS.MAX_AREA_LENGTH),
        joiningDate,
        monthlyChandaPaise: rupeesToPaise(monthlyChandaRupees),
        category,
        status,
        whatsappConsent,
        notes: notes.trim().slice(0, VALIDATION_LIMITS.MAX_NOTES_LENGTH),
      };

      if (editingMember) {
        await updateMember(editingMember.id, payload);
      } else {
        await addMember(payload);
      }
      onDone();
      setActivePage('members');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save member.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {editingMember
              ? language === 'bn'
                ? 'সদস্যের তথ্য সম্পাদনা'
                : 'Edit Member'
              : t(language, 'nav_add-member')}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {language === 'bn' ? 'স্বয়ংক্রিয় সদস্য আইডি:' : 'Member ID:'}{' '}
            <span className="font-mono font-semibold text-[#0F2143] dark:text-amber-300">
              {nextCode}
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            onDone();
            setActivePage('members');
          }}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {language === 'bn' ? 'সদস্য তালিকায় ফিরুন' : 'Back to Members'}
        </button>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'bn' ? 'সম্পূর্ণ নাম *' : 'Full Name *'}
            </label>
            <input
              type="text"
              required
              maxLength={VALIDATION_LIMITS.MAX_NAME_LENGTH}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'bn' ? 'মোবাইল নম্বর *' : 'Mobile Number *'}
            </label>
            <input
              type="tel"
              required
              maxLength={VALIDATION_LIMITS.MAX_MOBILE_LENGTH}
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
            />
            {duplicateMember && (
              <label className="mt-1.5 flex items-center gap-2 text-xs text-amber-700">
                <input
                  type="checkbox"
                  checked={allowDuplicateMobile}
                  onChange={(e) => setAllowDuplicateMobile(e.target.checked)}
                />
                <span>
                  Duplicate of {duplicateMember.memberCode}. Explicitly authorize?
                </span>
              </label>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'bn' ? 'হোয়াটসঅ্যাপ নম্বর' : 'WhatsApp Number'}
            </label>
            <input
              type="tel"
              maxLength={VALIDATION_LIMITS.MAX_MOBILE_LENGTH}
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              placeholder={mobile || '9830011223'}
              className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'bn' ? 'এলাকা / পাড়া' : 'Area / Locality'}
            </label>
            <input
              type="text"
              maxLength={VALIDATION_LIMITS.MAX_AREA_LENGTH}
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'bn' ? 'ঠিকানা' : 'Address'}
            </label>
            <input
              type="text"
              maxLength={VALIDATION_LIMITS.MAX_ADDRESS_LENGTH}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'bn' ? 'ব্যক্তিগত মাসিক চাঁদা (₹) *' : 'Monthly Chanda Amount (₹) *'}
            </label>
            <input
              type="number"
              min="0"
              step="1"
              required
              value={monthlyChandaRupees}
              onChange={(e) => setMonthlyChandaRupees(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'bn' ? 'যোগদানের তারিখ' : 'Joining Date'}
            </label>
            <input
              type="date"
              value={joiningDate}
              onChange={(e) => setJoiningDate(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'bn' ? 'সদস্যের ধরণ' : 'Member Category'}
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as MemberCategory)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
            >
              <option value="GENERAL">General</option>
              <option value="PATRON">Patron</option>
              <option value="FAMILY">Family</option>
              <option value="SENIOR">Senior</option>
              <option value="YOUTH">Youth</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'bn' ? 'সদস্যের অবস্থা' : 'Member Status'}
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Member['status'])}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="flex items-center gap-2.5 text-sm text-slate-800 dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={whatsappConsent}
                onChange={(e) => setWhatsappConsent(e.target.checked)}
                className="rounded"
              />
              <span>
                {language === 'bn'
                  ? 'সদস্য হোয়াটসঅ্যাপ রসিদ ও বকেয়া রিমাইন্ডার পেতে সম্মত আছেন (WhatsApp Consent)'
                  : 'Member has consented to receive official WhatsApp receipts & reminders'}
              </span>
            </label>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'bn' ? 'মন্তব্য' : 'Notes'}
            </label>
            <textarea
              rows={2}
              maxLength={VALIDATION_LIMITS.MAX_NOTES_LENGTH}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              onDone();
              setActivePage('members');
            }}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50"
          >
            {t(language, 'cancel')}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 text-sm font-semibold text-white bg-[#0F2143] hover:bg-[#162D59] rounded-lg disabled:opacity-50"
          >
            {saving ? t(language, 'loading') : t(language, 'save')}
          </button>
        </div>
      </form>
    </div>
  );
};

/* =========================================================
 * Page 5: Member Details
 * ========================================================= */
export const MemberDetailsPage: React.FC<{ onEditMember: (member: Member) => void }> = ({
  onEditMember,
}) => {
  const {
    language,
    members,
    ledgers,
    payments,
    receipts,
    selectedMemberId,
    setSelectedMemberId,
    selectedMonthKey,
    setPrefillCollectMemberId,
    setActivePage,
    sendWhatsappReminder,
    currentUser,
    liveCommitteeSummary,
  } = useMaa();

  const [previewReceipt, setPreviewReceipt] = useState<Receipt | null>(null);
  const [waFeedback, setWaFeedback] = useState<string | null>(null);

  const member = useMemo(() => {
    if (selectedMemberId) return members.find((m) => m.id === selectedMemberId) || members[0];
    if (currentUser?.memberId) return members.find((m) => m.id === currentUser.memberId) || members[0];
    return members[0];
  }, [selectedMemberId, members, currentUser]);

  if (!member) {
    return (
      <div className="p-8 text-center text-slate-500">
        {t(language, 'noRecords')}
      </div>
    );
  }

  const summary = computeMemberFinancialSummary(member, ledgers, payments);
  const memberLedgers = ledgers
    .filter((l) => l.memberId === member.id)
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  const memberPayments = payments
    .filter((p) => p.memberId === member.id)
    .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
  const memberReceipts = receipts
    .filter((r) => r.memberId === member.id)
    .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));

  const isAdmin = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'COLLECTION_ADMIN';

  const handleReminder = async () => {
    setWaFeedback(null);
    try {
      const pendingText =
        summary.pendingMonthKeys.map((mk) => formatMonthLabel(mk, language)).join(', ') ||
        'Current Dues';
      const notif = await sendWhatsappReminder(
        member,
        pendingText,
        summary.totalOutstandingPaise
      );
      if (notif.status === 'FAILED') {
        setWaFeedback(`WhatsApp failed: ${notif.errorMessage}`);
      } else {
        setWaFeedback(`WhatsApp ${notif.status} (ID: ${notif.metaMessageId || notif.notificationId})`);
      }
    } catch (err) {
      setWaFeedback(err instanceof Error ? err.message : 'Unable to send reminder');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {isAdmin && (
            <select
              value={member.id}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              className="px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.memberCode} — {m.fullName}
                </option>
              ))}
            </select>
          )}
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {member.fullName}
            </h2>
            <p className="text-xs text-slate-500 font-mono">
              {member.memberCode} · {member.mobile} · {member.area || '—'}
            </p>
          </div>
        </div>

        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onEditMember(member)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900"
            >
              <Edit3 className="w-3.5 h-3.5" />
              {t(language, 'edit')}
            </button>
            <button
              type="button"
              onClick={handleReminder}
              disabled={!member.whatsappConsent || summary.totalOutstandingPaise <= 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-45"
            >
              <Send className="w-3.5 h-3.5" />
              {language === 'bn' ? 'হোয়াটসঅ্যাপ রিমাইন্ডার' : 'WhatsApp Reminder'}
            </button>
            <button
              type="button"
              onClick={() => {
                setPrefillCollectMemberId(member.id);
                setActivePage('collect');
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#0F2143] text-white hover:bg-[#162D59]"
            >
              <IndianRupee className="w-3.5 h-3.5" />
              {t(language, 'qaCollectChanda')}
            </button>
          </div>
        )}
      </div>

      {waFeedback && (
        <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
          {waFeedback}
        </div>
      )}

      {/* Profile + KPIs + QR Code */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {language === 'bn' ? 'ব্যক্তিগত ও আর্থিক সারসংক্ষেপ' : 'Personal & Financial Overview'}
            </h3>
            <StatusLabel status={member.status} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-xs text-slate-500">{language === 'bn' ? 'মাসিক চাঁদা' : 'Monthly Rate'}</div>
              <div className="font-mono font-bold text-base mt-1">{formatINR(member.monthlyChandaPaise)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">{language === 'bn' ? 'মোট জমা' : 'Total Paid'}</div>
              <div className="font-mono font-bold text-base text-emerald-700 dark:text-emerald-400 mt-1">
                {formatINR(summary.totalPaidPaise)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">{language === 'bn' ? 'মোট বকেয়া' : 'Outstanding'}</div>
              <div className="font-mono font-bold text-base text-amber-700 dark:text-amber-400 mt-1">
                {formatINR(summary.totalOutstandingPaise)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">{language === 'bn' ? 'অগ্রিম ব্যালেন্স' : 'Advance'}</div>
              <div className="font-mono font-bold text-base text-[#0F2143] dark:text-amber-300 mt-1">
                {formatINR(summary.advanceBalancePaise)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div>Address: {member.address || '—'}</div>
            <div>Joining Date: {formatDateIN(member.joiningDate)}</div>
            <div>WhatsApp Consent: {member.whatsappConsent ? 'Opted-in' : 'Not opted-in'}</div>
            <div>Category: {member.category}</div>
          </div>
        </div>

        {/* Non-sensitive Member QR Code */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col items-center justify-center text-center space-y-3">
          <QRCodeCanvas
            value={`MAA-MEM:${member.memberCode}`}
            size={132}
            level="M"
            includeMargin
          />
          <div>
            <div className="font-mono text-sm font-bold text-[#0F2143] dark:text-amber-300">
              {member.memberCode}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {language === 'bn'
                ? 'সদস্য যাচাই ও দ্রুত চাঁদা সংগ্রহের QR কোড'
                : 'Non-sensitive Member Verification QR'}
            </p>
          </div>
        </div>
      </div>

      {/* Non-PII Live Committee Totals for Member Portal */}
      {!isAdmin && (
        <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/60 rounded-xl p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {language === 'bn'
                ? 'কমিটির লাইভ তহবিল সারসংক্ষেপ'
                : 'Live Committee Fund Overview'}
            </h3>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {formatMonthLabel(selectedMonthKey, language)} ·{' '}
              {language === 'bn' ? 'রিয়েল-টাইম আপডেট' : 'Real-Time Live Sync'}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
            <div>
              <div className="text-xs text-slate-500">{t(language, 'kpiActiveMembers')}</div>
              <div className="font-mono font-bold text-base mt-1">
                {liveCommitteeSummary.activeMembersCount}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">{t(language, 'kpiMonthlyExpected')}</div>
              <div className="font-mono font-bold text-base mt-1">
                {formatINR(liveCommitteeSummary.monthExpectedPaise)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">{t(language, 'kpiThisMonthCollection')}</div>
              <div className="font-mono font-bold text-base text-emerald-700 dark:text-emerald-400 mt-1">
                {formatINR(liveCommitteeSummary.monthCollectedPaise)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">{t(language, 'kpiTotalExpenses')}</div>
              <div className="font-mono font-bold text-base text-amber-700 dark:text-amber-400 mt-1">
                {formatINR(liveCommitteeSummary.totalExpensesPaise)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">{t(language, 'kpiAvailableBalance')}</div>
              <div className="font-mono font-bold text-base text-[#0F2143] dark:text-amber-300 mt-1">
                {formatINR(liveCommitteeSummary.availableBalancePaise)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Monthly Payment Status Grid */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
          {language === 'bn' ? 'মাসভিত্তিক চাঁদার স্থিতি' : 'Monthly Payment Status'}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {memberLedgers.map((l) => (
            <div
              key={l.id}
              className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-1.5"
            >
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {formatMonthLabel(l.monthKey, language)}
              </div>
              <div className="text-[11px] font-mono text-slate-500">
                Due {formatINR(l.duePaise)} · Paid {formatINR(l.paidPaise)}
              </div>
              <StatusLabel status={l.status} label={t(language, `status${l.status[0] + l.status.slice(1).toLowerCase()}`)} />
            </div>
          ))}
        </div>
      </div>

      {/* Payment Ledger & Receipt History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 font-semibold text-sm">
            {language === 'bn' ? 'পেমেন্ট লেজার' : 'Payment Ledger'}
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {memberPayments.map((p) => (
              <div key={p.id} className="px-5 py-3 flex items-center justify-between text-sm">
                <div>
                  <div className="font-mono text-xs font-medium">{p.receiptNumber}</div>
                  <div className="text-xs text-slate-500">
                    {formatDateIN(p.paymentDate)} · {p.paymentMethod}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold">{formatINR(p.amountPaise)}</div>
                  <StatusLabel status={p.status} />
                </div>
              </div>
            ))}
            {memberPayments.length === 0 && (
              <div className="px-5 py-6 text-center text-xs text-slate-500">{t(language, 'noRecords')}</div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 font-semibold text-sm">
            {language === 'bn' ? 'রসিদ ইতিহাস' : 'Receipt History'}
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {memberReceipts.map((r) => (
              <div key={r.id} className="px-5 py-3 flex items-center justify-between text-sm">
                <div>
                  <div className="font-mono text-xs font-semibold text-[#0F2143] dark:text-amber-300">
                    {r.receiptNumber}
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatMonthLabel(r.monthKey, language)} · {formatDateIN(r.paymentDate)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewReceipt(r)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50"
                >
                  {t(language, 'view')}
                </button>
              </div>
            ))}
            {memberReceipts.length === 0 && (
              <div className="px-5 py-6 text-center text-xs text-slate-500">{t(language, 'noRecords')}</div>
            )}
          </div>
        </div>
      </div>

      <ReceiptModal receipt={previewReceipt} onClose={() => setPreviewReceipt(null)} />
    </div>
  );
};

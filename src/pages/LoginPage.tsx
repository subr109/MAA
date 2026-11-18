import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useMaa } from '../context/MaaContext';
import { t } from '../lib/i18n';
import { DEFAULT_COMMITTEE_NAME } from '../lib/whatsappTemplates';
import { MaaLogo } from '../components/MaaLogo';
import pujaBannerImg from '../assets/images/puja_heritage_banner_1794999344685.jpg';
import maaEmblemImg from '../assets/images/maa_durga_emblem_1794999344327.jpg';

export const LoginPage: React.FC = () => {
  const {
    language,
    setLanguage,
    loginWithAdminCredentials,
    enterMemberPortal,
    settings,
  } = useMaa();

  const [adminId, setAdminId] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [memberLookup, setMemberLookup] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const committeeTitle = settings.committeeName || DEFAULT_COMMITTEE_NAME;

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setAdminLoading(true);
    try {
      await loginWithAdminCredentials(adminId, adminPassword);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Admin authentication failed'
      );
    } finally {
      setAdminLoading(false);
    }
  };

  const handleMemberPortalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      enterMemberPortal(memberLookup);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to open Member Portal'
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col lg:flex-row">
      {/* Left Heritage Visual Panel */}
      <div className="relative lg:w-1/2 bg-[#0F2143] text-white flex flex-col justify-between p-8 lg:p-12 overflow-hidden">
        <img
          src={pujaBannerImg}
          alt="Puja evening diyas and marigold garlands"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#09152C] via-[#0F2143]/75 to-[#0F2143]/60" />

        <div className="relative z-10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={maaEmblemImg}
              alt="MAA Puja Emblem"
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-full object-cover border border-amber-400/50 shrink-0"
            />
            <div className="min-w-0">
              <span className="text-xl font-bold tracking-tight">MAA</span>
              <p className="text-xs text-amber-300 truncate">
                Monthly Association Account
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLanguage(language === 'bn' ? 'en' : 'bn')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-white/25 bg-white/10 hover:bg-white/20 transition-colors whitespace-nowrap shrink-0"
          >
            <Globe className="w-3.5 h-3.5" />
            {language === 'bn' ? 'English' : 'বাংলা'}
          </button>
        </div>

        <div className="relative z-10 my-10 lg:my-0 space-y-4 max-w-xl">
          <p className="text-xs uppercase tracking-wider text-amber-300 font-semibold">
            {t(language, 'tagline')}
          </p>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-snug text-balance">
            {committeeTitle}
          </h1>
          <p className="text-sm lg:text-base text-slate-200 leading-relaxed">
            {t(language, 'loginTitle')} — {t(language, 'loginSubtitle')}
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-4 text-xs text-slate-300">
          <span>INR (₹) Accounting</span>
          <span aria-hidden="true">·</span>
          <span>DD-MM-YYYY · Asia/Kolkata</span>
          <span aria-hidden="true">·</span>
          <span>বাংলা &amp; English</span>
        </div>
      </div>

      {/* Right Authentication Panel */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 sm:p-10 lg:p-12 overflow-y-auto">
        <div className="max-w-md w-full space-y-6">
          <div className="flex items-start gap-3">
            <MaaLogo size={42} />
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-snug">
                {committeeTitle}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t(language, 'appFullName')}
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-lg border border-red-200 bg-red-50 text-red-800 text-xs leading-relaxed">
              {errorMsg}
            </div>
          )}

          {/* Committee Admin ID & Password Sign-In */}
          <form
            onSubmit={handleAdminSubmit}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
          >
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#D95D16]" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {language === 'bn'
                  ? 'কমিটি অ্যাডমিন লগইন'
                  : 'Committee Admin Sign In'}
              </h3>
            </div>

            <div className="space-y-3">
              <div>
                <label
                  htmlFor="maa-admin-id"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  {language === 'bn' ? 'অ্যাডমিন আইডি (Admin ID)' : 'Admin ID'}
                </label>
                <input
                  id="maa-admin-id"
                  type="text"
                  required
                  autoComplete="username"
                  value={adminId}
                  onChange={(e) => setAdminId(e.target.value)}
                  placeholder="Admin"
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D95D16]/40"
                />
              </div>

              <div>
                <label
                  htmlFor="maa-admin-password"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  {language === 'bn' ? 'পাসওয়ার্ড (Password)' : 'Password'}
                </label>
                <div className="relative">
                  <input
                    id="maa-admin-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-3 pr-10 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D95D16]/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={adminLoading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#D95D16] hover:bg-[#c24f0e] text-white text-sm font-semibold transition-colors disabled:opacity-60 whitespace-nowrap"
            >
              <ShieldCheck className="w-4 h-4" />
              {adminLoading
                ? t(language, 'loading')
                : language === 'bn'
                  ? 'অ্যাডমিন প্যানেলে প্রবেশ করুন'
                  : 'Sign In as Committee Admin'}
            </button>
          </form>

          {/* Member Portal Only Section */}
          <form
            onSubmit={handleMemberPortalSubmit}
            className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/60 rounded-xl p-5 space-y-3.5"
          >
            <div className="flex items-start gap-2.5">
              <Users className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {t(language, 'memberPortalTitle')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {language === 'bn'
                    ? 'আপনার সদস্য আইডি (যেমন MAA-0001) বা মোবাইল নম্বর দিয়ে নিজের চাঁদার স্থিতি, বকেয়া, রসিদ ও ঘোষণা দেখুন।'
                    : 'View your personal monthly status, dues, digital receipts & committee announcements.'}
                </p>
              </div>
            </div>

            <div>
              <label
                htmlFor="maa-member-lookup"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                {language === 'bn'
                  ? 'সদস্য আইডি বা মোবাইল নম্বর (ঐচ্ছিক)'
                  : 'Member ID or Mobile Number (Optional)'}
              </label>
              <input
                id="maa-member-lookup"
                type="text"
                value={memberLookup}
                onChange={(e) => setMemberLookup(e.target.value)}
                placeholder="MAA-0001 / 9831098765"
                className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
              />
            </div>

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition-colors whitespace-nowrap"
            >
              <Users className="w-4 h-4" />
              {language === 'bn'
                ? 'সদস্য পোর্টালে প্রবেশ করুন'
                : 'Open Member Portal'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

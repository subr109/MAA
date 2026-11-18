import React, { useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Clock,
  FileBarChart2,
  FileSpreadsheet,
  Globe,
  History,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  QrCode,
  Receipt,
  ScrollText,
  Settings,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useMaa } from '../context/MaaContext';
import { t } from '../lib/i18n';
import { Member, PageId } from '../types/maa';
import { MaaLogo } from './MaaLogo';
import { PWAInstallButton } from './PWAInstallButton';
import { DashboardPage } from '../pages/DashboardPage';
import { AddMemberPage, MemberDetailsPage, MemberListPage } from '../pages/MembersPages';
import {
  MemberLedgerPage,
  MonthlyCollectionPage,
  NewCollectionEntryPage,
  PaymentHistoryPage,
  PendingMembersPage,
} from '../pages/CollectionPages';
import { DigitalReceiptsPage, QrScannerPage } from '../pages/ReceiptsAndQrPages';
import { ExpenseManagementPage, ReportsAnalyticsPage } from '../pages/ExpensesAndReportsPages';
import {
  AdminManagementPage,
  AnnouncementsPage,
  AuditLogsPage,
  SettingsPage,
  WhatsappNotificationsPage,
} from '../pages/CommsAndAdminPages';

interface NavItem {
  id: PageId;
  icon: React.ComponentType<{ className?: string }>;
  roles: Array<'SUPER_ADMIN' | 'COLLECTION_ADMIN' | 'MEMBER'>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'COLLECTION_ADMIN'] },
  { id: 'collect', icon: IndianRupee, roles: ['SUPER_ADMIN', 'COLLECTION_ADMIN'] },
  { id: 'monthly-collection', icon: Calendar, roles: ['SUPER_ADMIN', 'COLLECTION_ADMIN'] },
  { id: 'pending', icon: Clock, roles: ['SUPER_ADMIN', 'COLLECTION_ADMIN'] },
  { id: 'members', icon: Users, roles: ['SUPER_ADMIN', 'COLLECTION_ADMIN'] },
  { id: 'add-member', icon: UserPlus, roles: ['SUPER_ADMIN', 'COLLECTION_ADMIN'] },
  { id: 'member-details', icon: UserCheck, roles: ['SUPER_ADMIN', 'COLLECTION_ADMIN', 'MEMBER'] },
  { id: 'ledger', icon: FileSpreadsheet, roles: ['SUPER_ADMIN', 'COLLECTION_ADMIN'] },
  { id: 'payments', icon: History, roles: ['SUPER_ADMIN', 'COLLECTION_ADMIN'] },
  { id: 'receipts', icon: Receipt, roles: ['SUPER_ADMIN', 'COLLECTION_ADMIN', 'MEMBER'] },
  { id: 'qr-scanner', icon: QrCode, roles: ['SUPER_ADMIN', 'COLLECTION_ADMIN'] },
  { id: 'expenses', icon: Wallet, roles: ['SUPER_ADMIN', 'COLLECTION_ADMIN'] },
  { id: 'reports', icon: FileBarChart2, roles: ['SUPER_ADMIN', 'COLLECTION_ADMIN'] },
  { id: 'whatsapp', icon: MessageSquare, roles: ['SUPER_ADMIN', 'COLLECTION_ADMIN'] },
  { id: 'announcements', icon: Megaphone, roles: ['SUPER_ADMIN', 'COLLECTION_ADMIN', 'MEMBER'] },
  { id: 'admins', icon: ShieldCheck, roles: ['SUPER_ADMIN'] },
  { id: 'audit-logs', icon: ScrollText, roles: ['SUPER_ADMIN'] },
  { id: 'settings', icon: Settings, roles: ['SUPER_ADMIN'] },
];

export const AppShell: React.FC = () => {
  const {
    mode,
    currentUser,
    language,
    setLanguage,
    activePage,
    setActivePage,
    settings,
    logout,
  } = useMaa();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  const visibleNav = NAV_ITEMS.filter((item) =>
    currentUser ? item.roles.includes(currentUser.role) : false
  );

  const handleNavClick = (id: PageId) => {
    if (id !== 'add-member') setEditingMember(null);
    setActivePage(id);
    setMobileMenuOpen(false);
  };

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'members':
        return (
          <MemberListPage
            onEditMember={(member) => {
              setEditingMember(member);
              setActivePage('add-member');
            }}
          />
        );
      case 'add-member':
        return (
          <AddMemberPage
            editingMember={editingMember}
            onDone={() => setEditingMember(null)}
          />
        );
      case 'member-details':
        return (
          <MemberDetailsPage
            onEditMember={(member) => {
              setEditingMember(member);
              setActivePage('add-member');
            }}
          />
        );
      case 'monthly-collection':
        return <MonthlyCollectionPage />;
      case 'collect':
        return <NewCollectionEntryPage />;
      case 'payments':
        return <PaymentHistoryPage />;
      case 'pending':
        return <PendingMembersPage />;
      case 'ledger':
        return <MemberLedgerPage />;
      case 'receipts':
        return <DigitalReceiptsPage />;
      case 'qr-scanner':
        return <QrScannerPage />;
      case 'expenses':
        return <ExpenseManagementPage />;
      case 'reports':
        return <ReportsAnalyticsPage />;
      case 'whatsapp':
        return <WhatsappNotificationsPage />;
      case 'announcements':
        return <AnnouncementsPage />;
      case 'admins':
        return <AdminManagementPage />;
      case 'audit-logs':
        return <AuditLogsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage />;
    }
  };

  const mobileQuickNav = visibleNav.slice(0, 4);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex">
      {/* Desktop Left Sidebar */}
      <aside className="no-print hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-[#0F2143] text-slate-100 border-r border-slate-800">
        <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
          <MaaLogo size={38} />
          <div className="min-w-0">
            <div className="text-base font-bold tracking-tight text-white">MAA</div>
            <div className="text-[11px] text-amber-300 leading-snug line-clamp-2">
              {settings.committeeName}
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                  active
                    ? 'bg-[#D95D16] text-white'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{t(language, `nav_${item.id}`)}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-2">
          <div className="text-xs text-slate-300 truncate">{currentUser?.name}</div>
          <div className="text-[11px] text-amber-300 font-mono">{currentUser?.role}</div>
          <button
            type="button"
            onClick={logout}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-white/10 hover:bg-white/20 text-white"
          >
            <LogOut className="w-3.5 h-3.5" />
            {t(language, 'logout')}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="no-print sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Open Navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {t(language, `nav_${activePage}`)}
              </span>
              <span className="hidden sm:inline text-slate-300">·</span>
              <span className="hidden md:inline text-xs font-medium text-[#0F2143] dark:text-amber-300 truncate max-w-[320px]">
                {settings.committeeName}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton variant="header" />
            <button
              type="button"
              onClick={() => setLanguage(language === 'bn' ? 'en' : 'bn')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <Globe className="w-3.5 h-3.5" />
              {language === 'bn' ? 'English' : 'বাংলা'}
            </button>
            <button
              type="button"
              onClick={logout}
              className="lg:hidden inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* Explicit Session / Portal Mode Banner */}
        {(mode === 'MEMBER_PORTAL' || mode === 'LOCAL_ADMIN') && (
          <div className="no-print bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900 px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-[#D95D16] shrink-0" />
              <span className="font-medium">
                {mode === 'LOCAL_ADMIN'
                  ? t(language, 'localAdminBanner')
                  : t(language, 'memberPortalBanner')}
              </span>
            </div>
            <button
              type="button"
              onClick={logout}
              className="font-semibold underline hover:no-underline whitespace-nowrap"
            >
              {t(language, 'switchToLive')}
            </button>
          </div>
        )}

        {/* Viewport Content */}
        <main className="flex-1 p-4 sm:p-6 pb-24 lg:pb-8 max-w-[1440px] w-full mx-auto">
          {renderPage()}
        </main>
      </div>

      {/* Mobile Bottom Navigation (<= 15% viewport height) */}
      <nav className="no-print lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {mobileQuickNav.map((item) => {
          const Icon = item.icon;
          const active = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.id)}
              className={`flex flex-col items-center justify-center py-2 px-1 text-[10px] font-medium min-h-[54px] ${
                active
                  ? 'text-[#D95D16]'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span className="truncate max-w-full">{t(language, `nav_${item.id}`)}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center justify-center py-2 px-1 text-[10px] font-medium text-slate-600 dark:text-slate-400 min-h-[54px]"
        >
          <Menu className="w-4 h-4 mb-0.5" />
          <span>{language === 'bn' ? 'আরও' : 'More'}</span>
        </button>
      </nav>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="no-print lg:hidden fixed inset-0 z-50 bg-slate-950/60 flex">
          <div className="w-72 bg-[#0F2143] text-white h-full flex flex-col">
            <div className="px-4 py-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <MaaLogo size={32} />
                <span className="font-bold">MAA</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {visibleNav.map((item) => {
                const Icon = item.icon;
                const active = activePage === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium text-left ${
                      active ? 'bg-[#D95D16] text-white' : 'text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{t(language, `nav_${item.id}`)}</span>
                  </button>
                );
              })}
            </div>
            <div className="p-3 border-t border-white/10">
              <PWAInstallButton variant="drawer" />
            </div>
          </div>
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}
    </div>
  );
};

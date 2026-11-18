import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useMaa } from '../context/MaaContext';

interface PWAInstallButtonProps {
  variant?: 'header' | 'banner' | 'drawer';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
}) => {
  const { language } = useMaa();
  const { isInstallable, isInstalled, isIOS, isAndroid, install } =
    usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // Suppress button when already installed or running inside Capacitor Android APK
  if (isInstalled) {
    return null;
  }

  const label =
    language === 'bn' ? 'Android অ্যাপ ইনস্টল' : 'Install Android App';

  const handleClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuide(true);
    }
  };

  if (isInstallable) {
    if (variant === 'drawer') {
      return (
        <button
          type="button"
          onClick={install}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#D95D16] hover:bg-[#c24f0e] text-white text-xs font-semibold transition-colors whitespace-nowrap"
        >
          <Download className="w-4 h-4 shrink-0" />
          <span>{label}</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#D95D16] hover:bg-[#c24f0e] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>{label}</span>
      </button>
    );
  }

  if (isIOS || isAndroid || variant === 'banner') {
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          className={
            variant === 'drawer'
              ? 'w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-amber-400/40 bg-white/10 hover:bg-white/20 text-amber-200 text-xs font-medium transition-colors whitespace-nowrap'
              : 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors whitespace-nowrap shrink-0'
          }
        >
          <Smartphone className="w-3.5 h-3.5 shrink-0 text-[#D95D16]" />
          <span>{label}</span>
        </button>

        {showGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xl space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-[#D95D16]" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {isIOS
                      ? language === 'bn'
                        ? 'iPhone / iPad-এ ইনস্টল করুন'
                        : 'Install on iPhone / iPad'
                      : language === 'bn'
                        ? 'Android ফোনে অ্যাপ ইনস্টল করুন'
                        : 'Install on Android Phone'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isIOS ? (
                <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-2 list-decimal pl-4 leading-relaxed">
                  <li>
                    {language === 'bn'
                      ? 'Safari ব্রাউজারের নিচে Share বাটনে ট্যাপ করুন।'
                      : 'Tap the Share button in the Safari toolbar.'}
                  </li>
                  <li>
                    {language === 'bn'
                      ? '"Add to Home Screen" নির্বাচন করুন এবং Add চাপুন।'
                      : 'Scroll down and tap "Add to Home Screen".'}
                  </li>
                </ol>
              ) : (
                <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-2 list-decimal pl-4 leading-relaxed">
                  <li>
                    {language === 'bn'
                      ? 'আপনার Android ফোনে Google Chrome ব্রাউজারে এই লিংকটি খুলুন।'
                      : 'Open this URL in Google Chrome on your Android phone.'}
                  </li>
                  <li>
                    {language === 'bn'
                      ? 'উপরে ডানদিকে মেনু (⋮) ট্যাপ করে "Install App" বা "Add to Home screen" চাপুন।'
                      : 'Tap the browser menu (⋮) and choose "Install App" or "Add to Home screen".'}
                  </li>
                  <li>
                    {language === 'bn'
                      ? 'অ্যাপটি মূল স্ক্রিনে MAA Chanda আইকনসহ যুক্ত হবে এবং অফলাইনেও কাজ করবে।'
                      : 'MAA Chanda will install on your home screen as a standalone Android app with offline cache.'}
                  </li>
                </ol>
              )}

              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="w-full rounded-lg bg-[#0F2143] hover:bg-[#162D59] py-2 text-xs font-semibold text-white transition-colors"
              >
                {language === 'bn' ? 'ঠিক আছে' : 'Got It'}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

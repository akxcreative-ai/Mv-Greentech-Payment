import React, { useState, useEffect } from 'react';
import { Download, X, Share2, PlusSquare, Smartphone, Check } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const STORAGE_KEY = 'mv_pwa_install_dismissed_at';
const DISMISS_DURATION_DAYS = 7;

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if running in standalone PWA mode
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(Boolean(isStandaloneMode));
      return Boolean(isStandaloneMode);
    };

    if (checkStandalone()) {
      return;
    }

    // Check if user previously dismissed the prompt within DISMISS_DURATION_DAYS
    const dismissedAt = localStorage.getItem(STORAGE_KEY);
    if (dismissedAt) {
      const daysSinceDismissal =
        (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissal < DISMISS_DURATION_DAYS) {
        return;
      }
    }

    // Detect iOS device (Safari doesn't fire beforeinstallprompt)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent) && !/windows phone/.test(userAgent);
    setIsIOS(isAppleDevice);

    if (isAppleDevice) {
      // Show prompt on iOS after a brief delay so page loads cleanly
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 3000);
      return () => clearTimeout(timer);
    }

    // Handle standard Chromium/Android beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    // Handle app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsVisible(false);
      setDeferredPrompt(null);
      localStorage.removeItem(STORAGE_KEY);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
      return;
    }

    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
        setIsVisible(false);
      } else {
        handleDismiss();
      }
    } catch (err) {
      console.warn('PWA install prompt error:', err);
    } finally {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setShowIOSInstructions(false);
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
  };

  // If already standalone PWA or dismissed, render nothing
  if (isStandalone || isInstalled || !isVisible) {
    return null;
  }

  return (
    <>
      {/* Bottom Floating Install Banner */}
      <aside
        aria-label="App installation prompt"
        className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-2xl shadow-2xl p-4 sm:p-5 transition-all duration-300 animate-slide-up"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 p-1 flex items-center justify-center shadow-xs flex-shrink-0">
              <img src="/logo.png" alt="MV Greentech" className="w-10 h-10 object-contain" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Install MV Greentech App
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                Install on your mobile or desktop for fast payment approvals and real-time alerts.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg transition-colors flex-shrink-0"
            aria-label="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleDismiss}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Not Now
          </button>
          <button
            type="button"
            onClick={handleInstallClick}
            className="inline-flex items-center px-4 py-1.5 text-xs font-semibold text-white bg-navy-600 hover:bg-navy-700 dark:bg-cyan-600 dark:hover:bg-cyan-700 rounded-lg shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Install App
          </button>
        </div>
      </aside>

      {/* iOS Safari Instructions Modal */}
      {showIOSInstructions && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-2xl max-w-sm w-full p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowIOSInstructions(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-xl bg-navy-50 dark:bg-navy-950/50 text-navy-600 dark:text-cyan-400 flex items-center justify-center mx-auto mb-3">
                <Smartphone className="w-7 h-7" />
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                Install on iPhone or iPad
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Follow these 2 simple steps in Safari to add the app to your Home Screen:
              </p>
            </div>

            <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300">
              <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                <div className="w-7 h-7 rounded-lg bg-navy-600 text-white flex items-center justify-center font-bold flex-shrink-0">
                  1
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    Tap the Share Button
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                    Look for the <Share2 className="w-3.5 h-3.5 inline mx-1 text-navy-600 dark:text-cyan-400" /> Share icon at the bottom of Safari toolbar.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                <div className="w-7 h-7 rounded-lg bg-navy-600 text-white flex items-center justify-center font-bold flex-shrink-0">
                  2
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    Select &quot;Add to Home Screen&quot;
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                    Scroll down in the share sheet and tap <PlusSquare className="w-3.5 h-3.5 inline mx-1 text-navy-600 dark:text-cyan-400" /> &quot;Add to Home Screen&quot;.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDismiss}
              className="w-full mt-6 py-2.5 bg-navy-600 hover:bg-navy-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Check className="w-4 h-4" />
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default PWAInstallPrompt;

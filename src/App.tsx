import React, { useState, useEffect } from 'react';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MotionProvider } from './context/MotionContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomeView } from './components/HomeView';
import { RegistrationFlow } from './components/RegistrationFlow';
import { TokenVerificationView } from './components/TokenVerificationView';
import { MemberPortal } from './components/MemberPortal';
import { AdminPortal } from './components/AdminPortal';
import { SchoolView } from './components/SchoolView';
import { AssociationView } from './components/AssociationView';
import { NoticesView } from './components/NoticesView';
import { ContactView } from './components/ContactView';
import { NewsView } from './components/NewsView';
import { CMSPageView } from './components/CMSPageView';
import { LoginModal } from './components/LoginModal';
import { SetupWizard } from './components/SetupWizard';
import { DatabaseUnavailableView } from './components/DatabaseUnavailableView';
import { apiFetch, safeJson } from './utils/api';
import {
  getCachedReadiness,
  setCachedReadiness,
  clearReadinessCache,
  AppReadinessState,
} from './utils/readinessCache';

function MainLayout() {
  const { language } = useLanguage();
  const { user, isAdmin } = useAuth();

  // Read client-side readiness cache to prevent redundant loading screens
  const cachedReadiness = getCachedReadiness();

  // Navigation routing state
  const [currentView, setCurrentView] = useState<string>('home');
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [isInstalled, setIsInstalled] = useState<boolean | null>(
    cachedReadiness ? cachedReadiness.isInstalled : true
  );
  const [setupReason, setSetupReason] = useState<string | undefined>();
  const [appState, setAppState] = useState<AppReadinessState>(
    cachedReadiness ? cachedReadiness.state : 'OPERATIONAL'
  );
  const [dbReport, setDbReport] = useState<any>(cachedReadiness?.report || null);

  const checkState = async (force = false) => {
    // If not forced and cache is fresh, skip redundant server calls
    if (!force) {
      const freshCache = getCachedReadiness();
      if (freshCache && freshCache.state === 'OPERATIONAL') {
        return;
      }
    }

    try {
      const res = await apiFetch('/api/system/db-status');
      if (res.ok) {
        const data = await res.json();
        setDbReport(data);
        if (data?.state === 'FRESH_INSTALLATION' || data?.is_installed === false) {
          clearReadinessCache();
          setIsInstalled(false);
          setAppState('FRESH_INSTALLATION');
          setSetupReason('Welcome! Please complete the first-time setup wizard to configure your database and alumni platform.');
        } else if (data?.state === 'DATABASE_UNAVAILABLE') {
          clearReadinessCache();
          setIsInstalled(true);
          setAppState('DATABASE_UNAVAILABLE');
        } else if (data?.state === 'SCHEMA_INCOMPLETE') {
          clearReadinessCache();
          setIsInstalled(true);
          setAppState('SCHEMA_INCOMPLETE');
        } else {
          setCachedReadiness('OPERATIONAL', true, data);
          setIsInstalled(true);
          setAppState('OPERATIONAL');
        }
      } else {
        const data = await res.json().catch(() => null);
        clearReadinessCache();
        setIsInstalled(true);
        if (data?.code === 'SCHEMA_INCOMPLETE' || data?.state === 'SCHEMA_INCOMPLETE') {
          setAppState('SCHEMA_INCOMPLETE');
        } else {
          setAppState('DATABASE_UNAVAILABLE');
        }
        setDbReport(data);
      }
    } catch {
      clearReadinessCache();
      setIsInstalled(true);
      setAppState('DATABASE_UNAVAILABLE');
    }
  };

  // Perform lightweight background check and register live database outage listeners
  useEffect(() => {
    // Non-blocking initial check
    checkState(false);

    // Listen to live database outage events triggered by failed API requests
    const handleDbStateChange = (e: any) => {
      const newState = e.detail?.state;
      const report = e.detail?.report;
      if (newState === 'DATABASE_UNAVAILABLE' || newState === 'SCHEMA_INCOMPLETE') {
        setAppState(newState);
        if (report) setDbReport(report);
      } else if (newState === 'OPERATIONAL') {
        setAppState('OPERATIONAL');
        setCachedReadiness('OPERATIONAL', true, report);
      }
    };

    window.addEventListener('nash_db_state_changed', handleDbStateChange);
    return () => {
      window.removeEventListener('nash_db_state_changed', handleDbStateChange);
    };
  }, []);

  // Sync with URL query param or hash on initial load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    const tokenParam = params.get('token');

    if (tokenParam || viewParam === 'verify') {
      setCurrentView('verify');
    } else if (viewParam === 'setup') {
      // If already installed, don't enter setup wizard; clear query param
      if (isInstalled) {
        const url = new URL(window.location.href);
        url.searchParams.delete('view');
        window.history.replaceState({}, '', url.toString());
        setCurrentView('home');
      } else {
        setCurrentView('setup');
      }
    } else if (viewParam) {
      setCurrentView(viewParam);
    }
  }, [isInstalled]);

  const navigateTo = (view: string) => {
    if (view === 'setup' && isInstalled) {
      return;
    }
    if ((view === 'member' || view === 'profile') && !user) {
      setLoginModalOpen(true);
      return;
    }
    if (view === 'admin' && !isAdmin) {
      setLoginModalOpen(true);
      return;
    }
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLoginSuccess = (destinationRole: string) => {
    if (destinationRole === 'admin') {
      setCurrentView('admin');
    } else {
      setCurrentView('member');
    }
  };

  // State C & State D: Mandatory database is unavailable or schema is incomplete
  if (appState === 'DATABASE_UNAVAILABLE' || appState === 'SCHEMA_INCOMPLETE') {
    return (
      <DatabaseUnavailableView
        state={appState}
        report={dbReport}
        onRecovered={() => {
          checkState();
        }}
      />
    );
  }

  // State A: Fresh installation - Display only legitimate setup wizard
  if (appState === 'FRESH_INSTALLATION' && isInstalled === false) {
    return (
      <SetupWizard
        reason={setupReason}
        onComplete={() => {
          setIsInstalled(true);
          setAppState('OPERATIONAL');
          setCurrentView('home');
          const url = new URL(window.location.href);
          url.searchParams.delete('view');
          window.history.replaceState({}, '', url.toString());
        }}
      />
    );
  }

  // If in dedicated admin portal view and user is an admin
  if (currentView === 'admin' && isAdmin) {
    return <AdminPortal onExit={() => setCurrentView('home')} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-amber-400 selection:text-slate-950">
      {/* Header / Navbar */}
      <Navbar
        currentView={currentView}
        onNavigate={navigateTo}
        onOpenLogin={() => setLoginModalOpen(true)}
      />

      {/* Main View Router */}
      <main className="flex-1">
        {currentView === 'home' && <HomeView onNavigate={navigateTo} />}
        {currentView === 'register' && (
          <RegistrationFlow
            onGoToPortal={() => navigateTo('member')}
            onNavigate={(dest) => {
              const cleaned = dest.replace(/^\//, '').toLowerCase();
              if (!cleaned || cleaned === 'home') navigateTo('home');
              else if (cleaned.includes('verify')) navigateTo('verify');
              else if (cleaned.includes('member') || cleaned.includes('portal')) navigateTo('member');
              else if (cleaned.includes('profile')) navigateTo('profile');
              else if (cleaned.includes('school')) navigateTo('school');
              else if (cleaned.includes('association') || cleaned.includes('committee')) navigateTo('association');
              else if (cleaned.includes('notice')) navigateTo('notices');
              else if (cleaned.includes('news')) navigateTo('news');
              else if (cleaned.includes('contact')) navigateTo('contact');
              else navigateTo('home');
            }}
            onGoToVerify={(code) => {
              if (code) {
                window.history.pushState({}, '', `?token=${encodeURIComponent(code)}`);
              }
              navigateTo('verify');
            }}
          />
        )}
        {currentView === 'verify' && <TokenVerificationView />}
        {currentView === 'member' && <MemberPortal initialTab="pass" />}
        {currentView === 'profile' && <MemberPortal initialTab="profile" />}
        {currentView === 'school' && <SchoolView />}
        {currentView === 'association' && <AssociationView />}
        {currentView === 'committee' && <AssociationView />}
        {currentView === 'notices' && <NoticesView />}
        {currentView === 'news' && <NewsView onNavigate={navigateTo} />}
        {currentView === 'contact' && <ContactView />}
        {![
          'home',
          'register',
          'verify',
          'member',
          'profile',
          'school',
          'association',
          'committee',
          'notices',
          'news',
          'contact',
          'admin'
        ].includes(currentView) && (
          <CMSPageView slug={currentView} onNavigate={navigateTo} />
        )}
      </main>

      {/* Footer */}
      <Footer onNavigate={navigateTo} />

      {/* Sign In Modal */}
      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        onSuccess={handleLoginSuccess}
      />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <MotionProvider>
          <MainLayout />
        </MotionProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

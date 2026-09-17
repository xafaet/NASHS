import React, { useState, useEffect } from 'react';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
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
import { CMSPageView } from './components/CMSPageView';
import { LoginModal } from './components/LoginModal';
import { SetupWizard } from './components/SetupWizard';
import { apiFetch } from './utils/api';

function MainLayout() {
  const { language } = useLanguage();
  const { user, isAdmin } = useAuth();

  // Navigation routing state
  const [currentView, setCurrentView] = useState<string>('home');
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [isInstalled, setIsInstalled] = useState<boolean | null>(null);
  const [setupReason, setSetupReason] = useState<string | undefined>();

  // Check installation status on initial mount
  useEffect(() => {
    async function checkInstallation() {
      try {
        const res = await fetch('/api/setup/status');
        if (res.ok) {
          const data = await res.json();
          setIsInstalled(data.is_installed);
          if (!data.is_installed) {
            setSetupReason('Welcome! Please complete the first-time setup wizard to configure your database and alumni platform.');
          }
        } else {
          setIsInstalled(true);
        }
      } catch (e) {
        setIsInstalled(true);
      }
    }
    checkInstallation();
  }, []);

  // Sync with URL query param or hash on initial load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    const tokenParam = params.get('token');

    if (tokenParam || viewParam === 'verify') {
      setCurrentView('verify');
    } else if (viewParam === 'setup') {
      setCurrentView('setup');
    } else if (viewParam) {
      setCurrentView(viewParam);
    }
  }, []);

  const navigateTo = (view: string) => {
    if (view === 'member' && !user) {
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

  // If application is not yet installed or user explicitly requested setup view
  if (isInstalled === false || currentView === 'setup') {
    return (
      <SetupWizard
        reason={setupReason}
        onComplete={() => {
          setIsInstalled(true);
          setCurrentView('home');
          // Clear view=setup param if present
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
          <RegistrationFlow onGoToPortal={() => navigateTo('member')} />
        )}
        {currentView === 'verify' && <TokenVerificationView />}
        {currentView === 'member' && <MemberPortal />}
        {currentView === 'school' && <SchoolView />}
        {currentView === 'association' && <AssociationView />}
        {currentView === 'committee' && <AssociationView />}
        {currentView === 'notices' && <NoticesView />}
        {currentView === 'contact' && <ContactView />}
        {![
          'home',
          'register',
          'verify',
          'member',
          'school',
          'association',
          'committee',
          'notices',
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
        <MainLayout />
      </AuthProvider>
    </LanguageProvider>
  );
}

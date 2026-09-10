import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ManagementAuthProvider, useManagementAuth } from './context/ManagementAuthContext';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { MyRoomPage } from './pages/MyRoomPage';
import { MessTokensPage } from './pages/MessTokensPage';
import { OutingRequestsPage } from './pages/OutingRequestsPage';
import { ComplaintsPage } from './pages/ComplaintsPage';
import { LeavesPage } from './pages/LeavesPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { BiometricPage } from './pages/BiometricPage';
import { Sidebar } from './components/Sidebar';
import { DashboardHeader } from './components/DashboardHeader';
import { PlaceholderModule } from './components/PlaceholderModule';
import { apiService } from './services/api';

// Step 10 & 11 Management Components
import { ManagementSidebar } from './components/ManagementSidebar';
import { ManagementHeader } from './components/ManagementHeader';
import { ManagementLoginPage } from './pages/ManagementLoginPage';
import { ManagementDashboardPage } from './pages/ManagementDashboardPage';
import { BlockManagementPage } from './pages/BlockManagementPage';
import { RoomManagementPage } from './pages/RoomManagementPage';
import { MessManagementPage } from './pages/MessManagementPage';
import { Lock, X } from 'lucide-react';

const ROUTE_MODULE_NAMES: Record<string, string> = {};

const AuthenticatedApp: React.FC<{
  currentPath: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
}> = ({ currentPath, onNavigate, onLogout }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // Authoritative global unread count fetching and SSE synchronization
  useEffect(() => {
    let isMounted = true;
    apiService
      .getUnreadNotificationCount()
      .then((res) => {
        if (isMounted) setUnreadCount(res.unreadCount);
      })
      .catch(() => {});

    const unsubscribe = apiService.subscribeToNotificationEvents((event) => {
      if (typeof event.unreadCount === 'number') {
        if (isMounted) setUnreadCount(event.unreadCount);
      } else {
        apiService
          .getUnreadNotificationCount()
          .then((res) => {
            if (isMounted) setUnreadCount(res.unreadCount);
          })
          .catch(() => {});
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const isKnownPlaceholderRoute = Object.keys(ROUTE_MODULE_NAMES).includes(currentPath);

  const getPageTitle = (path: string) => {
    if (path === '/dashboard') return 'Dashboard';
    if (path === '/biometric') return 'Biometric Tracking';
    if (path === '/my-room') return 'My Room';
    if (path === '/mess-tokens') return 'Mess Tokens';
    if (path === '/outing-requests') return 'Outing Requests';
    if (path === '/complaints') return 'Complaints';
    if (path === '/leaves') return 'Leaves & Suspension';
    if (path === '/notifications') return 'Notifications';
    return ROUTE_MODULE_NAMES[path] || 'Hostel Portal';
  };

  return (
    <div className="portal-layout">
      {/* Sidebar: Sticky Desktop & Sliding Mobile Drawer */}
      <Sidebar
        currentPath={currentPath}
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        onNavigate={onNavigate}
        onLogout={onLogout}
      />

      {/* Main View Container */}
      <div className="portal-main-area">
        {/* Top Header */}
        <DashboardHeader
          pageTitle={getPageTitle(currentPath)}
          onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)}
          unreadNotificationsCount={unreadCount}
          onNavigate={onNavigate}
          onLogout={onLogout}
        />

        {/* Dynamic Route Content */}
        <main className="portal-content-body">
          {currentPath === '/dashboard' && (
            <DashboardPage onNavigate={onNavigate} />
          )}

          {currentPath === '/my-room' && (
            <MyRoomPage />
          )}

          {currentPath === '/mess-tokens' && (
            <MessTokensPage />
          )}

          {currentPath === '/outing-requests' && (
            <OutingRequestsPage />
          )}

          {currentPath === '/complaints' && (
            <ComplaintsPage />
          )}

          {currentPath === '/leaves' && (
            <LeavesPage />
          )}

          {currentPath === '/notifications' && (
            <NotificationsPage
              onNavigate={onNavigate}
              onUnreadCountChange={(count) => setUnreadCount(count)}
            />
          )}

          {currentPath === '/biometric' && (
            <BiometricPage />
          )}

          {isKnownPlaceholderRoute && (
            <PlaceholderModule
              moduleName={ROUTE_MODULE_NAMES[currentPath]}
              onBackToDashboard={() => onNavigate('/dashboard')}
            />
          )}

          {!isKnownPlaceholderRoute &&
            currentPath !== '/dashboard' &&
            currentPath !== '/biometric' &&
            currentPath !== '/my-room' &&
            currentPath !== '/mess-tokens' &&
            currentPath !== '/outing-requests' &&
            currentPath !== '/complaints' &&
            currentPath !== '/leaves' &&
            currentPath !== '/notifications' && (
              <DashboardPage onNavigate={onNavigate} />
            )}
        </main>
      </div>
    </div>
  );
};

// Authenticated Management Portal Application Layout
const AuthenticatedManagementApp: React.FC<{
  currentPath: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
}> = ({ currentPath, onNavigate, onLogout }) => {
  const { user } = useManagementAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moduleNotice, setModuleNotice] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(true);
  const [refreshHandler, setRefreshHandler] = useState<(() => void) | null>(null);

  const isBlockPage = currentPath === '/management/blocks';
  const isRoomPage = currentPath === '/management/rooms';
  const isMessPage = currentPath === '/management/mess';

  return (
    <div className="portal-layout management-layout">
      {/* Management Sidebar with all 13 modules */}
      <ManagementSidebar
        currentPath={currentPath}
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        onNavigate={onNavigate}
        onLogout={onLogout}
        onDisabledNotice={(name) => setModuleNotice(name)}
      />

      <div className="portal-main-area management-main-area">
        {/* Operational Header */}
        <ManagementHeader
          user={user}
          onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)}
          onLogout={onLogout}
          onRefresh={refreshHandler || undefined}
          isRefreshing={isRefreshing}
          isRealtimeConnected={isRealtimeConnected}
          pageTitle={
            isMessPage
              ? 'Mess Management'
              : isRoomPage
              ? 'Room Management & Allocation'
              : isBlockPage
              ? 'Block Management'
              : 'Management Dashboard'
          }
          pageSubtitle={
            isMessPage
              ? 'Monitor hostel meal services, verify resident tokens, and review meal statistics.'
              : isRoomPage
              ? 'Configure rooms, track bed occupancy, and assign residential accommodations.'
              : isBlockPage
              ? 'Configure, organize, and monitor hostel residential blocks and zones.'
              : 'A concise operational overview of hostel activity.'
          }
        />

        {/* Management Content View */}
        <main className="portal-content-body management-content-body">
          {isMessPage ? (
            <MessManagementPage onNavigate={onNavigate} />
          ) : isRoomPage ? (
            <RoomManagementPage onNavigate={onNavigate} />
          ) : isBlockPage ? (
            <BlockManagementPage onNavigate={onNavigate} />
          ) : (
            <ManagementDashboardPage
              onModuleNotice={(name) => setModuleNotice(name)}
              onRefreshStateChange={(refreshing, connected) => {
                setIsRefreshing(refreshing);
                setIsRealtimeConnected(connected);
              }}
              registerRefreshHandler={(fn) => setRefreshHandler(() => fn)}
            />
          )}
        </main>
      </div>


      {/* Notice Dialog for Modules Scheduled for Subsequent Steps */}
      {moduleNotice && (
        <div className="mgmt-modal-backdrop" onClick={() => setModuleNotice(null)}>
          <div className="mgmt-notice-modal" onClick={(e) => e.stopPropagation()}>
            <div className="notice-modal-header">
              <div className="notice-icon-circle">
                <Lock size={20} />
              </div>
              <h3 className="notice-modal-title">Module Scheduled</h3>
              <button
                type="button"
                className="notice-close-btn"
                onClick={() => setModuleNotice(null)}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>
            <div className="notice-modal-body">
              <p className="notice-modal-text">
                The <strong>{moduleNotice}</strong> module is scheduled for future implementation according to the system roadmap.
              </p>
              <p className="notice-modal-sub">
                Step 10 scope is strictly focused on the authoritative <strong>Management Dashboard</strong>. All operational analytics and actionable summary counts are active on this dashboard.
              </p>
            </div>
            <div className="notice-modal-footer">
              <button
                type="button"
                className="btn-primary"
                onClick={() => setModuleNotice(null)}
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AppContent: React.FC = () => {
  const { isAuthenticated: isStudentAuth, isLoading: isStudentLoading, logout: studentLogout } = useAuth();
  const { isAuthenticated: isMgmtAuth, isLoading: isMgmtLoading, logout: mgmtLogout } = useManagementAuth();

  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.pathname || '/login';
  });

  // Synchronize state with browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname || '/login';
      setCurrentPath(path);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setCurrentPath(path);
  };

  const isManagementRoute = currentPath.startsWith('/management');

  // Route protection for Management vs Student routes
  useEffect(() => {
    if (isManagementRoute) {
      if (isMgmtLoading) return;

      if (isMgmtAuth) {
        if (currentPath === '/management/login') {
          navigateTo('/management/dashboard');
        }
      } else {
        if (currentPath !== '/management/login') {
          navigateTo('/management/login');
        }
      }
    } else {
      if (isStudentLoading) return;

      if (isStudentAuth) {
        if (currentPath === '/login' || currentPath === '/') {
          navigateTo('/dashboard');
        }
      } else {
        if (currentPath !== '/login') {
          navigateTo('/login');
        }
      }
    }
  }, [
    isManagementRoute,
    isMgmtAuth,
    isMgmtLoading,
    isStudentAuth,
    isStudentLoading,
    currentPath,
  ]);

  // Loading state
  if ((isManagementRoute && isMgmtLoading) || (!isManagementRoute && isStudentLoading)) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F8FAFC',
          gap: '1rem',
        }}
      >
        <div
          className="spinner"
          style={{
            width: '36px',
            height: '36px',
            borderTopColor: '#151B54',
            borderColor: 'rgba(21, 27, 84, 0.15)',
          }}
        />
        <p style={{ color: '#64748B', fontSize: '0.9rem', fontWeight: 500 }}>
          {isManagementRoute ? 'Loading Management Portal...' : 'Loading student portal...'}
        </p>
      </div>
    );
  }

  // --- MANAGEMENT PORTAL ROUTING ---
  if (isManagementRoute) {
    if (isMgmtAuth) {
      return (
        <AuthenticatedManagementApp
          currentPath={currentPath}
          onNavigate={navigateTo}
          onLogout={async () => {
            await mgmtLogout();
            navigateTo('/management/login');
          }}
        />
      );
    }

    return (
      <ManagementLoginPage
        onLoginSuccess={() => navigateTo('/management/dashboard')}
        onNavigateToStudent={() => navigateTo('/login')}
      />
    );
  }

  // --- STUDENT PORTAL ROUTING ---
  if (isStudentAuth) {
    return (
      <AuthenticatedApp
        currentPath={currentPath}
        onNavigate={navigateTo}
        onLogout={async () => {
          await studentLogout();
          navigateTo('/login');
        }}
      />
    );
  }

  return (
    <LoginPage
      onLoginSuccess={() => navigateTo('/dashboard')}
      onNavigateToManagement={() => navigateTo('/management/login')}
    />
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <ManagementAuthProvider>
        <AppContent />
      </ManagementAuthProvider>
    </AuthProvider>
  );
};

export default App;

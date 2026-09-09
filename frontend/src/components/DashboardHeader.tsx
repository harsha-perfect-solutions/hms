import React, { useState, useRef, useEffect } from 'react';
import { Menu, Bell, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface DashboardHeaderProps {
  pageTitle?: string;
  onToggleMobileMenu: () => void;
  unreadNotificationsCount?: number;
  onNavigate: (path: string) => void;
  onLogout: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  pageTitle = 'Dashboard',
  onToggleMobileMenu,
  unreadNotificationsCount = 0,
  onNavigate,
  onLogout,
}) => {
  const { user } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute student initials for profile avatar
  const getInitials = (name?: string) => {
    if (!name) return 'ST';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="main-header" aria-label="Dashboard Top Bar">
      <div className="header-left-section">
        {/* Mobile Hamburger Button */}
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="mobile-hamburger-btn"
          aria-label="Open navigation menu"
        >
          <Menu size={22} />
        </button>

        <h1 className="header-page-title">{pageTitle}</h1>
      </div>

      <div className="header-right-section">
        {/* Notifications Icon Button */}
        <button
          type="button"
          onClick={() => onNavigate('/notifications')}
          className="header-icon-btn"
          aria-label={`Notifications ${unreadNotificationsCount > 0 ? `(${unreadNotificationsCount} unread)` : ''}`}
        >
          <Bell size={20} />
          {unreadNotificationsCount > 0 && (
            <span className="notification-dot" aria-hidden="true" />
          )}
        </button>

        {/* Profile Avatar & Dropdown */}
        <div className="profile-dropdown-wrapper" ref={profileMenuRef}>
          <button
            type="button"
            onClick={() => setProfileOpen((prev) => !prev)}
            className="profile-trigger-btn"
            aria-expanded={profileOpen}
            aria-haspopup="true"
            aria-label="Open user profile menu"
          >
            <div className="avatar-circle">
              {getInitials(user?.name)}
            </div>
            <div className="profile-text-desktop">
              <span className="profile-name">{user?.name || 'Student'}</span>
              <span className="profile-roll">{user?.jntuNo}</span>
            </div>
            <ChevronDown size={14} className="profile-chevron" />
          </button>

          {profileOpen && (
            <div className="profile-dropdown-menu" role="menu">
              <div className="dropdown-user-info">
                <div className="dropdown-user-name">{user?.name}</div>
                <div className="dropdown-user-email">{user?.email || user?.jntuNo}</div>
                <div className="dropdown-user-badge">Role: {user?.role || 'STUDENT'}</div>
              </div>

              <div className="dropdown-divider" />

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setProfileOpen(false);
                  onLogout();
                }}
                className="dropdown-signout-btn"
              >
                <LogOut size={16} />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

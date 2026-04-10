import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import NotificationsPopover from './NotificationsPopover';
import LanguageSwitcher from './LanguageSwitcher';
import { getImageUrl, getInitials } from '../utils/imageUtils';
import { useTheme } from '@mui/material/styles';
import { useThemeMode } from '../contexts/ThemeModeContext';


// NavLink helper for nav items
const NavLink = ({ to, label, svg, onClick }: { to: string; label: string; svg: React.ReactNode; onClick?: () => void }) => (
  <Link
    to={to}
    onClick={onClick}
    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 transition no-underline"
    style={{ textDecoration: 'none' }}
  >
    {svg}
    <span>{label}</span>
  </Link>
);

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const theme = useTheme();
  const { mode, toggleMode } = useThemeMode();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <nav
      className="sticky top-0 z-50 border-b backdrop-blur-xl"
      style={{
        background: mode === 'dark' ? 'rgba(11, 18, 32, 0.85)' : 'rgba(248, 250, 252, 0.88)',
        borderColor: mode === 'dark' ? 'rgba(148, 163, 184, 0.15)' : 'rgba(15, 23, 42, 0.09)',
      }}
    >
      <div className="w-full px-2 sm:px-4">
        <div className="flex items-center justify-between h-16 w-full">
          <div className="flex items-center gap-2 sm:gap-4">
            <img src="/logo.svg" alt="App Logo" className="w-8 h-8 sm:w-10 sm:h-10" />
            <span className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent tracking-wide select-none">
              {t('common.teamly')}
            </span>
          </div>

          {user && (
            <div className="hidden lg:flex gap-1 flex-1 justify-center">
              <NavLink to="/dashboard" label={t('common.dashboard')} svg={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8v-10h-8v10zm0-18v6h8V3h-8z" /></svg>} />
              <NavLink to="/groups" label={t('common.groups')} svg={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="9" cy="7" r="4" /><path d="M17 11c0-2.21-1.79-4-4-4s-4 1.79-4 4c0 2.21 1.79 4 4 4s4-1.79 4-4z" /><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /></svg>} />
              <NavLink to="/events" label={t('common.events')} svg={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>} />
              <NavLink to="/public-groups" label={t('common.discover')} svg={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2c2.5 2.5 4 6.5 4 10s-1.5 7.5-4 10c-2.5-2.5-4-6.5-4-10s1.5-7.5 4-10z" /></svg>} />
            </div>
          )}

          {user ? (
            <div className="hidden lg:flex items-center gap-3">
              <button
                onClick={toggleMode}
                className="h-10 w-10 flex items-center justify-center rounded-xl transition"
                style={{ background: mode === 'dark' ? 'rgba(148,163,184,0.15)' : 'rgba(15,23,42,0.06)' }}
                aria-label="Toggle dark and light theme"
              >
                {mode === 'dark' ? (
                  <svg className="w-5 h-5" fill="none" stroke={theme.palette.text.primary} strokeWidth="2" viewBox="0 0 24 24"><path d="M12 3v2m0 14v2m9-9h-2M5 12H3m14.95 6.95-1.41-1.41M7.46 7.46 6.05 6.05m11.9 0-1.41 1.41M7.46 16.54l-1.41 1.41M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" /></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke={theme.palette.text.primary} strokeWidth="2" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3c0 .33-.01.66-.01 1a7 7 0 0 0 9.8 6.43Z" /></svg>
                )}
              </button>
              <LanguageSwitcher />
              <NotificationsPopover />
              <Link
                to="/profile"
                className="flex items-center gap-2 px-3 py-2 rounded-xl transition no-underline"
                style={{ background: mode === 'dark' ? 'rgba(148,163,184,0.14)' : 'rgba(15,23,42,0.06)' }}
              >
                {(() => {
                  const profilePictureUrl = getImageUrl(user.profilePicture);
                  return (
                    <span className="w-8 h-8 rounded-full flex items-center justify-center font-bold bg-blue-400 text-white text-base overflow-hidden">
                      {profilePictureUrl ? (
                        <img src={profilePictureUrl} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        getInitials(user.name)
                      )}
                    </span>
                  );
                })()}
                <span className="font-medium text-sm">{user.name}</span>
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 16l4-4m0 0l-4-4m4 4H7" /><path d="M3 12v7a2 2 0 0 0 2 2h6" /></svg>
                <span className="hidden xl:inline">{t('common.logout')}</span>
              </button>
            </div>
          ) : (
            <div className="hidden lg:flex items-center gap-4">
              <button
                onClick={toggleMode}
                className="h-10 w-10 flex items-center justify-center rounded-xl transition"
                style={{ background: mode === 'dark' ? 'rgba(148,163,184,0.15)' : 'rgba(15,23,42,0.06)' }}
                aria-label="Toggle dark and light theme"
              >
                {mode === 'dark' ? (
                  <svg className="w-5 h-5" fill="none" stroke={theme.palette.text.primary} strokeWidth="2" viewBox="0 0 24 24"><path d="M12 3v2m0 14v2m9-9h-2M5 12H3m14.95 6.95-1.41-1.41M7.46 7.46 6.05 6.05m11.9 0-1.41 1.41M7.46 16.54l-1.41 1.41M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" /></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke={theme.palette.text.primary} strokeWidth="2" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3c0 .33-.01.66-.01 1a7 7 0 0 0 9.8 6.43Z" /></svg>
                )}
              </button>
              <LanguageSwitcher />
            </div>
          )}

          {user && (
            <div className="lg:hidden flex items-center gap-2">
              <button
                onClick={toggleMode}
                className="h-9 w-9 flex items-center justify-center rounded-lg transition"
                style={{ background: mode === 'dark' ? 'rgba(148,163,184,0.14)' : 'rgba(15,23,42,0.06)' }}
                aria-label="Toggle dark and light theme"
              >
                {mode === 'dark' ? (
                  <svg className="w-4 h-4" fill="none" stroke={theme.palette.text.primary} strokeWidth="2" viewBox="0 0 24 24"><path d="M12 3v2m0 14v2m9-9h-2M5 12H3m14.95 6.95-1.41-1.41M7.46 7.46 6.05 6.05m11.9 0-1.41 1.41M7.46 16.54l-1.41 1.41M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke={theme.palette.text.primary} strokeWidth="2" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3c0 .33-.01.66-.01 1a7 7 0 0 0 9.8 6.43Z" /></svg>
                )}
              </button>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M15 19l-7-7 7-7" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
              <NotificationsPopover />
            </div>
          )}

          {!user && (
            <div className="lg:hidden flex items-center gap-2">
              <button
                onClick={toggleMode}
                className="h-9 w-9 flex items-center justify-center rounded-lg transition"
                style={{ background: mode === 'dark' ? 'rgba(148,163,184,0.14)' : 'rgba(15,23,42,0.06)' }}
                aria-label="Toggle dark and light theme"
              >
                {mode === 'dark' ? (
                  <svg className="w-4 h-4" fill="none" stroke={theme.palette.text.primary} strokeWidth="2" viewBox="0 0 24 24"><path d="M12 3v2m0 14v2m9-9h-2M5 12H3m14.95 6.95-1.41-1.41M7.46 7.46 6.05 6.05m11.9 0-1.41 1.41M7.46 16.54l-1.41 1.41M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke={theme.palette.text.primary} strokeWidth="2" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3c0 .33-.01.66-.01 1a7 7 0 0 0 9.8 6.43Z" /></svg>
                )}
              </button>
              <LanguageSwitcher />
            </div>
          )}
        </div>

        {user && mobileMenuOpen && (
          <div
            className="lg:hidden border-t py-4 space-y-2"
            style={{ borderColor: mode === 'dark' ? 'rgba(148, 163, 184, 0.16)' : 'rgba(15, 23, 42, 0.08)' }}
          >
            <NavLink to="/dashboard" label={t('common.dashboard')} onClick={closeMobileMenu} svg={<svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8v-10h-8v10zm0-18v6h8V3h-8z" /></svg>} />
            <NavLink to="/groups" label={t('common.groups')} onClick={closeMobileMenu} svg={<svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="9" cy="7" r="4" /><path d="M17 11c0-2.21-1.79-4-4-4s-4 1.79-4 4c0 2.21 1.79 4 4 4s4-1.79 4-4z" /><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /></svg>} />
            <NavLink to="/events" label={t('common.events')} onClick={closeMobileMenu} svg={<svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>} />
            <NavLink to="/public-groups" label={t('common.discover')} onClick={closeMobileMenu} svg={<svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2c2.5 2.5 4 6.5 4 10s-1.5 7.5-4 10c-2.5-2.5-4-6.5-4-10s1.5-7.5 4-10z" /></svg>} />
            
            <div
              className="border-t my-3"
              style={{ borderColor: mode === 'dark' ? 'rgba(148,163,184,0.16)' : 'rgba(15,23,42,0.08)' }}
            />
            
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-sm">{t('common.language')}</span>
              <LanguageSwitcher />
            </div>
            
            <Link
              to="/profile"
              onClick={closeMobileMenu}
              className="flex items-center gap-3 px-3 py-2 rounded text-white hover:bg-white/10 transition no-underline"
            >
              {(() => {
                const profilePictureUrl = getImageUrl(user.profilePicture);
                return (
                  <span className="w-8 h-8 rounded-full flex items-center justify-center font-bold bg-blue-400 text-white text-base overflow-hidden">
                    {profilePictureUrl ? (
                      <img src={profilePictureUrl} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      getInitials(user.name)
                    )}
                  </span>
                );
              })()}
              <span className="font-medium">{user.name}</span>
            </Link>
            
            <button
              onClick={() => {
                closeMobileMenu();
                handleLogout();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 16l4-4m0 0l-4-4m4 4H7" /><path d="M3 12v7a2 2 0 0 0 2 2h6" /></svg>
              {t('common.logout')}
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;

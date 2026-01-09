import React from 'react';
// All MUI imports removed; using Tailwind and SVGs only
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
// All MUI icon imports removed; using inline SVGs
import NotificationsPopover from './NotificationsPopover';
import LanguageSwitcher from './LanguageSwitcher';
import { getImageUrl } from '../utils/imageUtils';


// NavLink helper for nav items
const NavLink = ({ to, label, svg }: { to: string; label: string; svg: React.ReactNode }) => (
  <Link
    to={to}
    className="flex items-center gap-1 px-3 py-2 rounded text-white font-medium hover:bg-white/10 transition no-underline"
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

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getInitials = (name: string): string => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <nav className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-600 border-b border-white/10">
      <div className="w-full px-0">
        <div className="flex items-center justify-between h-16 w-full">
          {/* Left: Logo and nav links */}
          <div className="flex items-center gap-8 pl-4">
            {/* App Logo SVG */}
            <span>
              <img src="/logo.svg" alt="App Logo" className="w-10 h-10" />
            </span>
            <span className="text-2xl font-bold bg-gradient-to-r from-white via-blue-300 to-blue-400 bg-clip-text text-transparent tracking-wide select-none">{t('common.teamly')}</span>
            {user && (
              <div className="flex gap-1 ml-6">
                <NavLink to="/dashboard" label={t('common.dashboard')} svg={<svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8v-10h-8v10zm0-18v6h8V3h-8z" /></svg>} />
                <NavLink to="/groups" label={t('common.groups')} svg={<svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="9" cy="7" r="4" /><path d="M17 11c0-2.21-1.79-4-4-4s-4 1.79-4 4c0 2.21 1.79 4 4 4s4-1.79 4-4z" /><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /></svg>} />
                <NavLink to="/events" label={t('common.events')} svg={<svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>} />
                <NavLink to="/public-groups" label={t('common.discover')} svg={<svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2c2.5 2.5 4 6.5 4 10s-1.5 7.5-4 10c-2.5-2.5-4-6.5-4-10s1.5-7.5 4-10z" /></svg>} />
              </div>
            )}
          </div>
          {/* Right: User actions */}
          {user ? (
            <div className="flex items-center gap-4">
              <LanguageSwitcher />
              <NotificationsPopover />
              <Link to="/profile" className="flex items-center gap-2 px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-white transition no-underline">
                <span className="w-8 h-8 rounded-full flex items-center justify-center font-bold bg-blue-400 text-white text-base overflow-hidden">
                  {getImageUrl(user.profilePicture) ? (
                    <img src={getImageUrl(user.profilePicture)!} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    getInitials(user.name)
                  )}
                </span>
                <span className="font-medium text-white text-sm">{user.name}</span>
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white font-medium transition"
              >
                {/* Logout SVG */}
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 16l4-4m0 0l-4-4m4 4H7" /><path d="M3 12v7a2 2 0 0 0 2 2h6" /></svg>
                {t('common.logout')}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <LanguageSwitcher />
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

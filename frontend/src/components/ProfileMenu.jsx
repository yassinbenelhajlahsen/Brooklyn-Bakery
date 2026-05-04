import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/useAuth.js';
import { useNavigate } from 'react-router-dom';
import PackageIcon from './icons/PackageIcon.jsx';
import UserIcon from './icons/UserIcon.jsx';

export default function ProfileMenu() {
  const { user, profile, openLogin, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (!menuRef.current?.contains(e.target)) setOpen(false);
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  if (!user) {
    return (
      <button
        type="button"
        aria-label="Log in"
        onClick={openLogin}
        className="w-10 h-10 rounded-full bg-cream border border-line text-muted grid place-items-center transition-colors hover:border-accent hover:text-accent hover:bg-surface"
      >
        <UserIcon className="w-5 h-5" />
      </button>
    );
  }

  const displayName = profile?.displayName?.trim() || user.email?.split('@')[0] || 'there';
  const initial = (profile?.displayName?.trim()?.[0] || user.email?.[0] || '?').toUpperCase();
  const balance = profile?.balance ?? 0;

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-label="Open account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'w-10 h-10 rounded-full bg-accent text-white font-medium text-[15px]',
          'grid place-items-center select-none',
          'ring-offset-2 ring-offset-surface transition-all duration-150',
          'hover:bg-accent-dark hover:ring-2 hover:ring-accent/30',
          open && 'ring-2 ring-accent/40',
        )}
      >
        {initial}
      </button>

      <div
        role="menu"
        aria-label="Account menu"
        className={clsx(
          'absolute top-full right-0 mt-3 w-60 origin-top-right',
          'bg-surface border border-line rounded-xl shadow-card overflow-hidden z-50',
          'transition-all duration-150 ease-out',
          open
            ? 'opacity-100 scale-100 pointer-events-auto'
            : 'opacity-0 scale-95 pointer-events-none',
        )}
      >
        <div className="px-4 pt-4 pb-3 border-b border-line">
          <div
            className="font-display italic text-[18px] leading-tight text-ink truncate"
            style={{ fontVariationSettings: "'opsz' 24" }}
          >
            {displayName}
          </div>
          {user.email && (
            <div className="text-[12px] text-muted truncate mt-0.5">{user.email}</div>
          )}
          <div className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-accent font-medium">
            <StarIcon className="w-3.5 h-3.5" />
            <span>{balance.toLocaleString()} {balance === 1 ? 'point' : 'points'}</span>
          </div>
        </div>

        <div className="py-1">
          {profile?.role === 'admin' && (
            <MenuItem
              icon={<UserIcon className="w-[18px] h-[18px]" />}
              label="Admin"
              onClick={() => {
                setOpen(false);
                navigate('/admin');
              }}
            />
          )}
          <MenuItem
            icon={<UserIcon className="w-[18px] h-[18px]" />}
            label="Profile"
            onClick={() => {
              setOpen(false);
              navigate('/profile');
            }}
          />
          <MenuItem
            icon={<PackageIcon className="w-[18px] h-[18px]" />}
            label="Order History"
            onClick={() => {
              setOpen(false);
              navigate('/orders');
            }}
          />
        </div>

        <div className="border-t border-line">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px] text-danger hover:bg-danger/5 transition-colors"
          >
            <LogoutIcon className="w-[18px] h-[18px]" />
            <span>Log out</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function MenuItem({ icon, label, onClick }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px] text-ink hover:bg-cream transition-colors"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function LogoutIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H10" />
    </svg>
  );
}

function StarIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2.5 14.9 8.6l6.6.95-4.8 4.7 1.15 6.6L12 17.75 6.15 20.85 7.3 14.25l-4.8-4.7 6.6-.95Z" />
    </svg>
  );
}

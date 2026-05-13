import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.js';
import { supabase } from '../lib/supabase.js';
import Ornament from '../components/Ornament.jsx';
import AccountSection from '../components/profile/AccountSection.jsx';
import AddressesSection from '../components/profile/AddressesSection.jsx';
import SecuritySection from '../components/profile/SecuritySection.jsx';

const BACK_BTN = clsx(
  'bg-transparent text-muted border border-line rounded-lg p-3',
  'font-sans font-medium text-[12px] leading-[1] tracking-[0.1em] uppercase',
  '[transition:color_180ms_ease,border-color_180ms_ease]',
  'hover:text-accent hover:border-accent',
  'motion-reduce:transition-none',
);

const CARD = clsx(
  'rounded-2xl border border-line bg-white/80 shadow-sm',
  'p-6 max-sm:p-4',
);

const LABEL = clsx(
  'block mb-2 font-sans text-[12px] uppercase tracking-[0.12em] text-muted',
);

const INPUT = clsx(
  'w-full rounded-lg border border-line bg-white px-4 py-3',
  'font-sans text-sm text-ink outline-none',
  'focus:border-accent focus:ring-2 focus:ring-accent/20',
);

const SELECT = INPUT;

const PRIMARY_BTN = clsx(
  'rounded-lg bg-accent px-5 py-3 text-white',
  'font-sans text-[12px] font-medium uppercase tracking-[0.12em]',
  'hover:opacity-90 transition motion-reduce:transition-none',
);

function ProfileHeader() {
  return (
    <header className="text-center mb-10">
      <h2 className="font-display font-normal text-[42px] leading-[1.1] tracking-[-0.015em] text-ink m-0 [font-variation-settings:'opsz'_48] max-[880px]:text-[32px]">
        Profile
      </h2>
      <Ornament className="mt-5" />
      <p className="mt-4 text-sm text-muted">
        Manage your account details, preferences, addresses, and security settings.
      </p>
    </header>
  );
}

export default function ProfilePage() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();

  if (!ready) {
    return (
      <main className="flex-1 p-8 max-w-full overflow-y-auto max-sm:px-4 max-sm:py-5" />
    );
  }

  if (!user) return <Navigate to="/" replace />;

  return (
    <main className="flex-1 p-8 max-w-full overflow-y-auto max-sm:px-4 max-sm:py-5">
      <div className="w-full">
        <ProfileHeader />

        <div className="mb-6 flex justify-between items-center gap-3 max-sm:flex-col max-sm:items-stretch">
          <button className={BACK_BTN} onClick={() => navigate('/')}>
            Back to home
          </button>

          <button className={BACK_BTN} onClick={() => navigate('/orders')}>
            See recent orders
          </button>
        </div>

        <div className="grid gap-5">
          <AccountSection />

          <div className="grid gap-5 md:grid-cols-2">
            <AddressesSection />
            <SecuritySection />
          </div>
        </div>
      </div>
    </main>
  );
}
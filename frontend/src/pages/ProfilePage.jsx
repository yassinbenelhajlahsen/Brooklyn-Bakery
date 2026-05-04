import clsx from 'clsx';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.js';
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

function ProfileHeader() {
  return (
    <header className="text-center mb-10">
      <h2 className="font-display font-normal text-[42px] leading-[1.1] tracking-[-0.015em] text-ink m-0 [font-variation-settings:'opsz'_48] max-[880px]:text-[32px]">
        Profile
      </h2>
      <Ornament className="mt-5" />
    </header>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) return <Navigate to="/" replace />;

  return (
    <main className="flex-1 p-8 max-w-full overflow-y-auto max-sm:px-4 max-sm:py-5">
      <div className="w-full animate-checkout-rise motion-reduce:animate-none">
        <ProfileHeader />

        <div className="mb-6 flex justify-start">
          <button className={BACK_BTN} onClick={() => navigate('/')}>
            Back to home
          </button>
        </div>

        <div className="grid gap-5 max-w-5xl">
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

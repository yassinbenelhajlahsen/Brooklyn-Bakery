import { useState } from 'react';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import OrdersTab from '../components/admin/OrdersTab.jsx';
import ProductsTab from '../components/admin/ProductsTab.jsx';
import UsersTab from '../components/admin/UsersTab.jsx';
import PackageIcon from '../components/icons/PackageIcon.jsx';
import UserIcon from '../components/icons/UserIcon.jsx';

function CubeIcon({ className }) {
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
      <path d="M12 2 3 7v10l9 5 9-5V7L12 2Z" />
      <path d="M12 12l9-5" />
      <path d="M12 12 3 7" />
      <path d="M12 12v10" />
    </svg>
  );
}

const TABS = [
  { key: 'orders',   label: 'Orders',   Icon: PackageIcon, Component: OrdersTab   },
  { key: 'products', label: 'Products', Icon: CubeIcon,    Component: ProductsTab },
  { key: 'users',    label: 'Users',    Icon: UserIcon,    Component: UsersTab    },
];

const BACK_BTN = clsx(
  'bg-transparent text-muted border border-line rounded-lg p-3',
  'font-sans font-medium text-[12px] leading-[1] tracking-[0.1em] uppercase',
  '[transition:color_180ms_ease,border-color_180ms_ease]',
  'hover:text-accent hover:border-accent',
  'motion-reduce:transition-none',
);

export default function AdminPage() {
  const [active, setActive] = useState('orders');
  const navigate = useNavigate();
  const activeIdx = TABS.findIndex((t) => t.key === active);
  const ActiveTab = TABS[activeIdx].Component;

  return (
    <div className="w-full">
      <div className="mb-6 flex justify-start">
        <button className={BACK_BTN} onClick={() => navigate('/')}>
          Back to home
        </button>
      </div>

      <header className="mb-6">
        <h1
          className="font-display font-normal text-[42px] leading-[1.1] tracking-[-0.015em] text-ink m-0 [font-variation-settings:'opsz'_48] max-[880px]:text-[32px]"
        >
          Admin
        </h1>
      </header>

      <nav
        className="relative grid grid-cols-3 border-b border-line mb-6"
        role="tablist"
        aria-label="Admin sections"
      >
        {TABS.map(({ key, label, Icon }) => {
          const selected = key === active;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(key)}
              className={clsx(
                'inline-flex items-center justify-center gap-2 py-3',
                'text-sm font-medium transition-colors duration-300',
                selected ? 'text-ink' : 'text-muted hover:text-ink',
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          );
        })}
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-0 h-0.5 bg-accent transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{
            width: `${100 / TABS.length}%`,
            transform: `translateX(${activeIdx * 100}%)`,
          }}
        />
      </nav>

      <section role="tabpanel" aria-label={`${TABS[activeIdx].label} panel`}>
        <ActiveTab />
      </section>
    </div>
  );
}

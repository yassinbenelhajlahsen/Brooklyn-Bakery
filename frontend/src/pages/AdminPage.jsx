import { useState } from 'react';
import clsx from 'clsx';
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

export default function AdminPage() {
  const [active, setActive] = useState('orders');
  const ActiveTab = TABS.find((t) => t.key === active).Component;

  return (
    <div className="w-full">
      <header className="mb-6">
        <h1
          className="font-display font-normal text-[42px] leading-[1.1] tracking-[-0.015em] text-ink m-0 [font-variation-settings:'opsz'_48] max-[880px]:text-[32px]"
        >
          Admin
        </h1>
      </header>

      <nav
        className="flex gap-1 border-b border-line mb-6"
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
                'inline-flex items-center gap-2 px-4 py-2.5 -mb-px border-b-2',
                'text-sm font-medium transition-colors duration-150',
                selected
                  ? 'border-accent text-ink'
                  : 'border-transparent text-muted hover:text-ink',
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          );
        })}
      </nav>

      <section role="tabpanel" aria-label={`${TABS.find((t) => t.key === active).label} panel`}>
        <ActiveTab />
      </section>
    </div>
  );
}

import clsx from 'clsx';
import { useNavigate, useSearchParams } from 'react-router-dom';
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

const DEFAULT_TAB = 'orders';
const TAB_KEYS = TABS.map((t) => t.key);
const STEP_PERCENT = 100 / TABS.length;
const STRIP_WIDTH_PERCENT = TABS.length * 100;

const BACK_BTN = clsx(
  'bg-transparent text-muted border border-line rounded-lg p-3',
  'font-sans font-medium text-[12px] leading-[1] tracking-[0.1em] uppercase',
  '[transition:color_180ms_ease,border-color_180ms_ease]',
  'hover:text-accent hover:border-accent',
  'motion-reduce:transition-none',
);

function Panel({ hidden, widthPercent, children }) {
  return (
    <div
      className={`h-full overflow-y-auto ${hidden ? 'pointer-events-none' : ''}`}
      style={{ width: `${widthPercent}%` }}
      aria-hidden={hidden}
      inert={hidden}
    >
      {children}
    </div>
  );
}

export default function AdminPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('tab');
  const active = TAB_KEYS.includes(requested) ? requested : DEFAULT_TAB;
  const activeIdx = TABS.findIndex((t) => t.key === active);

  const setActive = (key) => {
    if (key === active) return;
    const next = new URLSearchParams(searchParams);
    next.set('tab', key);
    setSearchParams(next);
  };

  const panelWidthPercent = 100 / TABS.length;

  return (
    <div className="flex flex-col h-full w-full min-h-0">
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
            width: `${STEP_PERCENT}%`,
            transform: `translateX(${activeIdx * 100}%)`,
          }}
        />
      </nav>

      <section
        role="tabpanel"
        aria-label={`${TABS[activeIdx].label} panel`}
        className="flex-1 min-h-0 overflow-hidden"
      >
        <div
          className="flex h-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          style={{
            width: `${STRIP_WIDTH_PERCENT}%`,
            transform: `translateX(-${activeIdx * STEP_PERCENT}%)`,
          }}
        >
          {TABS.map(({ key, Component }, idx) => (
            <Panel key={key} hidden={idx !== activeIdx} widthPercent={panelWidthPercent}>
              <Component />
            </Panel>
          ))}
        </div>
      </section>
    </div>
  );
}

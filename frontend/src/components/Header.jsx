import clsx from 'clsx';
import { useLocation } from 'react-router-dom';
import { ICON_BTN } from '../lib/styles.js';
import ProfileMenu from './ProfileMenu.jsx';

export default function Header({ cartCount = 0, onCartClick }) {
  const { pathname } = useLocation();
  const showCart = pathname !== '/checkout';

  return (
    <header className="sticky top-0 z-20 grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-8 py-4 bg-surface border-b border-line shadow-card max-sm:px-4 max-sm:py-3">
      <div aria-hidden="true" />

      <h1
        className="font-display italic text-[30px] leading-none text-ink text-center max-sm:text-[22px]"
        style={{ fontVariationSettings: "'opsz' 48" }}
      >
        Brooklyn Bakery
      </h1>

      <div className="flex items-center gap-3 justify-self-end">
        {showCart && (
          <button
            className={clsx(ICON_BTN, 'relative transition-colors')}
            aria-label={`Open cart (${cartCount} items)`}
            onClick={onCartClick}
          >
            <span className="text-[18px]" aria-hidden="true">🛒</span>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-accent text-white text-[11px] font-medium rounded-full min-w-[18px] px-1 py-px text-center">
                {cartCount}
              </span>
            )}
          </button>
        )}
        <ProfileMenu />
      </div>
    </header>
  );
}

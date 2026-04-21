import clsx from 'clsx';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.js';
import { ICON_BTN } from '../lib/styles.js';

export default function Header({ cartCount = 0, onCartClick }) {
  const { user, openLogin, signOut } = useAuth();
  const { pathname } = useLocation();
  const showCart = pathname !== '/checkout';

  return (
    <header className="grid grid-cols-[1fr_auto_1fr] items-center px-8 py-4 bg-surface border-b border-line shadow-card max-sm:px-4 max-sm:py-3">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-accent text-white font-heading font-bold grid place-items-center" aria-hidden="true">BB</div>
      </div>

      <h1 className="text-[28px] tracking-[1px] text-center max-sm:text-[20px]">Brooklyn Bakery</h1>

      <div className="flex items-center gap-3 justify-self-end">
        <button
          className="flex items-center gap-2 bg-surface border border-line rounded-lg h-10 px-3 text-ink hover:bg-cream max-sm:[&>span:last-child]:hidden"
          onClick={user ? signOut : openLogin}
          title={user?.email}
        >
          <span>{user ? 'Log out' : 'Log in'}</span>
        </button>
        {showCart && (
          <button
            className={clsx(ICON_BTN, 'relative')}
            aria-label={`Open cart (${cartCount} items)`}
            onClick={onCartClick}
          >
            <span className="text-[18px]" aria-hidden="true">🛒</span>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-accent text-white text-[11px] rounded-full px-1.5 py-px">
                {cartCount}
              </span>
            )}
          </button>
        )}
      </div>
    </header>
  )
}

import { useLocation } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.js';

export default function Header({ cartCount = 0, onCartClick }) {
  const { user, openLogin, signOut } = useAuth();
  const { pathname } = useLocation();
  const showCart = pathname !== '/checkout';

  return (
    <header className="site-header">
      <div className="header-left">
        <button className="icon-btn" aria-label="Open menu">
          <span className="hamburger" />
        </button>
        <div className="logo" aria-hidden="true">BB</div>
      </div>

      <h1 className="site-title">Brooklyn Bakery</h1>

      <div className="header-right">
        <button
          className="login-btn"
          onClick={user ? signOut : openLogin}
          title={user?.email}
        >
          <span>{user ? 'Log out' : 'Log in'}</span>
        </button>
        {showCart && (
          <button
            className="icon-btn cart-btn"
            aria-label={`Open cart (${cartCount} items)`}
            onClick={onCartClick}
          >
            <span className="cart-icon" aria-hidden="true">🛒</span>
            {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
          </button>
        )}
      </div>
    </header>
  )
}

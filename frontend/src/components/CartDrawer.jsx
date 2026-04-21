import { useEffect } from 'react';
import { useAuth } from '../auth/useAuth.js';
import { computeCartSubtotal } from '../lib/cart.js';
import CartItemRow from './CartItemRow.jsx';

export default function CartDrawer({
  open,
  cart,
  onClose,
  onIncrement,
  onDecrement,
  onClear,
}) {
  const entries = Object.values(cart);
  const subtotal = computeCartSubtotal(cart);
  const { requestCheckout } = useAuth();

  const handleCheckout = () => {
    onClose();
    requestCheckout();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        className={`cart-overlay ${open ? 'is-open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`cart-drawer ${open ? 'is-open' : ''}`}
        role="dialog"
        aria-label="Shopping cart"
        aria-hidden={!open}
      >
        <div className="cart-header">
          <h2>Your Cart</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close cart">×</button>
        </div>

        {entries.length === 0 ? (
          <div className="cart-empty">
            <p>Your cart is empty.</p>
            <p className="cart-empty-sub">Add some treats to get started!</p>
          </div>
        ) : (
          <>
            <ul className="cart-list">
              {entries.map(({ item, qty }) => (
                <CartItemRow
                  key={item.id}
                  item={item}
                  qty={qty}
                  onIncrement={() => onIncrement(item)}
                  onDecrement={() => onDecrement(item)}
                />
              ))}
            </ul>

            <div className="cart-footer">
              <div className="cart-subtotal">
                <span>Subtotal</span>
                <span>{subtotal} pts</span>
              </div>
              <button className="checkout-btn" onClick={handleCheckout}>
                Checkout
              </button>
              <button className="clear-btn" onClick={onClear}>
                Clear cart
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  )
}

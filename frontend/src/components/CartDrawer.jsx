import { useEffect, useState } from 'react';
import { useAuth } from '../auth/useAuth.js';

export default function CartDrawer({
  open,
  cart,
  onClose,
  onIncrement,
  onDecrement,
  onClear,
}) {
  const entries = Object.values(cart)
  const subtotal = entries.reduce((sum, { item, qty }) => sum + item.price * qty, 0)
  const totalItems = entries.reduce((n, { qty }) => n + qty, 0)

  const { requestCheckout } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleCheckout = async () => {
    setSubmitting(true);
    try {
      await requestCheckout(cart);
    } finally {
      setSubmitting(false);
    }
  };

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
                <li key={item.id} className="cart-item">
                  <img
                    className="cart-item-img"
                    src={`/bakedGoodsIMGs/${item.name}.jpg`}
                    alt={item.description}
                  />
                  <div className="cart-item-info">
                    <div className="cart-item-title">{item.name}</div>
                    <div className="cart-item-price">${item.price.toFixed(2)}</div>
                    <div className="qty-controls">
                      <button
                        className="qty-btn"
                        onClick={() => onDecrement(item)}
                        aria-label="Decrease"
                      >−</button>
                      <span className="qty-value">{qty}</span>
                      <button
                        className="qty-btn"
                        onClick={() => onIncrement(item)}
                        aria-label="Increase"
                      >+</button>
                    </div>
                  </div>
                  <div className="cart-item-total">
                    ${(item.price * qty).toFixed(2)}
                  </div>
                </li>
              ))}
            </ul>

            <div className="cart-footer">
              <div className="cart-subtotal">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <button className="checkout-btn" onClick={handleCheckout} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Checkout'}
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

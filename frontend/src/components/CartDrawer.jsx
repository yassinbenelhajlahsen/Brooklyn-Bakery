import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/useAuth.js';
import { computeCartSubtotal } from '../lib/cart.js';
import { ICON_BTN } from '../lib/styles.js';
import CartItemRow from './CartItemRow.jsx';

const ROW_EXIT_MS = 320;

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

  const [exitingIds, setExitingIds] = useState(() => new Set());
  const timeoutsRef = useRef(new Map());

  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      timeouts.forEach((id) => clearTimeout(id));
      timeouts.clear();
    };
  }, []);

  const handleDecrement = (item) => {
    const currentQty = cart[item.id]?.qty ?? 0;
    if (currentQty > 1) {
      onDecrement(item);
      return;
    }
    if (timeoutsRef.current.has(item.id)) return;
    setExitingIds((prev) => {
      const next = new Set(prev);
      next.add(item.id);
      return next;
    });
    const tid = setTimeout(() => {
      onDecrement(item);
      timeoutsRef.current.delete(item.id);
      setExitingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }, ROW_EXIT_MS);
    timeoutsRef.current.set(item.id, tid);
  };

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
        className={`fixed inset-0 bg-black/40 transition-opacity duration-[250ms] ease-in-out z-[90] ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`fixed top-0 right-0 bottom-0 w-[400px] max-w-[100vw] bg-surface shadow-[-8px_0_24px_rgba(61,47,36,0.15)] transition-transform duration-[250ms] ease-in-out z-[100] flex flex-col ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-label="Shopping cart"
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-line [&>h2]:text-[22px] [&>button]:text-[22px] [&>button]:leading-none">
          <h2>Your Cart</h2>
          <button className={ICON_BTN} onClick={onClose} aria-label="Close cart">×</button>
        </div>

        {entries.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted text-center p-8">
            <p>Your cart is empty.</p>
            <p className="text-[14px] mt-2">Add some treats to get started!</p>
          </div>
        ) : (
          <>
            <ul className="list-none p-0 m-0 flex-1 min-h-0 overflow-y-auto">
              {entries.map(({ item, qty }) => (
                <CartItemRow
                  key={item.id}
                  item={item}
                  qty={qty}
                  isExiting={exitingIds.has(item.id)}
                  onIncrement={() => onIncrement(item)}
                  onDecrement={() => handleDecrement(item)}
                />
              ))}
            </ul>

            <div className="px-6 py-5 border-t border-line flex flex-col gap-3">
              <div className="flex justify-between text-[16px] font-semibold text-ink">
                <span>Subtotal</span>
                <span>{subtotal} pts</span>
              </div>
              <button
                className="bg-accent text-white border-none rounded-lg p-3 text-[15px] font-semibold transition-[background] duration-150 ease-in-out hover:bg-accent-dark"
                onClick={handleCheckout}
              >
                Checkout
              </button>
              <button
                className="bg-transparent text-muted border border-line rounded-lg p-2 text-[13px] hover:text-accent hover:border-accent"
                onClick={onClear}
              >
                Clear cart
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  )
}

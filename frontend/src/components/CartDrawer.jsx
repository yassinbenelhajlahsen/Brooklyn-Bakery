import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/useAuth.js';
import { computeCartSubtotal } from '../lib/cart.js';
import Drawer from './Drawer.jsx';
import CartItemRow from './CartItemRow.jsx';

const ROW_EXIT_MS = 320;

export default function CartDrawer({
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

  const header = <h2 className="text-[22px]">Your Cart</h2>;

  const footer = entries.length === 0 ? null : (close) => (
    <div className="px-6 py-5 border-t border-line flex flex-col gap-3">
      <div className="flex justify-between text-[16px] font-semibold text-ink">
        <span>Subtotal</span>
        <span>{subtotal} pts</span>
      </div>
      <button
        className="bg-accent text-white border-none rounded-lg p-3 text-[15px] font-semibold transition-[background] duration-150 ease-in-out hover:bg-accent-dark"
        onClick={() => {
          close();
          requestCheckout();
        }}
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
  );

  return (
    <Drawer
      onClose={onClose}
      ariaLabel="Shopping cart"
      width="w-[400px]"
      header={header}
      footer={footer}
    >
      {entries.length === 0 ? (
        <div className="overflow-y-auto flex flex-col items-center justify-center text-muted text-center p-8">
          <p>Your cart is empty.</p>
          <p className="text-[14px] mt-2">Add some treats to get started!</p>
        </div>
      ) : (
        <ul className="list-none p-0 m-0 overflow-y-auto">
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
      )}
    </Drawer>
  );
}

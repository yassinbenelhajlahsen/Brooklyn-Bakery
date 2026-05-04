import { useState } from "react";
import clsx from "clsx";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";
import { computeCartSubtotal } from "../lib/cart.js";
import CartItemRow from "../components/CartItemRow.jsx";
import Ornament from "../components/Ornament.jsx";
import AddressSelector from "../components/AddressSelector.jsx";
import { usePlaceOrder } from "../hooks/usePlaceOrder.js";

const PLACE_BTN = clsx(
  "bg-accent text-white border-none rounded-lg p-3.5",
  "font-sans font-medium text-[13px] leading-[1] tracking-[0.1em] uppercase",
  "[transition:background_180ms_ease,transform_180ms_ease,box-shadow_220ms_ease]",
  "shadow-[0_1px_0_rgba(0,0,0,0.04)]",
  "[&:hover:not(:disabled)]:bg-accent-dark [&:hover:not(:disabled)]:-translate-y-px",
  "[&:hover:not(:disabled)]:shadow-place-hover",
  "disabled:opacity-50 disabled:cursor-not-allowed",
  "motion-reduce:transition-none",
);

const BACK_BTN = clsx(
  "bg-transparent text-muted border border-line rounded-lg p-3",
  "font-sans font-medium text-[12px] leading-[1] tracking-[0.1em] uppercase",
  "[transition:color_180ms_ease,border-color_180ms_ease]",
  "hover:text-accent hover:border-accent",
  "motion-reduce:transition-none",
);

const SUMMARY_ROW =
  "flex justify-between items-baseline text-[15px] text-ink [&>dt]:text-muted [&>dd]:m-0 [&>dd]:font-medium";

function StateCard({ children }) {
  return (
    <div className="bg-surface border border-line rounded-xl px-8 py-12 text-center max-w-[560px] mx-auto">
      {children}
    </div>
  );
}

function CheckoutHeader({ eyebrow, title, subcopy }) {
  return (
    <header className="text-center mb-10">
      <div className="font-sans text-[11px] tracking-[0.22em] uppercase text-muted mb-3.5">{eyebrow}</div>
      <h2 className="font-display font-normal text-[42px] leading-[1.1] tracking-[-0.015em] text-ink m-0 [font-variation-settings:'opsz'_48] max-[880px]:text-[32px]">{title}</h2>
      <Ornament className="mt-5" />
      {subcopy && (
        <p className="font-display italic font-light text-[15px] leading-[1.5] text-muted max-w-[42ch] mx-auto mt-3.5">{subcopy}</p>
      )}
    </header>
  );
}

export default function CheckoutPage({
  cart,
  increment,
  decrement,
  removeItem,
  clearCart,
}) {
  const { user, profile, ready } = useAuth();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [addressId, setAddressId] = useState(null);
  const { placeOrder, submitting, error } = usePlaceOrder({
    onSuccess: (created) => {
      clearCart();
      setOrder({ id: created.id, total: created.total });
    },
  });

  if (!ready) return <main className="flex-1" />;
  if (!user) return <Navigate to="/" replace />;

  const entries = Object.values(cart);
  const subtotal = computeCartSubtotal(cart);
  const balance = profile?.balance ?? null;
  const balanceAfter = balance == null ? null : balance - subtotal;
  const insufficient = balance != null && balance < subtotal;
  const profileLoading = profile == null;

  if (order) {
    const shortId = order.id.slice(-8);
    return (
      <div className="w-full animate-checkout-rise motion-reduce:animate-none">
        <CheckoutHeader
          eyebrow="Confirmed"
          title="Order placed"
          subcopy="Your treats are spoken for. Thanks for visiting the bakery."
        />
        <StateCard>
          <div className="font-display text-[30px] tracking-[-0.01em] text-ink mt-2 mb-5 [font-variation-settings:'opsz'_48] [&>code]:font-display [&>code]:bg-none [&>code]:p-0">
            <code>#{shortId}</code>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 font-sans text-[15px] leading-[1.5] max-w-[280px] mx-auto mb-7 text-left [&>dt]:text-muted [&>dd]:m-0 [&>dd]:text-ink [&>dd]:font-medium [&>dd]:text-right">
            <dt>Total</dt>
            <dd>{order.total} pts</dd>
            <dt>Remaining balance</dt>
            <dd>{profile?.balance ?? "—"} pts</dd>
          </dl>
          <button
            className={clsx(PLACE_BTN, "min-w-[200px]")}
            onClick={() => navigate("/")}
          >
            Continue shopping
          </button>
        </StateCard>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="w-full animate-checkout-rise motion-reduce:animate-none">
        <CheckoutHeader
          eyebrow="Checkout"
          title="Nothing to review yet"
          subcopy="Your cart is empty — pick out a few things and come back."
        />
        <StateCard>
          <button
            className={clsx(PLACE_BTN, "min-w-[200px]")}
            onClick={() => navigate("/")}
          >
            Browse bakery
          </button>
        </StateCard>
      </div>
    );
  }

  return (
    <div className="w-full animate-checkout-rise motion-reduce:animate-none">
      <CheckoutHeader
        eyebrow="Checkout"
        title="Review your order"
        subcopy="Adjust quantities, check your balance, then place the order when you're ready."
      />

      <div className="grid grid-cols-[1fr_380px] gap-8 items-start max-[880px]:grid-cols-[1fr]">
        <ul className="bg-surface border border-line rounded-xl overflow-hidden list-none p-0 m-0">
          {entries.map(({ item, qty }) => (
            <CartItemRow
              key={item.id}
              variant="checkout"
              item={item}
              qty={qty}
              onIncrement={() => increment(item)}
              onDecrement={() => decrement(item)}
              onRemove={() => removeItem(item)}
            />
          ))}
        </ul>

        <aside className="bg-surface border border-line rounded-xl p-6 sticky top-6 flex flex-col gap-3.5 max-[880px]:static">
          <div className="font-sans text-[11px] tracking-[0.22em] uppercase text-muted mb-0.5">Summary</div>
          <div>
            <div className="font-sans text-[11px] tracking-[0.22em] uppercase text-muted mb-2">Ship to</div>
            <AddressSelector selectedId={addressId} onSelect={setAddressId} />
          </div>
          <div className="h-px bg-line my-1" />
          <dl className="m-0 flex flex-col gap-2.5">
            <div className={SUMMARY_ROW}>
              <dt>Subtotal</dt>
              <dd>{subtotal} pts</dd>
            </div>
            <div className={SUMMARY_ROW}>
              <dt>Current balance</dt>
              <dd>{profileLoading ? "—" : `${balance} pts`}</dd>
            </div>
            <div className="h-px bg-line my-1" />
            <div
              className={clsx(
                SUMMARY_ROW,
                "text-[16px] [&>dd]:font-semibold [&>dd]:text-accent-dark [&>dd]:text-[18px]",
                insufficient && "[&>dd]:!text-danger [&>dd]:!font-semibold",
              )}
            >
              <dt>Balance after</dt>
              <dd>{profileLoading ? "—" : `${balanceAfter} pts`}</dd>
            </div>
          </dl>

          {insufficient && !profileLoading && (
            <p className="font-sans text-[12.5px] text-danger -mt-1 mb-0 tracking-[0.01em]">
              Not enough points to complete this order.
            </p>
          )}

          {error && (
            <p
              className="font-sans font-normal text-[13px] leading-[1.4] text-danger px-3 py-2.5 border-l-2 border-danger bg-danger/5 m-0 animate-checkout-rise-quick motion-reduce:animate-none"
              role="alert"
            >
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2.5 mt-1.5">
            <button
              className={PLACE_BTN}
              onClick={() => placeOrder({ addressId })}
              disabled={
                entries.length === 0 ||
                submitting ||
                profileLoading ||
                insufficient ||
                !addressId
              }
            >
              {submitting ? "Placing order…" : "Place order"}
            </button>
            <button
              className={BACK_BTN}
              onClick={() => navigate("/")}
            >
              Back to home
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

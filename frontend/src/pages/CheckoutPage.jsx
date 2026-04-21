import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";

function Ornament() {
  return (
    <div className="checkout-ornament" aria-hidden="true">
      <span className="checkout-rule" />
      <span className="checkout-diamond" />
      <span className="checkout-rule" />
    </div>
  );
}

function CheckoutHeader({ eyebrow, title, subcopy }) {
  return (
    <header className="checkout-header">
      <div className="checkout-eyebrow">{eyebrow}</div>
      <h2 className="checkout-display">{title}</h2>
      <Ornament />
      {subcopy && <p className="checkout-subcopy">{subcopy}</p>}
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
  const { user, profile, refreshProfile, authedFetch } = useAuth();
  const navigate = useNavigate();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [order, setOrder] = useState(null);

  if (!user) return <Navigate to="/" replace />;

  const entries = Object.values(cart);
  const subtotal = entries.reduce(
    (sum, { item, qty }) => sum + item.price * qty,
    0,
  );
  const balance = profile?.balance ?? null;
  const balanceAfter = balance == null ? null : balance - subtotal;
  const insufficient = balance != null && balance < subtotal;
  const profileLoading = profile == null;

  if (order) {
    const shortId = order.id.slice(-8);
    return (
      <div className="checkout">
        <CheckoutHeader
          eyebrow="Confirmed"
          title="Order placed"
          subcopy="Your treats are spoken for. Thanks for visiting the bakery."
        />
        <div className="checkout-state-card">
          <div className="checkout-success-id">
            <code>#{shortId}</code>
          </div>
          <dl className="checkout-success-details">
            <dt>Total</dt>
            <dd>{order.total} pts</dd>
            <dt>Remaining balance</dt>
            <dd>{profile?.balance ?? "—"} pts</dd>
          </dl>
          <button
            className="checkout-place-btn"
            onClick={() => navigate("/")}
          >
            Continue shopping
          </button>
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="checkout">
        <CheckoutHeader
          eyebrow="Checkout"
          title="Nothing to review yet"
          subcopy="Your cart is empty — pick out a few things and come back."
        />
        <div className="checkout-state-card">
          <button
            className="checkout-place-btn"
            onClick={() => navigate("/")}
          >
            Browse bakery
          </button>
        </div>
      </div>
    );
  }

  const placeOrder = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await authedFetch("/orders", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg =
          res.status === 402
            ? "Not enough points to complete this order."
            : res.status === 400
              ? "Your cart is empty."
              : (body.error ?? "Something went wrong. Please try again.");
        setError(msg);
        setSubmitting(false);
        return;
      }
      const created = await res.json();
      clearCart();
      await refreshProfile();
      setOrder({ id: created.id, total: created.total });
      setSubmitting(false);
    } catch (err) {
      console.error("placeOrder failed:", err);
      setError("Could not reach the server. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="checkout">
      <CheckoutHeader
        eyebrow="Checkout"
        title="Review your order"
        subcopy="Adjust quantities, check your balance, then place the order when you're ready."
      />

      <div className="checkout-layout">
        <ul className="checkout-items">
          {entries.map(({ item, qty }) => (
            <li key={item.id} className="checkout-line">
              <img
                className="checkout-line-img"
                src={item.imageUrl}
                alt={item.description}
              />
              <div className="checkout-line-body">
                <div className="checkout-line-title">{item.name}</div>
                <div className="checkout-line-unit">{item.price} pts each</div>
                <div className="checkout-line-controls">
                  <div className="qty-controls">
                    <button
                      className="qty-btn"
                      onClick={() => decrement(item)}
                      aria-label="Decrease"
                    >
                      −
                    </button>
                    <span className="qty-value">{qty}</span>
                    <button
                      className="qty-btn"
                      onClick={() => increment(item)}
                      aria-label="Increase"
                    >
                      +
                    </button>
                  </div>
                  <button
                    className="checkout-line-remove"
                    onClick={() => removeItem(item)}
                  >
                    Remove
                  </button>
                </div>
              </div>
              <div className="checkout-line-total">{item.price * qty} pts</div>
            </li>
          ))}
        </ul>

        <aside className="checkout-summary">
          <div className="checkout-summary-heading">Summary</div>
          <dl className="checkout-summary-list">
            <div className="checkout-summary-row">
              <dt>Subtotal</dt>
              <dd>{subtotal} pts</dd>
            </div>
            <div className="checkout-summary-row">
              <dt>Current balance</dt>
              <dd>{profileLoading ? "—" : `${balance} pts`}</dd>
            </div>
            <div className="checkout-summary-divider" />
            <div
              className={`checkout-summary-row is-total${insufficient ? " is-warning" : ""}`}
            >
              <dt>Balance after</dt>
              <dd>{profileLoading ? "—" : `${balanceAfter} pts`}</dd>
            </div>
          </dl>

          {insufficient && !profileLoading && (
            <p className="checkout-insufficient">
              Not enough points to complete this order.
            </p>
          )}

          {error && (
            <p className="checkout-error" role="alert">
              {error}
            </p>
          )}

          <div className="checkout-actions">
            <button
              className="checkout-place-btn"
              onClick={placeOrder}
              disabled={
                entries.length === 0 ||
                submitting ||
                profileLoading ||
                insufficient
              }
            >
              {submitting ? "Placing order…" : "Place order"}
            </button>
            <button
              className="checkout-back-btn"
              onClick={() => navigate("/")}
            >
              Back to shop
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

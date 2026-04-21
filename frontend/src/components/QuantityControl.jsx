export default function QuantityControl({ qty, onIncrement, onDecrement }) {
  return (
    <div className="qty-controls">
      <button className="qty-btn" onClick={onDecrement} aria-label="Decrease">
        −
      </button>
      <span className="qty-value">{qty}</span>
      <button className="qty-btn" onClick={onIncrement} aria-label="Increase">
        +
      </button>
    </div>
  );
}

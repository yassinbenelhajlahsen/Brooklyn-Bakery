const QTY_BTN =
  "bg-surface border-none w-7 h-7 text-[16px] text-ink hover:bg-cream hover:text-accent";

export default function QuantityControl({ qty, onIncrement, onDecrement }) {
  return (
    <div className="flex items-center border border-line rounded-lg overflow-hidden">
      <button className={QTY_BTN} onClick={onDecrement} aria-label="Decrease">
        −
      </button>
      <span className="min-w-6 text-center text-[14px] border-x border-line px-1 py-0.5">
        {qty}
      </span>
      <button className={QTY_BTN} onClick={onIncrement} aria-label="Increase">
        +
      </button>
    </div>
  );
}

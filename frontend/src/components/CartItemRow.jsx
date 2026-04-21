import QuantityControl from './QuantityControl.jsx';

export default function CartItemRow({
  item,
  qty,
  onIncrement,
  onDecrement,
  onRemove,
  variant = 'drawer',
}) {
  if (variant === 'checkout') {
    return (
      <li className="grid grid-cols-[88px_1fr_auto] gap-5 items-center px-6 py-5 border-b border-line last:border-b-0 max-[880px]:grid-cols-[72px_1fr] max-[880px]:gap-3.5 max-[880px]:p-4">
        <img
          className="w-[88px] h-[88px] object-cover rounded-[10px] bg-cream block max-[880px]:w-[72px] max-[880px]:h-[72px]"
          src={item.imageUrl}
          alt={item.description}
        />
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="font-heading text-[19px] capitalize text-ink">{item.name}</div>
          <div className="text-[13px] text-muted">{item.price} pts each</div>
          <div className="flex items-center gap-4 mt-1">
            <QuantityControl
              qty={qty}
              onDecrement={onDecrement}
              onIncrement={onIncrement}
            />
            <button
              className="bg-none border-none text-muted text-[11px] tracking-[0.12em] uppercase p-0 transition-[color] duration-[180ms] ease-in-out hover:text-accent"
              onClick={onRemove}
            >
              Remove
            </button>
          </div>
        </div>
        <div className="font-semibold text-accent-dark text-[17px] text-right whitespace-nowrap max-[880px]:[grid-column:2/3] max-[880px]:text-left max-[880px]:text-[16px]">
          {item.price * qty} pts
        </div>
      </li>
    );
  }

  return (
    <li className="grid grid-cols-[64px_1fr_auto] gap-3 items-center px-6 py-4 border-b border-line">
      <img
        className="w-16 h-16 object-cover rounded-lg"
        src={item.imageUrl}
        alt={item.description}
      />
      <div className="flex flex-col gap-1 min-w-0 [&>div:last-child]:self-start">
        <div className="font-semibold capitalize text-ink">{item.name}</div>
        <div className="text-[13px] text-muted">{item.price} pts</div>
        <QuantityControl
          qty={qty}
          onDecrement={onDecrement}
          onIncrement={onIncrement}
        />
      </div>
      <div className="font-semibold text-accent-dark">{item.price * qty} pts</div>
    </li>
  );
}

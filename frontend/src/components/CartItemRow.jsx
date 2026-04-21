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
      <li className="checkout-line">
        <img
          className="checkout-line-img"
          src={item.imageUrl}
          alt={item.description}
        />
        <div className="checkout-line-body">
          <div className="checkout-line-title">{item.name}</div>
          <div className="checkout-line-unit">{item.price} pts each</div>
          <div className="checkout-line-controls">
            <QuantityControl
              qty={qty}
              onDecrement={onDecrement}
              onIncrement={onIncrement}
            />
            <button className="checkout-line-remove" onClick={onRemove}>
              Remove
            </button>
          </div>
        </div>
        <div className="checkout-line-total">{item.price * qty} pts</div>
      </li>
    );
  }

  return (
    <li className="cart-item">
      <img
        className="cart-item-img"
        src={item.imageUrl}
        alt={item.description}
      />
      <div className="cart-item-info">
        <div className="cart-item-title">{item.name}</div>
        <div className="cart-item-price">{item.price} pts</div>
        <QuantityControl
          qty={qty}
          onDecrement={onDecrement}
          onIncrement={onIncrement}
        />
      </div>
      <div className="cart-item-total">{item.price * qty} pts</div>
    </li>
  );
}

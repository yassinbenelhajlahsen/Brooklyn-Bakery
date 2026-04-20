export default function BakedGoodCard({ item, qty, onIncrement, onDecrement }) {
  return (
    <article className="card">
      <div className="card-image-wrap">
        <img
          className="card-image"
          src={item.imageUrl}
          alt={item.description}
        />
        {qty > 0 && <span className="qty-badge">Qty {qty}</span>}
      </div>

      <div className="card-body">
        <h3 className="card-title">{item.name}</h3>
        <p className="card-desc">{item.description}</p>
        <div className="card-footer">
          <span className="card-price">{item.price} pts</span>
          {qty === 0 ? (
            <button className="add-btn" onClick={onIncrement}>
              Add to cart
            </button>
          ) : (
            <div className="qty-controls">
              <button className="qty-btn" onClick={onDecrement} aria-label="Decrease">−</button>
              <span className="qty-value">{qty}</span>
              <button className="qty-btn" onClick={onIncrement} aria-label="Increase">+</button>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

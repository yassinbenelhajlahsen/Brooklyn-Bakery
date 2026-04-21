import QuantityControl from '../QuantityControl.jsx'

export default function BakedGoodCard({ item, qty, onIncrement, onDecrement }) {
  return (
    <article className="bg-surface border border-line rounded-xl overflow-hidden flex flex-col transition-[transform,box-shadow] duration-150 ease-in-out hover:-translate-y-0.5 hover:shadow-card">
      <div className="relative aspect-square bg-cream">
        <img
          className="w-full h-full object-cover block"
          src={item.imageUrl}
          alt={item.description}
        />
        {qty > 0 && (
          <span className="absolute top-2 right-2 bg-accent text-white text-[12px] font-semibold px-2.5 py-1 rounded-full">
            Qty {qty}
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col gap-2 flex-1">
        <h3 className="text-[18px] capitalize">{item.name}</h3>
        <p className="text-muted text-[14px] m-0 flex-1">{item.description}</p>
        <div className="flex items-center justify-between mt-2">
          <span className="font-semibold text-accent-dark text-[16px]">{item.price} pts</span>
          {qty === 0 ? (
            <button
              className="bg-accent text-white border-none rounded-lg px-3.5 py-1.5 text-[14px] font-medium transition-[background] duration-150 ease-in-out hover:bg-accent-dark"
              onClick={onIncrement}
            >
              Add to cart
            </button>
          ) : (
            <QuantityControl
              qty={qty}
              onDecrement={onDecrement}
              onIncrement={onIncrement}
            />
          )}
        </div>
      </div>
    </article>
  )
}

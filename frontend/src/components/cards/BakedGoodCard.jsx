import { useNavigate } from 'react-router-dom'
import QuantityControl from '../QuantityControl.jsx'

export default function BakedGoodCard({ item, qty, onIncrement, onDecrement }) {
  const navigate = useNavigate()

  const handleCardClick = () => {
    navigate(`/product/${item.id}`)
  }

  return (
    <article className="bg-surface border border-line rounded-xl overflow-hidden flex flex-col transition-[transform,box-shadow] duration-150 ease-in-out hover:-translate-y-0.5 hover:shadow-card cursor-pointer" onClick={handleCardClick}>
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

        {item.reviewCount > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-0.5">
              {[...Array(5)].map((_, i) => (
                <svg
                  key={i}
                  className={`w-3 h-3 ${i < Math.round(item.avgRating) ? 'fill-accent' : 'fill-line'}`}
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              ))}
            </div>
            <span className="text-[12px] text-muted">
              {Number(item.avgRating).toFixed(1)} ({item.reviewCount})
            </span>
          </div>
        )}

        <p className="text-muted text-[14px] m-0 flex-1">{item.description}</p>
        <div className="flex items-center justify-between mt-2">
          <span className="font-semibold text-accent-dark text-[16px]">{item.price} pts</span>
          {qty === 0 ? (
            <button
              className="bg-accent text-white border-none rounded-lg px-3.5 py-1.5 text-[14px] font-medium transition-[background] duration-150 ease-in-out hover:bg-accent-dark"
              onClick={(e) => {
                e.stopPropagation()
                onIncrement()
              }}
            >
              Add to cart
            </button>
          ) : (
            <div onClick={(e) => e.stopPropagation()}>
              <QuantityControl
                qty={qty}
                onDecrement={onDecrement}
                onIncrement={onIncrement}
              />
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

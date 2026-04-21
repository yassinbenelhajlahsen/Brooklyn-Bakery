import { useEffect, useMemo, useState } from 'react'
import BakedGoodCard from '../components/cards/BakedGoodCard.jsx'
import CategoryNav from '../components/CategoryNav.jsx'
import { CATEGORIES } from '../lib/categories.js'

const STATUS_CLS = "text-center text-muted py-12"

export default function ShopPage({ cart, onIncrement, onDecrement }) {
  const [bakedGoods, setBakedGoods] = useState([])
  const [error, setError] = useState(null)
  const [activeCategory, setActiveCategory] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/products`)
        const data = await response.json()
        if (!cancelled) setBakedGoods(data.items)
      } catch (err) {
        if (cancelled) return
        console.error('error: ', err)
        setError('Failed to load products.')
      }
    })()
    return () => { cancelled = true }
  }, [])

  const visible = useMemo(
    () => activeCategory
      ? bakedGoods.filter((i) => i.type === activeCategory || i.type + 's' === activeCategory)
      : bakedGoods,
    [bakedGoods, activeCategory]
  )

  return (
    <>
      <div className="sticky top-0 z-10">
        <CategoryNav
          categories={CATEGORIES}
          active={activeCategory}
          onSelect={setActiveCategory}
        />
      </div>
      <div className="p-8 max-sm:px-4 max-sm:py-5">
        {error ? (
          <p className={STATUS_CLS}>{error}</p>
        ) : !bakedGoods.length ? (
          <p className={STATUS_CLS}>Loading…</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-6">
            {visible.map((item) => (
              <BakedGoodCard
                key={item.id}
                item={item}
                qty={cart[item.id]?.qty ?? 0}
                onIncrement={() => onIncrement(item)}
                onDecrement={() => onDecrement(item)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}

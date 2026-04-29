import { useEffect, useMemo, useState } from 'react'
import BakedGoodCard from '../components/cards/BakedGoodCard.jsx'
import BakedGoodCardSkeleton from '../components/cards/BakedGoodCardSkeleton.jsx'
import Skeleton from '../components/Skeleton.jsx'
import CategoryNav from '../components/CategoryNav.jsx'
import { CATEGORIES } from '../lib/categories.js'

const STATUS_CLS = "text-center text-muted py-12"
const SORT_OPTIONS = [
  { value: 'default', label: 'Featured' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'top-rated', label: 'Top Rated' },
]

function sortProducts(items, sortBy) {
  const sortedItems = [...items]

  if (sortBy === 'price-asc') {
    sortedItems.sort((a, b) => a.price - b.price || a.name.localeCompare(b.name))
    return sortedItems
  }

  if (sortBy === 'price-desc') {
    sortedItems.sort((a, b) => b.price - a.price || a.name.localeCompare(b.name))
    return sortedItems
  }

  if (sortBy === 'top-rated') {
    sortedItems.sort((a, b) => {
      if (a.avgRating === null && b.avgRating === null) return 0
      if (a.avgRating === null) return 1
      if (b.avgRating === null) return -1
      return b.avgRating - a.avgRating
    })
    return sortedItems
  }

  sortedItems.sort((a, b) => a.name.localeCompare(b.name))
  return sortedItems
}

export default function ShopPage({ cart, onIncrement, onDecrement }) {
  const [bakedGoods, setBakedGoods] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState(null)
  const [sortBy, setSortBy] = useState('default')

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
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const visible = useMemo(() => {
    const filteredItems = activeCategory
      ? bakedGoods.filter((item) => item.type === activeCategory || item.type + 's' === activeCategory)
      : bakedGoods

    return sortProducts(filteredItems, sortBy)
  }, [bakedGoods, activeCategory, sortBy])

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
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between gap-4 max-sm:flex-col max-sm:items-stretch">
              {loading ? (
                <Skeleton className="h-4 w-14" />
              ) : (
                <p className="m-0 text-sm text-muted">
                  {visible.length} item{visible.length === 1 ? '' : 's'}
                </p>
              )}
              <label className="flex items-center gap-3 text-sm text-muted max-sm:justify-between">
                <span>Sort by</span>
                <select
                  className="min-w-52 rounded-lg border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none transition-shadow focus:shadow-card"
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value)}
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-6">
              {loading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <BakedGoodCardSkeleton key={i} />
                  ))
                : visible.map((item) => (
                    <BakedGoodCard
                      key={item.id}
                      item={item}
                      qty={cart[item.id]?.qty ?? 0}
                      onIncrement={() => onIncrement(item)}
                      onDecrement={() => onDecrement(item)}
                    />
                  ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}

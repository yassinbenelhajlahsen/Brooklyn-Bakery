import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import ProductCard from '../components/cards/ProductCard.jsx'
import { toProductSlug } from '../lib/slugUtils.js'
import ProductCardSkeleton from '../components/cards/ProductCardSkeleton.jsx'
import Skeleton from '../components/Skeleton.jsx'
import CategoryNav from '../components/CategoryNav.jsx'
import { CATEGORIES } from '../lib/categories.js'
import { apiGet } from '../lib/apiFetch.js'
import { queryKeys } from '../lib/queryKeys.js'

const STATUS_CLS = "text-center text-muted py-12"
const SEARCH_DEBOUNCE_MS = 250
const PAGE_SIZE = 20

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance', searchOnly: true },
  { value: 'default', label: 'Featured' },
  { value: 'newest', label: 'Newest arrivals' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'top-rated', label: 'Top Rated' },
]

function sortProducts(items, sortBy) {
  const sortedItems = [...items]

  if (sortBy === 'relevance') {
    sortedItems.sort((a, b) => {
      const sa = a.score ?? 0
      const sb = b.score ?? 0
      return sb - sa || a.name.localeCompare(b.name)
    })
    return sortedItems
  }

  if (sortBy === 'newest') {
    sortedItems.sort((a, b) => {
      const da = new Date(a.createdAt).getTime()
      const db = new Date(b.createdAt).getTime()
      return db - da || a.name.localeCompare(b.name)
    })
    return sortedItems
  }

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
  const [searchParams, setSearchParams] = useSearchParams()
  const urlQuery = searchParams.get('q') ?? ''

  const [activeCategory, setActiveCategory] = useState(null)
  const [sortBy, setSortBy] = useState(urlQuery.trim() ? 'relevance' : 'default')
  const [inputValue, setInputValue] = useState(urlQuery)
  const [limit, setLimit] = useState(PAGE_SIZE)

  const prevHasQueryRef = useRef(urlQuery.trim().length > 0)

  useEffect(() => {
    if (inputValue === urlQuery) return
    const handle = setTimeout(() => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (inputValue.trim()) next.set('q', inputValue)
          else next.delete('q')
          return next
        },
        { replace: true },
      )
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [inputValue, urlQuery, setSearchParams])

  useEffect(() => {
    // Reset pagination when filters change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLimit(PAGE_SIZE)
  }, [urlQuery, activeCategory])

  useEffect(() => {
    const hasQuery = urlQuery.trim().length > 0
    const prevHadQuery = prevHasQueryRef.current
    if (!prevHadQuery && hasQuery) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSortBy((current) => (current === 'default' ? 'relevance' : current))
    } else if (prevHadQuery && !hasQuery) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSortBy((current) => (current === 'relevance' ? 'default' : current))
    }
    prevHasQueryRef.current = hasQuery
  }, [urlQuery])

  const trimmed = urlQuery.trim()
  const productsQuery = useQuery({
    queryKey: queryKeys.products({ search: trimmed }),
    queryFn: () => apiGet(trimmed ? `/products?search=${encodeURIComponent(trimmed)}` : '/products'),
    staleTime: 60_000,
  })

  const bakedGoods = productsQuery.data?.items ?? []
  const loading = productsQuery.isLoading
  const error = productsQuery.isError ? 'Failed to load products.' : null

  const visible = useMemo(() => {
    const filteredItems = activeCategory
      ? bakedGoods.filter((item) => item.type === activeCategory || item.type + 's' === activeCategory)
      : bakedGoods

    return sortProducts(filteredItems, sortBy)
  }, [bakedGoods, activeCategory, sortBy])

  const hasQuery = urlQuery.trim().length > 0
  const sortOptions = SORT_OPTIONS.filter((opt) => !opt.searchOnly || hasQuery)
  const paged = visible.slice(0, limit)
  const hasMore = visible.length > limit
  const gridSig = `${activeCategory ?? 'all'}|${sortBy}|${urlQuery.trim()}`

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
              <div className="flex items-center gap-3 max-sm:flex-col max-sm:items-stretch max-sm:gap-2">
                <input
                  type="search"
                  placeholder="Search products…"
                  className="min-w-56 rounded-lg border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none transition-shadow focus:shadow-card max-sm:min-w-0"
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  aria-label="Search products"
                />
                <label className="flex items-center gap-3 text-sm text-muted max-sm:justify-between">
                  <span>Sort by</span>
                  <select
                    className="min-w-52 rounded-lg border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none transition-shadow focus:shadow-card"
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value)}
                  >
                    {sortOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            {!loading && hasQuery && visible.length === 0 ? (
              <p className={STATUS_CLS}>No products match &ldquo;{urlQuery.trim()}&rdquo;.</p>
            ) : (
              <>
                <div
                  key={loading ? 'loading' : gridSig}
                  className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-6"
                >
                  {loading
                    ? Array.from({ length: 8 }).map((_, i) => (
                        <ProductCardSkeleton key={i} />
                      ))
                    : paged.map((item, i) => (
                        <ProductCard
                          key={item.id}
                          item={item}
                          slug={toProductSlug(item.name, item.id, bakedGoods)}
                          qty={cart[item.id]?.qty ?? 0}
                          onIncrement={() => onIncrement(item)}
                          onDecrement={() => onDecrement(item)}
                          className="animate-card-rise motion-reduce:animate-none"
                          style={{ animationDelay: `${Math.min(i, 11) * 35}ms` }}
                        />
                      ))}
                </div>
                {!loading && hasMore && (
                  <div className="mt-8 flex justify-center">
                    <button
                      className="rounded-lg border border-line bg-surface px-6 py-2.5 text-sm text-ink transition-shadow hover:shadow-card"
                      onClick={() => setLimit((prev) => prev + PAGE_SIZE)}
                    >
                      See more
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </>
  )
}

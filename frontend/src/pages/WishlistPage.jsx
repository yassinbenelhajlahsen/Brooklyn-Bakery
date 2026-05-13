import { useState } from 'react'
import clsx from 'clsx'
import { Navigate, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/useAuth.js'
import Ornament from '../components/Ornament.jsx'
import { queryKeys } from '../lib/queryKeys.js'
import { fetchWishlist, removeWishlistItem } from '../services/wishlistService.js'

const CATEGORY_LABELS = {
  all: 'All',
  bread: 'Breads',
  pastry: 'Pastries',
  cake: 'Cakes',
  cookie: 'Cookies',
  drink: 'Drinks',
}

const FILTER_ORDER = ['all', 'bread', 'pastry', 'cake', 'cookie', 'drink']

const formatSavedDate = (iso) => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function WishlistPage({ cart, onIncrement }) {
  const { user, ready, authedFetch } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeFilter, setActiveFilter] = useState('all')

  const wishlistQuery = useQuery({
    queryKey: queryKeys.wishlist(),
    queryFn: () => fetchWishlist(authedFetch),
    enabled: !!user,
    staleTime: 0,
  })

  const removeMutation = useMutation({
    mutationFn: (productId) => removeWishlistItem(authedFetch, productId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.wishlist() }),
  })

  const entries = [...(wishlistQuery.data?.items ?? [])].sort(
    (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime(),
  )

  const counts = entries.reduce(
    (acc, { product }) => {
      acc.all = (acc.all ?? 0) + 1
      acc[product.type] = (acc[product.type] ?? 0) + 1
      return acc
    },
    {},
  )

  const availableFilters = FILTER_ORDER.filter(
    (key) => key === 'all' || (counts[key] ?? 0) > 0,
  )

  const visibleEntries = activeFilter === 'all'
    ? entries
    : entries.filter(({ product }) => product.type === activeFilter)

  if (!ready) return <main className="flex-1 bg-cream" />
  if (!user) return <Navigate to="/" replace />

  const totalCount = entries.length
  const indexLabel = String(totalCount).padStart(2, '0')

  return (
    <main className="flex-1 bg-cream overflow-y-auto">
      <div className="max-w-[1100px] mx-auto px-10 py-14 max-md:px-6 max-md:py-10 max-sm:px-5 max-sm:py-8">
        <header className="relative mb-12 pb-8 border-b border-line">
          <div className="flex justify-between items-start gap-6 mb-5 max-sm:mb-3">
            <span className="font-sans text-[11px] tracking-[0.32em] uppercase text-muted">
              Brooklyn Bakery · The Edit
            </span>
            <span className="font-sans text-[11px] tracking-[0.32em] uppercase text-muted tabular-nums">
              N° {indexLabel} Saved
            </span>
          </div>

          <div className="flex justify-between items-end gap-8 max-md:flex-col max-md:items-start max-md:gap-5">
            <h1
              className="font-display text-ink m-0 leading-[0.88] tracking-[-0.045em] text-[clamp(56px,11vw,140px)] [font-variation-settings:'opsz'_144]"
            >
              Wishlist
            </h1>
            <p className="font-display italic text-muted text-[18px] max-w-[280px] leading-snug [font-variation-settings:'opsz'_24] max-md:text-[16px] max-md:max-w-none">
              Treats earmarked for your next visit — folded down at the corner, like a page in a cookbook.
            </p>
          </div>
        </header>

        <div className="mb-10 flex justify-between items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="group font-sans text-[11px] tracking-[0.22em] uppercase text-muted hover:text-accent transition-colors inline-flex items-center gap-2"
          >
            <span aria-hidden className="transition-transform group-hover:-translate-x-0.5">←</span>
            Back to the shop
          </button>
        </div>

        {wishlistQuery.isLoading ? (
          <EditorialSkeleton />
        ) : wishlistQuery.isError ? (
          <ErrorPanel message={wishlistQuery.error?.message} />
        ) : entries.length === 0 ? (
          <EmptyState onBrowse={() => navigate('/')} />
        ) : (
          <>
            <nav
              className="flex flex-wrap items-end gap-x-8 gap-y-3 mb-3 border-b border-line"
              aria-label="Filter wishlist by category"
            >
              {availableFilters.map((key) => {
                const isActive = activeFilter === key
                const count = counts[key] ?? 0
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveFilter(key)}
                    className={clsx(
                      'relative font-display text-[20px] leading-none pb-3 transition-colors duration-200',
                      "[font-variation-settings:'opsz'_30]",
                      isActive ? 'text-ink' : 'text-muted hover:text-ink',
                    )}
                  >
                    {CATEGORY_LABELS[key]}
                    <sup className="ml-1 font-sans text-[10px] tracking-[0.15em] font-normal text-muted tabular-nums">
                      {String(count).padStart(2, '0')}
                    </sup>
                    <span
                      className={clsx(
                        'absolute left-0 right-0 -bottom-px h-[2px] bg-accent origin-left transition-transform duration-300',
                        isActive ? 'scale-x-100' : 'scale-x-0',
                      )}
                    />
                  </button>
                )
              })}
            </nav>

            <ol className="flex flex-col">
              {visibleEntries.map(({ product, addedAt }, idx) => (
                <WishlistRow
                  key={product.id}
                  product={product}
                  addedAt={addedAt}
                  index={idx + 1}
                  qty={cart[product.id]?.qty ?? 0}
                  onCardClick={() => navigate(`/product/${product.slug}`)}
                  onAdd={() => onIncrement(product)}
                  onRemove={() => removeMutation.mutate(product.id)}
                  removeBusy={
                    removeMutation.isPending && removeMutation.variables === product.id
                  }
                />
              ))}
            </ol>
          </>
        )}
      </div>
    </main>
  )
}

function WishlistRow({
  product,
  addedAt,
  index,
  qty,
  onCardClick,
  onAdd,
  onRemove,
  removeBusy,
}) {
  return (
    <li
      className="group relative grid grid-cols-[56px_220px_1fr] gap-8 py-9 border-b border-line items-start max-lg:grid-cols-[160px_1fr] max-lg:gap-6 max-sm:grid-cols-[110px_1fr] max-sm:gap-4 max-sm:py-6 animate-card-rise"
      style={{ animationDelay: `${Math.min(index * 70, 420)}ms` }}
    >
      <div className="font-sans text-muted text-[11px] tracking-[0.28em] uppercase pt-3 tabular-nums max-lg:hidden">
        N° {String(index).padStart(2, '0')}
      </div>

      <button
        type="button"
        onClick={onCardClick}
        className="block aspect-square overflow-hidden bg-cream border border-line rounded-sm relative group/img"
        aria-label={`View ${product.name}`}
      >
        <img
          src={product.imageUrl}
          alt={product.description}
          className="w-full h-full object-cover block transition-transform duration-700 ease-out group-hover/img:scale-[1.06]"
        />
        {qty > 0 && (
          <span className="absolute top-2 left-2 bg-ink text-cream font-sans text-[10px] tracking-[0.18em] uppercase px-2 py-1 rounded-sm">
            In cart · {qty}
          </span>
        )}
      </button>

      <div className="flex flex-col gap-3 min-w-0">
        <div className="flex items-baseline gap-x-4 gap-y-1 flex-wrap">
          <span className="font-sans text-[11px] tracking-[0.3em] uppercase text-accent">
            {CATEGORY_LABELS[product.type] ?? product.type}
          </span>
          <span className="font-sans text-[10px] tracking-[0.18em] uppercase text-muted">
            Saved {formatSavedDate(addedAt)}
          </span>
        </div>

        <button
          type="button"
          onClick={onCardClick}
          className="text-left font-display text-ink leading-[1.02] tracking-[-0.025em] capitalize transition-colors hover:text-accent-dark text-[clamp(24px,3.2vw,36px)] [font-variation-settings:'opsz'_60]"
        >
          {product.name}
        </button>

        {product.reviewCount > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-0.5">
              {[...Array(5)].map((_, i) => (
                <svg
                  key={i}
                  className={i < Math.round(product.avgRating) ? 'w-3 h-3 fill-accent' : 'w-3 h-3 fill-line'}
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              ))}
            </div>
            <span className="font-sans text-[11px] tracking-[0.06em] text-muted tabular-nums">
              {Number(product.avgRating).toFixed(1)} · {product.reviewCount} reviews
            </span>
          </div>
        )}

        <p className="text-muted font-sans text-[14px] leading-relaxed max-w-[56ch] line-clamp-2">
          {product.description}
        </p>

        <div className="flex items-center gap-x-6 gap-y-3 mt-3 flex-wrap">
          <span className="font-display text-accent-dark text-[26px] leading-none tabular-nums [font-variation-settings:'opsz'_36]">
            {product.price}
            <span className="font-sans text-[10px] tracking-[0.22em] uppercase text-muted ml-1.5 align-middle">
              pts
            </span>
          </span>

          <div className="flex-1 min-w-[4px]" />

          <button
            type="button"
            onClick={onRemove}
            disabled={removeBusy}
            className="font-sans text-[11px] tracking-[0.22em] uppercase text-muted hover:text-danger transition-colors disabled:opacity-40 disabled:cursor-wait inline-flex items-center gap-2"
          >
            <span aria-hidden>—</span>
            {removeBusy ? 'Removing…' : 'Remove'}
          </button>

          <button
            type="button"
            onClick={onAdd}
            className="group/add font-sans text-[11px] tracking-[0.22em] uppercase bg-ink text-cream px-6 py-3 rounded-full hover:bg-accent-dark transition-colors inline-flex items-center gap-2"
          >
            Add to cart
            <span aria-hidden className="transition-transform group-hover/add:translate-x-0.5">
              →
            </span>
          </button>
        </div>
      </div>
    </li>
  )
}

function EmptyState({ onBrowse }) {
  return (
    <div className="text-center py-20 max-w-[520px] mx-auto">
      <p className="font-display italic text-muted text-[22px] leading-snug [font-variation-settings:'opsz'_36] mb-6 max-sm:text-[18px]">
        “A wishlist is a quiet conversation with your future self —
        and yours is still listening for an answer.”
      </p>
      <Ornament className="mb-8" />
      <button
        onClick={onBrowse}
        className="font-sans text-[11px] tracking-[0.22em] uppercase bg-ink text-cream px-7 py-3 rounded-full hover:bg-accent-dark transition-colors inline-flex items-center gap-2 group"
      >
        Browse the bakery
        <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
      </button>
    </div>
  )
}

function ErrorPanel({ message }) {
  return (
    <div className="bg-surface border border-line rounded-sm px-8 py-12 text-center font-sans text-danger">
      {message ?? 'Could not load your wishlist.'}
    </div>
  )
}

function EditorialSkeleton() {
  return (
    <div className="flex flex-col">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="grid grid-cols-[56px_220px_1fr] gap-8 py-9 border-b border-line items-start max-lg:grid-cols-[160px_1fr] max-lg:gap-6 max-sm:grid-cols-[110px_1fr] max-sm:gap-4"
        >
          <div className="h-3 bg-line rounded-sm animate-pulse max-lg:hidden" />
          <div className="aspect-square bg-line rounded-sm animate-pulse" />
          <div className="flex flex-col gap-3">
            <div className="h-3 w-28 bg-line rounded-sm animate-pulse" />
            <div className="h-9 w-2/3 bg-line rounded-sm animate-pulse" />
            <div className="h-3 w-full bg-line rounded-sm animate-pulse" />
            <div className="h-3 w-1/2 bg-line rounded-sm animate-pulse" />
            <div className="flex gap-3 mt-3">
              <div className="h-6 w-16 bg-line rounded-sm animate-pulse" />
              <div className="flex-1" />
              <div className="h-9 w-32 bg-line rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

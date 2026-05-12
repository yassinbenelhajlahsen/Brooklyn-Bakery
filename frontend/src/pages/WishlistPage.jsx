import { useState } from 'react'
import clsx from 'clsx'
import { Navigate, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/useAuth.js'
import Ornament from '../components/Ornament.jsx'
import ProductCard from '../components/cards/ProductCard.jsx'
import { queryKeys } from '../lib/queryKeys.js'
import { fetchWishlist, removeWishlistItem } from '../services/wishlistService.js'

const BACK_BTN = clsx(
  "bg-transparent text-muted border border-line rounded-lg p-3",
  "font-sans font-medium text-[12px] leading-[1] tracking-[0.1em] uppercase",
  "[transition:color_180ms_ease,border-color_180ms_ease]",
  "hover:text-accent hover:border-accent",
  "motion-reduce:transition-none",
)

const CATEGORY_LABELS = {
  all: 'All',
  bread: 'Breads',
  pastry: 'Pastries',
  cake: 'Cakes',
  cookie: 'Cookies',
  drink: 'Drinks',
}

export default function WishlistPage({ cart, onIncrement, onDecrement }) {
  const { user, ready, authedFetch } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [openSection, setOpenSection] = useState(null)

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

  if (!ready) return <main className="flex-1 p-8 max-w-full overflow-y-auto max-sm:px-4 max-sm:py-5" />
  if (!user) return <Navigate to="/" replace />

  const entries = [...(wishlistQuery.data?.items ?? [])].sort(
    (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime(),
  )
  const groupedEntries = [
    { key: 'all', label: CATEGORY_LABELS.all, entries },
    ...Object.entries(CATEGORY_LABELS)
      .filter(([key]) => key !== 'all')
      .map(([key, label]) => ({
        key,
        label,
        entries: entries.filter(({ product }) => product.type === key),
      }))
      .filter((group) => group.entries.length > 0),
  ]

  return (
    <main className="flex-1 p-8 max-w-full overflow-y-auto max-sm:px-4 max-sm:py-5">
      <div className="w-full">
        <header className="text-center mb-10">
          <h2 className="font-display font-normal text-[42px] leading-[1.1] tracking-[-0.015em] text-ink m-0 [font-variation-settings:'opsz'_48] max-[880px]:text-[32px]">
           Wishlist
          </h2>
          <Ornament className="mt-5" />
        </header>

        <div className="mb-6 flex justify-start">
          <button className={BACK_BTN} onClick={() => navigate('/')}>
            Back to home
          </button>
        </div>

        {wishlistQuery.isLoading ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-96 rounded-xl border border-line bg-cream animate-pulse" />
            ))}
          </div>
        ) : wishlistQuery.isError ? (
          <div className="bg-surface border border-line rounded-xl px-8 py-12 text-center text-danger">
            {wishlistQuery.error?.message ?? 'Could not load your wishlist.'}
          </div>
        ) : entries.length === 0 ? (
          <div className="bg-surface border border-line rounded-xl px-8 py-12 text-center text-muted">
            Your wishlist is empty. Save a treat for later from any product page.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {groupedEntries.map((group) => (
              <section key={group.key} className="border border-line rounded-xl bg-surface overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-accent/10"
                  onClick={() => setOpenSection((current) => (current === group.key ? null : group.key))}
                  aria-expanded={openSection === group.key}
                >
                  <span className="font-display text-[24px] leading-tight text-ink">
                    {group.label}
                  </span>
                  <span className="flex items-center gap-3 text-[13px] text-muted">
                    {group.entries.length} {group.entries.length === 1 ? 'item' : 'items'}
                    <ChevronIcon open={openSection === group.key} className="w-4 h-4" />
                  </span>
                </button>

                {openSection === group.key && (
                  <div className="border-t border-line p-5">
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-6">
                      {group.entries.map(({ product }) => (
                        <div key={product.id} className="flex flex-col gap-2">
                          <ProductCard
                            item={product}
                            slug={product.slug}
                            qty={cart[product.id]?.qty ?? 0}
                            onIncrement={() => onIncrement(product)}
                            onDecrement={() => onDecrement(product)}
                          />
                          <button
                            type="button"
                            className="rounded-lg border border-line bg-surface px-4 py-2 text-sm text-muted transition-colors hover:border-accent hover:text-accent disabled:cursor-wait disabled:opacity-60"
                            onClick={() => removeMutation.mutate(product.id)}
                            disabled={removeMutation.isPending}
                          >
                            Remove from wishlist
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

function ChevronIcon({ open, className }) {
  return (
    <svg
      className={clsx(className, 'transition-transform duration-150', open && 'rotate-180')}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

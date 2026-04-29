import Skeleton from '../Skeleton.jsx'

export default function OrderCardSkeleton() {
  return (
    <article className="bg-surface border border-line rounded-xl p-6">
      <div className="flex items-start justify-between gap-4 border-b border-line pb-4 max-sm:flex-col">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-3 w-40" />
        </div>
        <div className="flex flex-col gap-2 items-end max-sm:items-start">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>

      <ul className="mt-4 grid gap-3 list-none p-0 m-0">
        {[0, 1].map((i) => (
          <li key={i} className="flex items-center gap-4 rounded-xl border border-line bg-cream/30 p-3 max-sm:items-start">
            <Skeleton className="h-16 w-16 rounded-lg" />
            <div className="min-w-0 flex-1 flex flex-col gap-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-col gap-2">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>

      <div className="mt-4">
        <Skeleton className="h-8 w-32 rounded" />
      </div>
    </article>
  )
}

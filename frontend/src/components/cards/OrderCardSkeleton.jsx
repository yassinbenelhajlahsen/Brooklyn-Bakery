import Skeleton from '../Skeleton.jsx'

export default function OrderCardSkeleton() {
  return (
    <article className="bg-surface border border-line rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 border-b border-line pb-3 max-sm:flex-col">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-32" />
        </div>
        <div className="flex flex-col gap-1.5 items-end max-sm:items-start">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-14 rounded-full" />
        </div>
      </div>

      <ul className="mt-3 grid gap-2 list-none p-0 m-0">
        {[0, 1].map((i) => (
          <li key={i} className="flex items-center gap-3 rounded-lg border border-line bg-cream/30 p-2 max-sm:items-start">
            <Skeleton className="h-10 w-10 rounded-md" />
            <div className="min-w-0 flex-1 flex flex-col gap-1.5">
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-col gap-1.5">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>

      <div className="mt-3">
        <Skeleton className="h-7 w-24 rounded" />
      </div>
    </article>
  )
}

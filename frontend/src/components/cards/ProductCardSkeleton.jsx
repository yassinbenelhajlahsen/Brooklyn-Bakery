import Skeleton from '../Skeleton.jsx'

export default function ProductCardSkeleton() {
  return (
    <article className="bg-surface border border-line rounded-xl overflow-hidden flex flex-col">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="p-4 flex flex-col gap-2 flex-1">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <div className="flex items-center justify-between mt-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </div>
    </article>
  )
}

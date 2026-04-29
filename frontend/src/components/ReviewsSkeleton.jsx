import Skeleton from './Skeleton.jsx'

function ReviewRowSkeleton() {
  return (
    <div className="flex gap-3 py-3 border-b border-line last:border-b-0">
      <Skeleton className="h-10 w-10 rounded-full shrink-0" />
      <div className="flex-1 flex flex-col gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>
    </div>
  )
}

export default function ReviewsSkeleton({ count = 2 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <ReviewRowSkeleton key={i} />
      ))}
    </div>
  )
}

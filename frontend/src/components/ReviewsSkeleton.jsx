import Skeleton from './Skeleton.jsx'

function ReviewRowSkeleton() {
  return (
    <div className="bg-cream rounded-lg p-4 border border-line">
      <div className="flex items-start justify-between mb-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-4 w-20" />
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="mt-1 h-3 w-5/6" />
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

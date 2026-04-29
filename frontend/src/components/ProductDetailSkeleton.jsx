import Skeleton from './Skeleton.jsx'
import ReviewsSkeleton from './ReviewsSkeleton.jsx'

export default function ProductDetailSkeleton() {
  return (
    <>
      <div className="mb-6 flex justify-start">
        <Skeleton className="h-[38px] w-28 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <Skeleton className="aspect-square w-full rounded-xl" />

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-9 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>

          <div className="border-t border-b border-line py-4 flex flex-col gap-3">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-4 w-40" />
          </div>

          <Skeleton className="h-12 w-full rounded-lg" />

          <section className="border-t border-line pt-6">
            <Skeleton className="h-6 w-24 mb-4" />
            <ReviewsSkeleton />
          </section>
        </div>
      </div>
    </>
  )
}

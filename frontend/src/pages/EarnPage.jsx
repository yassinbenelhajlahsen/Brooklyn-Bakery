import { lazy, Suspense } from 'react'
import Skeleton from '../components/Skeleton.jsx'

const CookieClicker = lazy(() => import('../components/CookieClicker.jsx'))

export default function EarnPage() {
  return (
    <section className="relative flex items-center justify-center px-8 py-10 max-sm:px-4 min-h-full w-full">
      <Suspense fallback={<Skeleton className="w-[min(560px,90vw)] aspect-square rounded-full" />}>
        <CookieClicker />
      </Suspense>
    </section>
  )
}

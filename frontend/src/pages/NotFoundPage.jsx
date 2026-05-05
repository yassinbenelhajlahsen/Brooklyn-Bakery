import clsx from 'clsx'
import { Link } from 'react-router-dom'
import Ornament from '../components/Ornament.jsx'

const HOME_BTN = clsx(
  "inline-block bg-accent text-white rounded-lg px-6 py-3",
  "font-sans font-medium text-[12px] leading-[1] tracking-[0.1em] uppercase",
  "[transition:opacity_180ms_ease]",
  "hover:opacity-90",
  "motion-reduce:transition-none",
)

export default function NotFoundPage() {
  return (
    <main className="flex-1 p-8 max-w-full overflow-y-auto max-sm:px-4 max-sm:py-5">
      <div className="max-w-xl mx-auto text-center py-16">
        <p className="font-display font-normal text-[96px] leading-[1] tracking-[-0.02em] text-accent m-0 [font-variation-settings:'opsz'_96] max-[880px]:text-[72px]">
          404
        </p>
        <Ornament className="mt-6" />
        <h1 className="mt-6 font-display font-normal text-[32px] leading-[1.1] tracking-[-0.015em] text-ink m-0 [font-variation-settings:'opsz'_36] max-[880px]:text-[26px]">
          Page not found
        </h1>
        <p className="mt-4 text-muted text-sm">
          The page you’re looking for doesn’t exist or has been moved.
        </p>
        <div className="mt-8">
          <Link to="/" className={HOME_BTN}>
            Back to home
          </Link>
        </div>
      </div>
    </main>
  )
}

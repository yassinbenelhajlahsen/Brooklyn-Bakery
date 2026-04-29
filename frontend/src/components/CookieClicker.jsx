import { useCookieClicker } from '../hooks/useCookieClicker.js'

export default function CookieClicker() {
  const { displayPoints, handleClick, isAuthenticated, displayName } = useCookieClicker()
  const heading = displayName ? `${displayName}'s bakery` : 'Your bakery'

  const handleCookieClick = () => {
    handleClick()
  }

  return (
    <>
      <div className="flex flex-col items-center justify-center gap-8 w-full h-full">
        <div>
          <h2 className="text-center text-2xl text-ink">{heading}</h2>
          {!isAuthenticated && (
            <p className="text-xs text-muted text-center mt-2 italic">
              Log in to save your points
            </p>
          )}
        </div>
        <div className="bg-surface p-6 rounded-lg border border-line text-center shadow-card">
          <p className="text-5xl font-bold text-accent m-0 font-display">{displayPoints}</p>
          <p className="text-[0.9rem] text-muted mt-2 mb-0 uppercase tracking-[0.05em]">Points</p>
        </div>

        <button
          className="text-[21rem] bg-none border-none cursor-pointer p-0 transition-transform duration-100 ease-in-out select-none leading-none drop-shadow-[0_4px_12px_rgba(61,47,36,0.15)] hover:scale-105 active:animate-cookie-click"
          onClick={handleCookieClick}
        >
          🍪
        </button>
      </div>

    </>
  )
}

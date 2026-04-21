import { useRef, useState } from 'react'

export default function CookieClicker() {
  const [points, setPoints] = useState(0)
  const [floatingTexts, setFloatingTexts] = useState([])
  const idRef = useRef(0)

  const handleCookieClick = (e) => {
    const pointsGained = 10
    setPoints((prev) => prev + pointsGained)

    const id = ++idRef.current
    setFloatingTexts((prev) => [
      ...prev,
      { id, x: e.clientX, y: e.clientY, points: pointsGained },
    ])
  }

  const removeFloater = (id) => {
    setFloatingTexts((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <>
      <div className="flex flex-col items-center justify-center gap-8 w-full h-full">
        <h2 className="text-center text-2xl text-ink mb-4"> CSstudent832's bakery </h2>
        <div className="bg-surface p-6 rounded-lg border border-line text-center shadow-card">
          <p className="text-5xl font-bold text-accent m-0 font-display">{points}</p>
          <p className="text-[0.9rem] text-muted mt-2 mb-0 uppercase tracking-[0.05em]">Points</p>
        </div>

        <button
          className="text-[14rem] bg-none border-none cursor-pointer p-0 transition-transform duration-100 ease-in-out select-none leading-none drop-shadow-[0_4px_12px_rgba(61,47,36,0.15)] hover:scale-105 active:animate-cookie-click"
          onClick={handleCookieClick}
        >
          🍪
        </button>
      </div>

      {floatingTexts.map((text) => (
        <div
          key={text.id}
          className="fixed pointer-events-none text-[1.75rem] font-bold text-accent animate-float-up [text-shadow:0_2px_4px_rgba(0,0,0,0.1)] font-display"
          style={{
            left: `${text.x}px`,
            top: `${text.y}px`,
          }}
          onAnimationEnd={() => removeFloater(text.id)}
        >
          +{text.points}
        </div>
      ))}
    </>
  )
}

import { useState } from 'react'

export default function CookieClicker() {
  const [points, setPoints] = useState(0)
  const [floatingTexts, setFloatingTexts] = useState([])

  const handleCookieClick = (e) => {
    const pointsGained = 10
    setPoints((prev) => prev + pointsGained)

    // Create floating text animation
    const id = Date.now()
    const newFloatingText = {
      id,
      x: e.clientX,
      y: e.clientY,
      points: pointsGained,
    }
    setFloatingTexts((prev) => [...prev, newFloatingText])

    // Remove floating text after animation
    setTimeout(() => {
      setFloatingTexts((prev) => prev.filter((t) => t.id !== id))
    }, 1000)
  }

  return (
    <>
      <div className="cookie-content">
        <h2 className="cookie-title"> CSstudent832's bakery </h2>
        <div className="points-display">
          <p className="points-text">{points}</p>
          <p className="points-label">Points</p>
        </div>

        <button className="cookie-button" onClick={handleCookieClick}>
          🍪
        </button>
      </div>

      {floatingTexts.map((text) => (
        <div
          key={text.id}
          className="floating-points"
          style={{
            left: `${text.x}px`,
            top: `${text.y}px`,
          }}
        >
          +{text.points}
        </div>
      ))}
    </>
  )
}

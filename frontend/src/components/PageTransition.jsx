import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

const SLIDE_MS = 500

function transitionKey(pathname) {
  // Shop ('/') and Earn ('/earn') share ShopEarnShell, which runs its own
  // horizontal slide. Collapsing them to one key avoids a double animation.
  if (pathname === '/' || pathname === '/earn') return 'shop'
  return pathname
}

export default function PageTransition({ children }) {
  const { pathname } = useLocation()
  const isEarn = pathname === '/earn'

  // Mirrors ShopEarnShell: drop flex-1 once settled on /earn so the shell can
  // shrink to EarnPage content height. Kept as flex-1 during the slide so the
  // dual-panel layout has a height to flex against.
  const [settled, setSettled] = useState(true)
  const skipFirst = useRef(true)
  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettled(false)
    const t = setTimeout(() => setSettled(true), SLIDE_MS)
    return () => clearTimeout(t)
  }, [isEarn])

  const collapsed = settled && isEarn

  return (
    <div
      key={transitionKey(pathname)}
      className={`flex flex-col min-h-0 animate-page-rise motion-reduce:animate-none ${collapsed ? '' : 'flex-1'}`}
    >
      {children}
    </div>
  )
}

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
  // dual-panel layout has a height to flex against. Comparing against a ref of
  // the previous pathname (rather than a skipFirst flag) keeps initial mounts
  // animation-free under React 19 StrictMode, where refs persist across the
  // simulated remount and a skipFirst guard would misfire on the second pass.
  const [settled, setSettled] = useState(true)
  const prevPath = useRef(pathname)
  useEffect(() => {
    if (prevPath.current === pathname) return
    prevPath.current = pathname
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettled(false)
    const t = setTimeout(() => setSettled(true), SLIDE_MS)
    return () => clearTimeout(t)
  }, [pathname])

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

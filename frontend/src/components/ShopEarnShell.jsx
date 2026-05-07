import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import BuyEarnTabs from './BuyEarnTabs.jsx'
import ShopPage from '../pages/ShopPage.jsx'
import EarnPage from '../pages/EarnPage.jsx'

const SLIDE_MS = 500

export default function ShopEarnShell({ cart, onIncrement, onDecrement }) {
  const { pathname } = useLocation()
  const isEarn = pathname === '/earn'

  // While the slide animation is running we keep the viewport-bounded layout
  // (flex-1 + h-full chain) so both panels render side-by-side at equal height.
  // Once settled on /earn we drop those constraints and hide the inactive Shop
  // panel from layout — letting the shell collapse to EarnPage's content height
  // so the footer rises to sit just under the cookie clicker.
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
    <main className={`flex flex-col min-h-0 ${collapsed ? '' : 'flex-1'}`}>
      <BuyEarnTabs />
      <div className={`overflow-hidden min-h-0 ${collapsed ? '' : 'flex-1'}`}>
        <div
          className={`flex w-[200%] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${collapsed ? '' : 'h-full'}`}
          style={{ transform: isEarn ? 'translateX(-50%)' : 'translateX(0%)' }}
        >
          <Panel inactive={isEarn} removed={collapsed} fillHeight={!collapsed}>
            <ShopPage cart={cart} onIncrement={onIncrement} onDecrement={onDecrement} />
          </Panel>
          <Panel inactive={!isEarn} fillHeight={!collapsed}>
            <EarnPage />
          </Panel>
        </div>
      </div>
    </main>
  )
}

function Panel({ inactive, removed = false, fillHeight, children }) {
  // `removed` collapses the inactive Shop panel's *height* to 0 once settled on
  // /earn so the shell can shrink to EarnPage's content height. We deliberately
  // keep its width (w-1/2) in the flex row — dropping it from layout entirely
  // (e.g. `display:none`) breaks the parent's translateX(-50%) math and shifts
  // the Earn panel off-screen.
  const overflow = removed ? 'overflow-hidden' : 'overflow-y-auto'
  const height = removed ? 'h-0' : fillHeight ? 'h-full' : ''
  return (
    <div
      className={`w-1/2 ${overflow} ${height} ${inactive ? 'pointer-events-none' : ''}`}
      aria-hidden={inactive}
      inert={inactive}
    >
      {children}
    </div>
  )
}

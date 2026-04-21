import { useLocation } from 'react-router-dom'
import BuyEarnTabs from './BuyEarnTabs.jsx'
import ShopPage from '../pages/ShopPage.jsx'
import EarnPage from '../pages/EarnPage.jsx'

export default function ShopEarnShell({ cart, onIncrement, onDecrement }) {
  const { pathname } = useLocation()
  const isEarn = pathname === '/earn'

  return (
    <main className="flex flex-col flex-1 min-h-0">
      <BuyEarnTabs />
      <div className="flex-1 overflow-hidden min-h-0">
        <div
          className="flex h-full w-[200%] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ transform: isEarn ? 'translateX(-50%)' : 'translateX(0%)' }}
        >
          <Panel hidden={isEarn}>
            <ShopPage cart={cart} onIncrement={onIncrement} onDecrement={onDecrement} />
          </Panel>
          <Panel hidden={!isEarn}>
            <EarnPage />
          </Panel>
        </div>
      </div>
    </main>
  )
}

function Panel({ hidden, children }) {
  return (
    <div
      className={`w-1/2 h-full overflow-y-auto ${hidden ? 'pointer-events-none' : ''}`}
      aria-hidden={hidden}
      inert={hidden}
    >
      {children}
    </div>
  )
}

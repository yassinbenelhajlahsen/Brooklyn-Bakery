import { useLocation } from 'react-router-dom'

function transitionKey(pathname) {
  // Shop ('/') and Earn ('/earn') share ShopEarnShell, which runs its own
  // horizontal slide. Collapsing them to one key avoids a double animation.
  if (pathname === '/' || pathname === '/earn') return 'shop'
  return pathname
}

export default function PageTransition({ children }) {
  const { pathname } = useLocation()
  return (
    <div
      key={transitionKey(pathname)}
      className="flex flex-col flex-1 min-h-0 animate-page-rise motion-reduce:animate-none"
    >
      {children}
    </div>
  )
}

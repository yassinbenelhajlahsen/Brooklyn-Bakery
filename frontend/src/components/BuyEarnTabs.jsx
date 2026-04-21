import { NavLink, useLocation } from 'react-router-dom'

export default function BuyEarnTabs() {
  const { pathname } = useLocation()
  const isEarn = pathname === '/earn'

  return (
    <nav className="relative bg-cream border-b border-line">
      <div className="relative grid grid-cols-2 max-w-2xl mx-auto">
        <TabLink to="/" end label="Shop" caption="shop the counter" />
        <TabLink to="/earn" label="Earn" caption="click the cookie" />
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-0 h-px w-1/2 bg-accent transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ transform: `translateX(${isEarn ? '100%' : '0%'})` }}
        />
      </div>
    </nav>
  )
}

function TabLink({ to, end, label, caption }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex flex-col items-center gap-1 py-5 transition-colors duration-300 ${
          isActive ? 'text-ink' : 'text-muted hover:text-ink'
        }`
      }
    >
      <span className="font-display text-[2rem] leading-none tracking-tight">
        {label}
      </span>
      <span className="font-display italic text-xs tracking-[0.05em]">
        {caption}
      </span>
    </NavLink>
  )
}

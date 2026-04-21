import { useEffect, useMemo, useState } from 'react'
import BakedGoodCard from '../components/cards/BakedGoodCard.jsx'

const STATUS_CLS = "text-center text-muted py-12";

export default function HomePage({ category, cart, onIncrement, onDecrement }) {
  const [bakedGoods, setBakedGoods] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/products`)
        const data = await response.json()
        if (!cancelled) setBakedGoods(data.items)
      } catch (err) {
        if (cancelled) return
        console.error('error: ', err)
        setError('Failed to load products.')
      }
    })()
    return () => { cancelled = true }
  }, [])

  const visible = useMemo(
    () => category
      ? bakedGoods.filter((i) => i.type === category || i.type + 's' === category)
      : bakedGoods,
    [bakedGoods, category]
  )

  if (error) return <p className={STATUS_CLS}>{error}</p>
  if (!bakedGoods.length) return <p className={STATUS_CLS}>Loading…</p>

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-6">
      {visible.map((item) => (
        <BakedGoodCard
          key={item.id}
          item={item}
          qty={cart[item.id]?.qty ?? 0}
          onIncrement={() => onIncrement(item)}
          onDecrement={() => onDecrement(item)}
        />
      ))}
    </div>
  )
}

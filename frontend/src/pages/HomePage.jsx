import { useEffect, useState, useCallback } from 'react'
import BakedGoodCard from '../components/cards/BakedGoodCard.jsx'

export default function HomePage({ category, cart, onIncrement, onDecrement }) {
  const [bakedGoods, setBakedGoods] = useState([])
  const [error, setError] = useState(null)

  const loadBakedGoods = useCallback(async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/products`)
      const data = await response.json()
      setBakedGoods(data.items)
    } catch (err) {
      console.error('error: ', err)
      setError('Failed to load products.')
    }
  }, [])

  useEffect(() => {
    loadBakedGoods()
  }, [loadBakedGoods])

  const visible = category
    ? bakedGoods.filter((i) => i.type === category || i.type + 's' === category)
    : bakedGoods

  if (error) return <p className="status">{error}</p>
  if (!bakedGoods.length) return <p className="status">Loading…</p>

  return (
    <div className="product-grid">
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

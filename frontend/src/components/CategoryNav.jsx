export default function CategoryNav({ categories, active, onSelect }) {
  return (
    <nav className="category-nav">
      {categories.map((cat) => (
        <button
          key={cat}
          className={`category-btn ${active === cat ? 'is-active' : ''}`}
          onClick={() => onSelect(active === cat ? null : cat)}
        >
          {cat}
        </button>
      ))}
    </nav>
  )
}

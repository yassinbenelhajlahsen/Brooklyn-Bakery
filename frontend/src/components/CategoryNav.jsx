export default function CategoryNav({ categories, active, onSelect }) {
  return (
    <nav className="flex justify-center gap-4 px-8 py-4 bg-cream flex-wrap">


      {categories.map((cat) => {
        const isActive = active === cat;
        return (
          <button
            key={cat}
            className={`rounded-full border px-6 py-2 text-[15px] capitalize transition-all duration-150 ease-in-out ${
              isActive
                ? 'bg-accent border-accent text-white'
                : 'bg-transparent border-line text-ink hover:border-accent hover:text-accent'
            }`}
            onClick={() => onSelect(isActive ? null : cat)}
          >
            {cat}
          </button>
        );
      })}
    </nav>
  )
}

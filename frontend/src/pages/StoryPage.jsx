import { Link } from 'react-router-dom';

export default function StoryPage() {
  return (
    <main className="flex-1 p-8 max-w-2xl mx-auto max-sm:px-4">
      <h1
        className="font-display italic text-[48px] leading-[1.1] text-ink mb-2 max-sm:text-[36px]"
        style={{ fontVariationSettings: "'opsz' 48" }}
      >
        Our Story
      </h1>
      <p className="text-muted text-[14px] mb-10 tracking-wide uppercase font-medium">Brooklyn, NY · Est. 2025</p>

      <div className="space-y-8 text-ink leading-relaxed">
        <p>
          Brooklyn Bakery started the way most good things do — in a small kitchen, with no plan and too much flour. A few friends who couldn't agree on much found common ground in bread: how it should smell, how the crust should crack, how it should feel to tear a warm loaf with someone at the table.
        </p>

        <p>
          We opened our first counter in 2025. Word spread the old-fashioned way. Neighbors told neighbors. People started showing up on weekday mornings before work, then on Sundays with their kids. We kept baking.
        </p>

        <p>
          In 2026 we launched online ordering — not because we wanted to scale, but because people kept asking, and it felt wrong to say no. The points system came out of that too: a way to thank the people who kept coming back, in something other than a punch card.
        </p>

        <p>
          We're still a small operation. Everything is made fresh. Nothing comes from a box. That hasn't changed and it won't.
        </p>
      </div>

      <div className="mt-12 pt-8 border-t border-line flex flex-col sm:flex-row gap-4">
        <Link
          to="/"
          className="px-6 py-3 rounded-lg bg-accent text-white font-medium hover:opacity-90 transition text-center"
        >
          See what's fresh
        </Link>
        <Link
          to="/contact"
          className="px-6 py-3 rounded-lg border border-line text-ink hover:bg-cream transition text-center"
        >
          Get in touch
        </Link>
      </div>
    </main>
  );
}

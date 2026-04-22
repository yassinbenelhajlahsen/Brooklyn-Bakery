import { Link } from 'react-router-dom';

export default function AboutUsPage() {
  return (
    <main className="flex-1 p-8 max-w-4xl mx-auto max-sm:px-4">
      <h1 className="text-4xl font-heading font-bold text-ink mb-8">About Brooklyn Bakery</h1>

      <div className="space-y-8">
        <section className="bg-surface border border-line rounded-lg p-6">
          <h2 className="text-2xl font-heading font-bold text-ink mb-4">Who We Are</h2>
          <p className="text-ink leading-relaxed mb-4">
            Brooklyn Bakery is a passionate community dedicated to bringing fresh, delicious baked goods to your table. Since our founding, we've been committed to using premium ingredients and time-honored baking techniques to create products that bring joy to every bite.
          </p>
          <p className="text-ink leading-relaxed">
           Our bakery combines traditional craftsmanship with modern innovation, ensuring every loaf, pastry, and cake meets our high standards of quality and taste.
          </p>
        </section>

        <section className="bg-surface border border-line rounded-lg p-6">
          <h2 className="text-2xl font-heading font-bold text-ink mb-4">Our Mission</h2>
          <p className="text-ink leading-relaxed">
            To bring exceptional baked goods to communities everywhere, using only the finest ingredients and supporting local, sustainable practices. We believe that great food brings people together, and we're honored to be part of your celebrations, mornings, and everyday moments.
          </p>
        </section>

        <section className="bg-surface border border-line rounded-lg p-6">
          <h2 className="text-2xl font-heading font-bold text-ink mb-4">Why Choose Us?</h2>
          <ul className="space-y-3 text-ink">
            <li className="flex items-start gap-3">
              <span className="text-2xl">✨</span>
              <span><strong>Premium Quality:</strong> We use only the finest ingredients</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-2xl">🌱</span>
              <span><strong>Sustainable Sourcing:</strong> Supporting local farmers</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-2xl">👨‍🍳</span>
              <span><strong>Expert Craftsmanship:</strong> Baked fresh daily</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-2xl">❤️</span>
              <span><strong>Made with Love:</strong> Crafted for our community</span>
            </li>
          </ul>
        </section>

        {/* 🔥 NEW SECTION */}
        <section className="bg-accent/5 border border-line rounded-lg p-6 text-center">
          <h2 className="text-2xl font-heading font-bold text-ink mb-3">
            Want to learn more?
          </h2>

          <p className="text-ink mb-6">
            Discover how Brooklyn Bakery started and what drives us every day.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              to="/story"
              className="px-6 py-3 rounded-lg bg-accent text-white font-medium hover:opacity-90 transition"
            >
              Our Story
            </Link>

            <Link
              to="/"
              className="px-6 py-3 rounded-lg border border-line text-ink hover:bg-cream transition"
            >
              Start an Order
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
import { Link } from 'react-router-dom';

export default function StoryPage() {
  return (
    <main className="flex-1 p-8 max-w-4xl mx-auto max-sm:px-4">
      <h1 className="text-4xl font-heading font-bold text-ink mb-8">Our Story</h1>

      <div className="space-y-8">
        <section className="bg-surface border border-line rounded-lg p-6">
          <h3 className="text-xl font-heading font-bold text-ink mb-3">The Beginning</h3>
          <p className="text-ink leading-relaxed">
            Brooklyn Bakery started in a small kitchen in the heart of Brooklyn back in 2025. What began as a passion project between childhood friends has grown into a beloved community institution. Our founders, Group 1, spent countless hours perfecting their grandmother's secret recipes and creating new favorites that would become Brooklyn Bakery staples.
          </p>
        </section>

        <section className="bg-surface border border-line rounded-lg p-6">
          <h3 className="text-xl font-heading font-bold text-ink mb-3">Growing Together</h3>
          <p className="text-ink leading-relaxed mb-4">
            What started as cakes and croissants quickly expanded to a full-service bakery. Our neighbors became our regular customers, and their feedback helped us develop the diverse product line you see today. From rustic sourdough loaves to delicate French pastries, each item reflects our commitment to quality.
          </p>
          <p className="text-ink leading-relaxed">
            In 2026, we launched our online ordering to serve our growing community beyond Brooklyn. Today, we ship fresh baked goods across the country and serve thousands of customers annually.
          </p>
        </section>

        <section className="bg-surface border border-line rounded-lg p-6">
          <h3 className="text-xl font-heading font-bold text-ink mb-3">Our Values</h3>
          <div className="space-y-4">
            <div>
              <h4 className="font-bold text-ink mb-2">🤝 Community</h4>
              <p className="text-ink text-sm">
                We believe in supporting local businesses, employing people from our neighborhood, and giving back to the community that has supported us.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-ink mb-2">🌍 Sustainability</h4>
              <p className="text-ink text-sm">
                From biodegradable packaging to sourcing ingredients locally, we're committed to reducing our environmental impact.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-ink mb-2">📖 Tradition</h4>
              <p className="text-ink text-sm">
                We honor baking traditions passed down through generations while embracing innovation and new flavors.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-ink mb-2">✨ Excellence</h4>
              <p className="text-ink text-sm">
                Every single item that leaves our kitchen meets our high standards. Quality is never compromised.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-surface border border-line rounded-lg p-6">
          <h3 className="text-xl font-heading font-bold text-ink mb-3">Today & Beyond</h3>
          <p className="text-ink leading-relaxed">
            Today, Brooklyn Bakery is proud to be part of your daily lives. Whether it's a morning croissant, a celebration cake, or a comfort cookie, we're honored to create those special moments. As we continue to grow, we remain focused on our core values: quality, community, and the simple joy of fresh-baked goodness.
          </p>
        </section>

        <section className="bg-accent/5 border border-line rounded-lg p-6 text-center">
          <h2 className="text-2xl font-heading font-bold text-ink mb-3">
            Ready to taste our story?
          </h2>

          <p className="text-ink mb-6">
            From our first loaf to today, every bite carries our passion. Start your order or explore what we offer.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-6">
            <Link
              to="/"
              className="px-6 py-3 rounded-lg bg-accent text-white font-medium hover:opacity-90 transition"
            >
              Start an Order
            </Link>

            <Link
              to="/about"
              className="px-6 py-3 rounded-lg border border-line text-ink hover:bg-cream transition"
            >
              Learn More About Us
            </Link>
          </div>

          <p className="text-sm text-muted">
            Have a question?{" "}
            <Link to="/faq" className="text-accent font-medium hover:underline">
              Visit our FAQ
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}

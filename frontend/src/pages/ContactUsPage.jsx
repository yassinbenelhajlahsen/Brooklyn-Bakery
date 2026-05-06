import { useState } from 'react';

export default function ContactUsPage() {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    setFormData({ name: '', email: '', message: '' });
    setTimeout(() => setSubmitted(false), 5000);
  };

  return (
    <main className="flex-1 p-8 max-w-2xl mx-auto max-sm:px-4">
      <h1
        className="font-display italic text-[48px] leading-[1.1] text-ink mb-2 max-sm:text-[36px]"
        style={{ fontVariationSettings: "'opsz' 48" }}
      >
        Say Hello
      </h1>
      <p className="text-muted mb-10 leading-relaxed">
        Questions, feedback, custom orders — we read everything and reply within a day.
      </p>

      {submitted && (
        <div className="bg-cream border border-line rounded-lg px-5 py-4 mb-8 text-ink text-[14px]">
          Got it. We'll be in touch soon.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label htmlFor="name" className="block text-[13px] font-medium text-muted mb-1.5 uppercase tracking-wide">
              Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-2.5 border border-line rounded-lg text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
              placeholder="Your name"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-[13px] font-medium text-muted mb-1.5 uppercase tracking-wide">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-2.5 border border-line rounded-lg text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
              placeholder="you@example.com"
            />
          </div>
        </div>

        <div>
          <label htmlFor="message" className="block text-[13px] font-medium text-muted mb-1.5 uppercase tracking-wide">
            Message
          </label>
          <textarea
            id="message"
            name="message"
            value={formData.message}
            onChange={handleInputChange}
            required
            className="w-full px-4 py-2.5 border border-line rounded-lg text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition resize-none"
            rows="6"
            placeholder="What's on your mind?"
          />
        </div>

        <button
          type="submit"
          className="bg-accent text-white font-medium py-2.5 px-6 rounded-lg hover:opacity-90 transition"
        >
          Send message
        </button>
      </form>

      <div className="mt-12 pt-8 border-t border-line text-[14px] text-muted space-y-1">
        <p>123 Bakery Lane, Brooklyn, NY</p>
        <p>hello@brooklynbakery.com · (555) 123-4567</p>
        <p className="pt-1">Mon – Fri 6am – 8pm · Sat – Sun 7am – 6pm</p>
      </div>
    </main>
  );
}

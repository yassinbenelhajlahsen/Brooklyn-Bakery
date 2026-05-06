import { useState } from 'react';

export default function ContactUsPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    setFormData({ name: '', email: '', subject: '', message: '' });
    setTimeout(() => setSubmitted(false), 5000);
  };

  return (
    <main className="flex-1 p-8 max-w-4xl mx-auto max-sm:px-4">
      <h1 className="text-4xl font-heading font-bold text-ink mb-8">Contact Us</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Contact Information */}
        <div className="space-y-6">
          <div className="bg-surface border border-line rounded-lg p-6">
            <h3 className="text-xl font-heading font-bold text-ink mb-4">Get In Touch</h3>
            <div className="space-y-4 text-ink">
              <div className="flex items-start gap-3">
                <span className="text-2xl">📍</span>
                <div>
                  <p className="font-medium">Address</p>
                  <p className="text-sm text-gray-600">123 Bakery Lane, Brooklyn, NY</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl">📧</span>
                <div>
                  <p className="font-medium">Email</p>
                  <p className="text-sm text-gray-600">hello@brooklynbakery.com</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl">📞</span>
                <div>
                  <p className="font-medium">Phone</p>
                  <p className="text-sm text-gray-600">(555) 123-4567</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl">🕐</span>
                <div>
                  <p className="font-medium">Hours</p>
                  <p className="text-sm text-gray-600">Mon - Fri: 6am - 8pm</p>
                  <p className="text-sm text-gray-600">Sat - Sun: 7am - 6pm</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-accent text-white rounded-lg p-6">
            <h3 className="font-heading font-bold mb-3">Response Time</h3>
            <p className="text-sm mb-3">
              We typically respond to inquiries within 24 business hours.
            </p>
            <p className="text-sm">
              For urgent matters, please call us during business hours.
            </p>
          </div>
        </div>

        {/* Contact Form */}
        <div className="bg-surface border border-line rounded-lg p-6">
          <h3 className="text-xl font-heading font-bold text-ink mb-6">Send us a Message</h3>

          {submitted && (
            <div className="bg-green-100 text-green-800 p-4 rounded-lg mb-4">
              Thank you! We've received your message and will respond shortly.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-ink mb-2">
                Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2 border border-line rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="Your name"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-ink mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2 border border-line rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label htmlFor="subject" className="block text-sm font-medium text-ink mb-2">
                Subject
              </label>
              <input
                type="text"
                id="subject"
                name="subject"
                value={formData.subject}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2 border border-line rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="How can we help?"
              />
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-medium text-ink mb-2">
                Message
              </label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2 border border-line rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                rows="5"
                placeholder="Your message..."
              />
            </div>

            <button
              type="submit"
              className="w-full bg-accent text-white font-medium py-2 px-4 rounded-lg hover:opacity-90"
            >
              Send Message
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

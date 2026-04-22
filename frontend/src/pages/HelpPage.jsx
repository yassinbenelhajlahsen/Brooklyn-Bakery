import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.js';

export default function HelpPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <main className="flex-1 p-8 max-w-4xl mx-auto max-sm:px-4">
      <h1 className="text-4xl font-heading font-bold text-ink mb-8">How Can We Help You?</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        {/* Your Orders Section */}
        <div className="bg-surface border border-line rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-4xl">📦</span>
            <h2 className="text-2xl font-heading font-bold text-ink">Your Orders</h2>
          </div>
          <p className="text-ink mb-6 text-sm">
            Track your orders, view order history, and manage your purchases.
          </p>
          {user ? (
            <button
              onClick={() => navigate('/orders')}
              className="w-full bg-accent text-white font-medium py-2 px-4 rounded-lg hover:opacity-90"
            >
              View Orders
            </button>
          ) : (
            <p className="text-sm text-gray-600 italic">Sign in to view your orders</p>
          )}
        </div>

        {/* Your Account Section */}
        <div className="bg-surface border border-line rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-4xl">👤</span>
            <h2 className="text-2xl font-heading font-bold text-ink">Your Account</h2>
          </div>
          <p className="text-ink mb-6 text-sm">
            Manage your profile, addresses, and payment methods.
          </p>
          {user ? (
            <div className="space-y-2">
              <button
                onClick={() => navigate('/profile')}
                className="w-full bg-cream text-ink font-medium py-2 px-4 rounded-lg hover:bg-accent hover:text-white text-sm"
              >
                Edit Profile
              </button>
              <button
                onClick={() => navigate('/addresses')}
                className="w-full bg-cream text-ink font-medium py-2 px-4 rounded-lg hover:bg-accent hover:text-white text-sm"
              >
                Manage Addresses
              </button>
              <button
                onClick={() => navigate('/payment-methods')}
                className="w-full bg-cream text-ink font-medium py-2 px-4 rounded-lg hover:bg-accent hover:text-white text-sm"
              >
                Payment Methods
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-600 italic">Sign in to manage your account</p>
          )}
        </div>
      </div>

      {/* Help Categories */}
      <h2 className="text-3xl font-heading font-bold text-ink mb-6">Common Topics</h2>

      <div className="space-y-4 mb-12">
        <a
          href="/faq"
          className="block bg-surface border border-line rounded-lg p-6 hover:border-accent hover:shadow-md transition-all"
        >
          <h3 className="text-lg font-heading font-bold text-ink mb-2">❓ Frequently Asked Questions</h3>
          <p className="text-sm text-gray-600">
            Find answers to common questions about orders, shipping, returns, and more.
          </p>
        </a>

        <a
          href="/contact"
          className="block bg-surface border border-line rounded-lg p-6 hover:border-accent hover:shadow-md transition-all"
        >
          <h3 className="text-lg font-heading font-bold text-ink mb-2">💬 Contact Support</h3>
          <p className="text-sm text-gray-600">
            Send us a message and our support team will respond within 24 hours.
          </p>
        </a>

        <div className="bg-surface border border-line rounded-lg p-6">
          <h3 className="text-lg font-heading font-bold text-ink mb-2">📧 Email Support</h3>
          <p className="text-sm text-gray-600 mb-3">
            Reach out to our support team directly:
          </p>
          <a
            href="mailto:hello@brooklynbakery.com"
            className="text-accent font-medium hover:underline"
          >
            hello@brooklynbakery.com
          </a>
        </div>

        <div className="bg-surface border border-line rounded-lg p-6">
          <h3 className="text-lg font-heading font-bold text-ink mb-2">📞 Call Us</h3>
          <p className="text-sm text-gray-600 mb-3">
            Speak with our team by phone:
          </p>
          <a
            href="tel:5551234567"
            className="text-accent font-medium hover:underline"
          >
            (555) 123-4567
          </a>
          <p className="text-xs text-gray-600 mt-2">
            Mon - Fri: 6am - 8pm | Sat - Sun: 7am - 6pm
          </p>
        </div>
      </div>
    </main>
  );
}

import { useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth.js';
import { findBotAnswer } from './chatbotData.js';

const QUICK_ACTIONS = [
  { label: 'Checkout help', message: 'How do I checkout?' },
  { label: 'Earn points', message: 'How do I earn points?' },
  { label: 'Product info', message: 'What items do you sell?' },
  { label: 'Contact us', message: 'How do I contact support?' },
];

export default function ChatbotWidget({ cart = {} }) {
  const navigate = useNavigate();
  const { user, profile, openLogin } = useAuth();

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    {
      role: 'bot',
      text: 'Hi! I’m your Brooklyn Bakery assistant. I can help with items, points, checkout, reviews, account settings, and contact info.',
    },
  ]);

  const inputRef = useRef(null);

  const cartItems = Object.values(cart);
  const cartCount = cartItems.reduce((sum, entry) => sum + entry.qty, 0);
  const cartTotal = cartItems.reduce((sum, entry) => sum + entry.item.price * entry.qty, 0);

  const userSummary = useMemo(() => {
    if (!user) return 'You are not logged in.';
    return `You are logged in${profile?.balance != null ? ` with ${profile.balance} points` : ''}.`;
  }, [user, profile]);

  function openChat() {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function addBotMessage(text) {
    setMessages((current) => [...current, { role: 'bot', text }]);
  }

  function handleSend(customMessage) {
    const text = (customMessage ?? input).trim();
    if (!text) return;

    setMessages((current) => [...current, { role: 'user', text }]);
    setInput('');

    const lower = text.toLowerCase();

    setTimeout(() => {
      if (lower.includes('checkout')) {
        if (!user) {
          addBotMessage('You need to log in before checkout. I can open the login window for you.');
          return;
        }

        if (cartCount === 0) {
          addBotMessage('Your cart is empty. Add a bakery item first, then go to checkout.');
          return;
        }

        addBotMessage(
          `You have ${cartCount} item${cartCount === 1 ? '' : 's'} in your cart totaling ${cartTotal} points. Go to checkout when you are ready.`,
        );
        return;
      }

      if (lower.includes('cart')) {
        addBotMessage(
          cartCount > 0
            ? `You currently have ${cartCount} item${cartCount === 1 ? '' : 's'} in your cart totaling ${cartTotal} points.`
            : 'Your cart is currently empty. Browse the shop and add an item first.',
        );
        return;
      }

      if (lower.includes('balance') || lower.includes('points')) {
        addBotMessage(
          user
            ? `${userSummary} You can earn more points from the Earn page.`
            : 'You can earn and use points after logging in.',
        );
        return;
      }

      if (lower.includes('login') || lower.includes('sign in')) {
        addBotMessage('I can open the login window for you.');
        openLogin?.();
        return;
      }

      addBotMessage(findBotAnswer(text));
    }, 250);
  }

  function handleQuickAction(action) {
    handleSend(action.message);
  }

  function goTo(path, label) {
    navigate(path);
    setOpen(false);
    setMessages((current) => [
      ...current,
      { role: 'bot', text: `Opening ${label}.` },
    ]);
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={openChat}
          className={clsx(
            'fixed bottom-5 right-5 z-50 h-14 w-14 rounded-full',
            'bg-accent text-white shadow-card grid place-items-center',
            'transition hover:bg-accent-dark hover:-translate-y-0.5',
            'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
          )}
          aria-label="Open bakery assistant"
        >
          <ChatIcon className="h-6 w-6" />
        </button>
      )}

      {open && (
        <section
          className={clsx(
            'fixed bottom-5 right-5 z-50 w-[380px] max-w-[calc(100vw-2rem)]',
            'rounded-2xl border border-line bg-surface shadow-card overflow-hidden',
          )}
          aria-label="Bakery assistant chat"
        >
          <header className="flex items-center justify-between gap-3 border-b border-line bg-cream/50 px-4 py-3">
            <div>
              <h2 className="m-0 font-display text-[20px] text-ink">
                Bakery Assistant
              </h2>
              <p className="m-0 text-xs text-muted">
                Products, checkout, account help
              </p>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-8 w-8 rounded-full border border-line bg-surface text-muted hover:text-ink hover:border-accent"
              aria-label="Close assistant"
            >
              ×
            </button>
          </header>

          <div className="max-h-[420px] overflow-y-auto px-4 py-4">
            <div className="space-y-3">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={clsx(
                    'flex',
                    message.role === 'user' ? 'justify-end' : 'justify-start',
                  )}
                >
                  <div
                    className={clsx(
                      'max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-5',
                      message.role === 'user'
                        ? 'bg-accent text-white'
                        : 'bg-cream text-ink border border-line',
                    )}
                  >
                    {message.text}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => handleQuickAction(action)}
                  className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink hover:border-accent hover:text-accent"
                >
                  {action.label}
                </button>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => goTo('/', 'Shop')}
                className="rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink hover:border-accent hover:text-accent"
              >
                Browse shop
              </button>

              <button
                type="button"
                onClick={() => goTo('/checkout', 'Checkout')}
                className="rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink hover:border-accent hover:text-accent"
              >
                Go checkout
              </button>

              <button
                type="button"
                onClick={() => goTo('/profile', 'Profile')}
                className="rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink hover:border-accent hover:text-accent"
              >
                Profile
              </button>

              <button
                type="button"
                onClick={() => goTo('/earn', 'Earn')}
                className="rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink hover:border-accent hover:text-accent"
              >
                Earn points
              </button>
            </div>
          </div>

          <form
            className="flex gap-2 border-t border-line p-3"
            onSubmit={(event) => {
              event.preventDefault();
              handleSend();
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about checkout, items, points…"
              className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />

            <button
              type="submit"
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-50"
              disabled={!input.trim()}
            >
              Send
            </button>
          </form>
        </section>
      )}
    </>
  );
}

function ChatIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a8.5 8.5 0 0 1-8.5 8.5 9.4 9.4 0 0 1-3.7-.8L3 21l1.4-5.3A8.4 8.4 0 0 1 3 12a8.5 8.5 0 0 1 18 0Z" />
      <path d="M8 11h8" />
      <path d="M8 15h5" />
    </svg>
  );
}

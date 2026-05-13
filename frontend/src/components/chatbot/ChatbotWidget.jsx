import { useEffect, useMemo, useRef, useState } from 'react';
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

const BOT_REPLY_MS = 280;

const LIVE_CART_RE = /\b(my cart|in my cart|cart contents|what'?s in my cart)\b/i;
const LIVE_BALANCE_RE = /\b(my (balance|points)|how many points)\b/i;
const START_CHECKOUT_RE = /\b(checkout now|i want to checkout|ready to checkout|place( the)? order|let'?s checkout)\b/i;
const OPEN_LOGIN_RE = /\b(open|show) (the )?(login|sign[- ]?in)\b|\blog me in\b|\bsign me in\b/i;

export default function ChatbotWidget({ cart = {} }) {
  const navigate = useNavigate();
  const { user, profile, openLogin } = useAuth();

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    {
      id: makeId(),
      role: 'bot',
      text: "Hi! I'm your Brooklyn Bakery assistant. I can help with items, points, checkout, reviews, account settings, and contact info.",
    },
  ]);

  const inputRef = useRef(null);
  const scrollerRef = useRef(null);
  const cartRef = useRef(cart);

  useEffect(() => { cartRef.current = cart; }, [cart]);

  useEffect(() => {
    if (!open) return;
    const focusId = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(focusId);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  const userSummary = useMemo(() => {
    if (!user) return 'You are not logged in.';
    return `You are logged in${profile?.balance != null ? ` with ${profile.balance} points` : ''}.`;
  }, [user, profile]);

  function openChat() {
    setOpen(true);
  }

  function closeChat() {
    setOpen(false);
  }

  function addBotMessage(text) {
    setMessages((current) => [...current, { id: makeId(), role: 'bot', text }]);
  }

  function liveCart() {
    const items = Object.values(cartRef.current ?? {});
    const count = items.reduce((sum, entry) => sum + entry.qty, 0);
    const total = items.reduce((sum, entry) => sum + entry.item.price * entry.qty, 0);
    return { count, total };
  }

  function handleSend(customMessage) {
    const text = (customMessage ?? input).trim();
    if (!text) return;

    setMessages((current) => [...current, { id: makeId(), role: 'user', text }]);
    setInput('');

    setTimeout(() => {
      if (LIVE_CART_RE.test(text)) {
        const { count, total } = liveCart();
        addBotMessage(
          count > 0
            ? `You currently have ${count} item${count === 1 ? '' : 's'} in your cart totaling ${total} points.`
            : 'Your cart is currently empty. Browse the shop and add an item first.',
        );
        return;
      }

      if (LIVE_BALANCE_RE.test(text)) {
        addBotMessage(
          user
            ? `${userSummary} You can earn more points from the Earn page.`
            : 'Once you log in I can show your balance. You can earn and spend points after logging in.',
        );
        return;
      }

      if (START_CHECKOUT_RE.test(text)) {
        if (!user) {
          addBotMessage('You need to log in before checkout. I can open the login window for you.');
          return;
        }
        const { count, total } = liveCart();
        if (count === 0) {
          addBotMessage('Your cart is empty. Add a bakery item first, then go to checkout.');
          return;
        }
        addBotMessage(
          `You have ${count} item${count === 1 ? '' : 's'} in your cart totaling ${total} points. Go to checkout when you are ready.`,
        );
        return;
      }

      if (OPEN_LOGIN_RE.test(text)) {
        addBotMessage('Opening the login window.');
        openLogin?.();
        return;
      }

      addBotMessage(findBotAnswer(text));
    }, BOT_REPLY_MS);
  }

  function handleQuickAction(action) {
    handleSend(action.message);
  }

  function goTo(path, label) {
    addBotMessage(`Opening ${label}.`);
    setTimeout(() => {
      navigate(path);
      closeChat();
    }, 120);
  }

  return (
    <>
      <button
        type="button"
        onClick={openChat}
        className={clsx(
          'fixed bottom-5 right-5 z-50 h-14 w-14 rounded-full',
          'bg-accent text-white shadow-card grid place-items-center',
          'transition duration-200 ease-out hover:bg-accent-dark hover:-translate-y-0.5',
          'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
          open ? 'pointer-events-none scale-90 opacity-0' : 'scale-100 opacity-100',
        )}
        aria-label="Open bakery assistant"
        aria-hidden={open}
        tabIndex={open ? -1 : 0}
      >
        <ChatIcon className="h-6 w-6" />
      </button>

      <section
        className={clsx(
          'fixed bottom-5 right-5 z-50 w-[380px] max-w-[calc(100vw-2rem)]',
          'rounded-2xl border border-line bg-surface shadow-card overflow-hidden',
          'origin-bottom-right transition duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
          'motion-reduce:transition-none',
          open
            ? 'opacity-100 translate-y-0 scale-100'
            : 'opacity-0 translate-y-3 scale-95 pointer-events-none',
        )}
        aria-label="Bakery assistant chat"
        aria-hidden={!open}
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
              onClick={closeChat}
              className="h-8 w-8 rounded-full border border-line bg-surface text-muted hover:text-ink hover:border-accent transition-colors"
              aria-label="Close assistant"
            >
              ×
            </button>
          </header>

          <div
            ref={scrollerRef}
            className="max-h-[420px] overflow-y-auto px-4 py-4"
          >
            <ul
              role="log"
              aria-live="polite"
              aria-relevant="additions"
              className="m-0 list-none space-y-3 p-0"
            >
              {messages.map((message) => (
                <li
                  key={message.id}
                  className={clsx(
                    'flex animate-chat-pop motion-reduce:animate-none',
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
                </li>
              ))}
            </ul>

            <div className="mt-4 flex flex-wrap gap-2">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => handleQuickAction(action)}
                  className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink transition hover:border-accent hover:text-accent"
                >
                  {action.label}
                </button>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => goTo('/', 'Shop')}
                className="rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink transition hover:border-accent hover:text-accent"
              >
                Browse shop
              </button>

              <button
                type="button"
                onClick={() => goTo('/checkout', 'Checkout')}
                className="rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink transition hover:border-accent hover:text-accent"
              >
                Go checkout
              </button>

              <button
                type="button"
                onClick={() => goTo('/profile', 'Profile')}
                className="rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink transition hover:border-accent hover:text-accent"
              >
                Profile
              </button>

              <button
                type="button"
                onClick={() => goTo('/earn', 'Earn')}
                className="rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink transition hover:border-accent hover:text-accent"
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
              className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            />

            <button
              type="submit"
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-dark disabled:opacity-50"
              disabled={!input.trim()}
            >
              Send
            </button>
          </form>
        </section>
    </>
  );
}

let idCounter = 0;
function makeId() {
  idCounter += 1;
  return `m_${idCounter}`;
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

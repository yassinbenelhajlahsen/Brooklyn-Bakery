export const FAQS = [
  {
    keywords: ['items', 'item', 'products', 'product', 'sell', 'menu', 'catalog', 'bakery', 'treats', 'cookies', 'goods', 'shop'],
    answer:
      'We sell a rotating selection of Brooklyn-baked treats — cookies, pastries, and seasonal specials. Browse the full catalog on the shop page, or open any item to see details and reviews.',
  },
  {
    keywords: ['checkout', 'order', 'buy', 'purchase'],
    answer:
      'To checkout, add items to your cart, open the cart, then continue to checkout. You will need enough points and a saved address before placing the order.',
  },
  {
    keywords: ['cart', 'quantity', 'qty', 'remove'],
    answer:
      'You can add items from the catalog or a product page. In the cart or checkout page, you can increase, decrease, or remove items before placing your order.',
  },
  {
    keywords: ['points', 'point', 'balance', 'earn', 'clicker'],
    answer:
      'Your balance is shown in the account menu and profile page. You can earn more points from the Earn page (cookie clicker), then spend them on bakery orders.',
  },
  {
    keywords: ['review', 'rating', 'star', 'stars', 'feedback'],
    answer:
      'You can write a review from any product page. Scroll to the reviews section, choose a rating, and submit your feedback.',
  },
  {
    keywords: ['address', 'shipping', 'delivery', 'ship'],
    answer:
      'You can manage saved addresses from the Profile page. During checkout, pick the address you want to use for the order.',
  },
  {
    keywords: ['contact', 'support', 'help', 'phone', 'reach'],
    answer:
      'You can reach Brooklyn Bakery through the Contact page in the footer.',
  },
  {
    keywords: ['wishlist', 'favorite', 'favourite', 'save', 'saved'],
    answer:
      'Click the wishlist heart on any product page to save it. You can view and manage saved items from the Wishlist page.',
  },
  {
    keywords: ['account', 'profile', 'photo', 'name', 'email', 'password', 'security'],
    answer:
      'You can update your profile photo, display name, email, addresses, and security settings from the Profile page.',
  },
];

const WORD_RE = /[a-z0-9]+/g;

function tokenize(text) {
  return new Set((text.toLowerCase().match(WORD_RE) ?? []));
}

export function findBotAnswer(message) {
  const tokens = tokenize(message);
  if (tokens.size === 0) return defaultAnswer();

  let best = null;
  let bestScore = 0;
  for (const faq of FAQS) {
    let score = 0;
    for (const keyword of faq.keywords) {
      if (tokens.has(keyword)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = faq;
    }
  }
  return best ? best.answer : defaultAnswer();
}

function defaultAnswer() {
  return 'I can help with products, points, checkout, reviews, addresses, wishlist, account settings, and contact info. Try asking: "What items do you sell?" or "How do I earn points?"';
}

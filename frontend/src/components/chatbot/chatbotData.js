export const FAQS = [
  {
    keywords: ['checkout', 'place order', 'buy', 'purchase'],
    answer:
      'To checkout, add items to your cart, click the cart icon, then continue to checkout. You will need enough points and a saved address before placing the order.',
  },
  {
    keywords: ['cart', 'add to cart', 'remove item', 'quantity'],
    answer:
      'You can add items from the catalog or product detail page. In the cart or checkout page, you can increase, decrease, or remove items before placing your order.',
  },
  {
    keywords: ['points', 'balance', 'earn', 'cookie clicker'],
    answer:
      'Your balance is shown in your account menu and profile page. You can earn more points from the Earn page, then use those points to place bakery orders.',
  },
  {
    keywords: ['review', 'rating', 'stars'],
    answer:
      'You can write a review from the product detail page. Open any item, scroll to the reviews section, choose a rating, and submit your feedback.',
  },
  {
    keywords: ['address', 'shipping', 'delivery'],
    answer:
      'You can manage your saved addresses from the Profile page. During checkout, choose the address you want to use for the order.',
  },
  {
    keywords: ['contact', 'support', 'help', 'phone', 'email'],
    answer:
      'You can contact Brooklyn Bakery through the Contact section.',
  },
  {
    keywords: ['wishlist', 'save item', 'favorite'],
    answer:
      'You can save products to your wishlist from the product detail page by clicking the wishlist button.',
  },
  {
    keywords: ['account', 'profile', 'photo', 'display name', 'email'],
    answer:
      'You can update your profile photo, display name, email, addresses, and security settings from the Profile page.',
  },
];

export function findBotAnswer(message) {
  const normalized = message.toLowerCase();

  const match = FAQS.find((item) =>
    item.keywords.some((keyword) => normalized.includes(keyword)),
  );

  if (match) return match.answer;

  return "I can help with products, points, checkout, reviews, addresses, wishlist, account settings, and contact information. Try asking: “How do I checkout?” or “How do I earn points?”";
}

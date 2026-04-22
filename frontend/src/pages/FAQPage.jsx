import { useState } from 'react';

const faqs = [
  {
    id: 1,
    question: 'How long does shipping take?',
    answer: 'We offer standard shipping (5-7 business days) and express shipping (2-3 business days). All items are carefully packaged to maintain freshness during transit.'
  },
  {
    id: 2,
    question: 'Are your products suitable for dietary restrictions?',
    answer: 'We offer several options including vegan and gluten-free items. Please check individual product descriptions for allergen information. Contact us for special dietary requests.'
  },
  {
    id: 3,
    question: 'Can I customize my order?',
    answer: 'Yes! We offer custom cakes and special orders. Please contact us at hello@brooklynbakery.com or call (555) 123-4567 to discuss your specific needs.'
  },
  {
    id: 4,
    question: 'What is your return/refund policy?',
    answer: 'We stand by the quality of our products. If you receive damaged items, please contact us within 24 hours with photos. We\'ll arrange replacement or refund immediately.'
  },
  {
    id: 5,
    question: 'How do you ensure freshness?',
    answer: 'All our products are baked fresh to order. We use premium ingredients and ship items immediately after baking to ensure maximum freshness.'
  },
  {
    id: 6,
    question: 'Do you offer wholesale or bulk orders?',
    answer: 'Absolutely! We serve businesses and events. For bulk orders, please contact us directly to discuss pricing and availability.'
  },
  {
    id: 7,
    question: 'How can I store baked goods to keep them fresh?',
    answer: 'Most baked goods can be stored at room temperature in an airtight container for 2-3 days, or frozen for up to 3 months. Detailed storage instructions are included with each order.'
  },
  {
    id: 8,
    question: 'Do you offer gift cards?',
    answer: 'Yes! Gift cards are available in denominations from $25 to $250. They can be purchased directly from our website or in our physical location.'
  },
];

export default function FAQPage() {
  const [openId, setOpenId] = useState(null);

  const toggleFAQ = (id) => {
    setOpenId(openId === id ? null : id);
  };

  return (
    <main className="flex-1 p-8 max-w-4xl mx-auto max-sm:px-4">
      <h1 className="text-4xl font-heading font-bold text-ink mb-4">Frequently Asked Questions</h1>
      <p className="text-ink text-lg mb-8">Find answers to common questions about our products and services.</p>

      <div className="space-y-4">
        {faqs.map((faq) => (
          <div key={faq.id} className="bg-surface border border-line rounded-lg">
            <button
              onClick={() => toggleFAQ(faq.id)}
              className="w-full px-6 py-4 flex justify-between items-center hover:bg-cream transition-colors"
            >
              <h3 className="text-lg font-medium text-ink text-left">{faq.question}</h3>
              <span className={`text-2xl text-accent transition-transform ${openId === faq.id ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>

            {openId === faq.id && (
              <div className="px-6 pb-4 border-t border-line pt-4">
                <p className="text-ink leading-relaxed">{faq.answer}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-12 bg-accent text-white rounded-lg p-8 text-center">
        <h3 className="text-2xl font-heading font-bold mb-3">Didn't find your answer?</h3>
        <p className="mb-6">
          Our customer service team is here to help. Feel free to contact us anytime.
        </p>
        <a
          href="/contact"
          className="inline-block bg-white text-accent font-medium py-2 px-6 rounded-lg hover:opacity-90"
        >
          Contact Us
        </a>
      </div>
    </main>
  );
}

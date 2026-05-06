import { useState } from 'react';

const faqs = [
  {
    id: 1,
    question: 'How does the points system work?',
    answer: 'Every item in the shop is priced in points. You earn points by using the Earn tab — spend them on anything in the shop. Your balance is always visible when you\'re signed in.',
  },
  {
    id: 2,
    question: 'Is everything baked fresh?',
    answer: 'Yes. Nothing sits. We bake daily and only list items that are available that day. If something sells out, it\'s gone until the next batch.',
  },
  {
    id: 3,
    question: 'Can I place a custom or bulk order?',
    answer: 'For custom cakes, large event orders, or anything not on the menu, reach out directly at hello@brooklynbakery.com. We handle those on a case-by-case basis.',
  },
  {
    id: 4,
    question: 'Do you accommodate dietary restrictions?',
    answer: 'Some items are vegan or gluten-free — check the product page for details. If you have a serious allergy, please contact us before ordering so we can give you accurate info.',
  },
  {
    id: 5,
    question: 'What if something arrives damaged or wrong?',
    answer: 'Let us know within 24 hours at hello@brooklynbakery.com with a photo. We\'ll make it right.',
  },
  {
    id: 6,
    question: 'How do I update my delivery address?',
    answer: 'You can manage your saved addresses from your Profile page. Changes apply to future orders only.',
  },
];

export default function FAQPage() {
  const [openId, setOpenId] = useState(null);

  return (
    <main className="flex-1 p-8 max-w-2xl mx-auto max-sm:px-4">
      <h1
        className="font-display italic text-[48px] leading-[1.1] text-ink mb-2 max-sm:text-[36px]"
        style={{ fontVariationSettings: "'opsz' 48" }}
      >
        FAQ
      </h1>
      <p className="text-muted mb-10 leading-relaxed">
        Common questions. If yours isn't here, just ask.
      </p>

      <div className="divide-y divide-line border-t border-b border-line">
        {faqs.map((faq) => (
          <div key={faq.id}>
            <button
              onClick={() => setOpenId(openId === faq.id ? null : faq.id)}
              className="w-full flex justify-between items-center py-5 text-left gap-4 group"
            >
              <span className="text-ink font-medium group-hover:text-accent transition-colors">
                {faq.question}
              </span>
              <span className={`text-muted text-[18px] transition-transform shrink-0 ${openId === faq.id ? 'rotate-45' : ''}`}>
                +
              </span>
            </button>
            {openId === faq.id && (
              <p className="text-muted leading-relaxed pb-5 text-[15px]">
                {faq.answer}
              </p>
            )}
          </div>
        ))}
      </div>

      <p className="mt-10 text-[14px] text-muted">
        Still have questions?{' '}
        <a href="/contact" className="text-accent hover:underline">
          Contact us
        </a>
        .
      </p>
    </main>
  );
}

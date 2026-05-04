## Missing from Tier 1:
- [x] Product search by name — no search bar in the UI and no backend ?search= query param. This is a core tier 1 requirement.
- [x] "Sort by newest arrivals" — you have price and top-rated, but not newest (by createdAt).

## Missing from Tier 2:
- [x] Re-order button — order history page exists but there's no "re-order with one click" action (no frontend button, no backend endpoint).
- [ ] User profile page — the profile menu item navigates nowhere. There's a /me endpoint but no page to view/edit display name, etc.

## Missing from Tier 3:
- [ ] Toast notifications — no library installed; wire to cart/checkout/order actions
- [ ] Catch-all 404 route — no `<Route path="*" />` for undefined routes
- [ ] OAuth login — no Google/GitHub/Apple provider (Supabase supports it, needs UI)
- [ ] Out-of-stock subscription — no way to notify users when a product is restocked
- [ ] Customer support chatbot
- [ ] Pagination — all products load at once, no page-based or infinite scroll
- [ ] Wishlist / favorites
- [ ] Product comparison
- [ ] Promo codes / discounts
- [ ] Admin: flag or delete inappropriate reviews
- [ ] Admin: site-wide announcement banner
- [ ] Admin: CSV/PDF export of orders and users

## Missing from Tier 4:
- [ ] KPI dashboard — no charts or sales-over-time analytics in admin
- [ ] Product recommendations / "customers also bought"
- [ ] Social media sharing on product pages
- [ ] i18n / l10n — all UI text hardcoded in English
- [ ] CI/CD pipeline — no GitHub Actions, Dockerfile, or docker-compose
- [ ] Performance monitoring / error tracking (e.g. Sentry)
- [ ] Multi-tenancy

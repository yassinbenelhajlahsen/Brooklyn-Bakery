import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="bg-ink text-cream p-8">
      <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-8 text-[14px] text-center">
        <div>
          <h2 className="text-cream mb-2">Contact</h2>
          <p className="text-[#d9c8b4] my-1">123 Bakery Lane, Brooklyn, NY</p>
          <p className="text-[#d9c8b4] my-1">hello@brooklynbakery.com</p>
          <p className="text-[#d9c8b4] my-1">(555) 123-4567</p>
        </div>
        <div>
          <h2 className="text-cream mb-2">Links</h2>
          <ul className="space-y-1">
            <li><Link to="/story" className="text-[#d9c8b4] hover:text-cream transition-colors">Our Story</Link></li>
            <li><Link to="/contact" className="text-[#d9c8b4] hover:text-cream transition-colors">Contact Us</Link></li>
            <li><Link to="/faq" className="text-[#d9c8b4] hover:text-cream transition-colors">FAQ</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  )
}

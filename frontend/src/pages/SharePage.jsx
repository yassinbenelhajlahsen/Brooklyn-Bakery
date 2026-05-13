import shareQr from '../assets/share-qr.png'

export default function SharePage() {
  return (
    <div className="max-w-lg mx-auto py-6 px-4 max-sm:py-4">
      <h1
        className="font-display italic text-[48px] leading-[1.1] text-ink mb-2 max-sm:text-[36px] text-center"
        style={{ fontVariationSettings: "'opsz' 48" }}
      >
        Share
      </h1>
      <p className="text-muted text-[14px] mb-10 tracking-wide uppercase font-medium text-center">
        Scan to visit
      </p>

      <figure className="flex flex-col items-center gap-6">
        <div
          className="w-full max-w-[260px] rounded-2xl border border-line bg-surface p-2.5 sm:p-3 shadow-card"
          role="presentation"
        >
          <img
            src={shareQr}
            alt="QR code to open Brooklyn Bakery on your phone"
            className="mx-auto block w-full rounded-lg"
            width={526}
            height={528}
            decoding="async"
          />
        </div>
        <figcaption className="font-display italic text-xl sm:text-2xl text-ink text-center tracking-tight">
          Share with friends
        </figcaption>
      </figure>
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const ANIM_MS = 250;

function renderSlot(slot, close) {
  if (slot == null) return null;
  return typeof slot === 'function' ? slot(close) : slot;
}

export default function Drawer({
  onClose,
  ariaLabel,
  width = 'w-120',
  header,
  footer,
  children,
}) {
  const [entered, setEntered] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const close = useCallback(() => {
    setLeaving(true);
    setTimeout(onClose, ANIM_MS);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close]);

  const visible = entered && !leaving;
  const rows = footer ? 'grid-rows-[auto_1fr_auto]' : 'grid-rows-[auto_1fr]';

  return createPortal(
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-250 ease-out ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={close}
        aria-hidden="true"
      />
      <aside
        className={`fixed top-0 right-0 bottom-0 ${width} max-w-full max-sm:w-full bg-surface border-l border-line shadow-[-12px_0_40px_rgba(61,47,36,0.12)] z-50 grid ${rows} overflow-hidden transition-transform duration-250 ease-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}
        role="dialog"
        aria-label={ariaLabel}
      >
        <div className="px-6 py-4 border-b border-line bg-cream/40 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0 flex-1">{renderSlot(header, close)}</div>
          <button
            type="button"
            onClick={close}
            aria-label="Close drawer"
            className="w-8 h-8 rounded-full hover:bg-line flex items-center justify-center text-muted hover:text-ink transition-colors text-xl leading-none shrink-0"
          >
            ×
          </button>
        </div>
        {renderSlot(children, close)}
        {footer ? renderSlot(footer, close) : null}
      </aside>
    </>,
    document.body
  );
}

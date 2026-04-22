import { useState } from 'react';

export default function ReasonPromptModal({
  open,
  title = 'Provide a reason',
  placeholder = 'Optional reason…',
  required = false,
  submitLabel = 'Submit',
  onSubmit,
  onClose,
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(null);

  // Early return unmounts the component when closed, which resets all state naturally.
  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (required && !trimmed) {
      setError('A reason is required.');
      return;
    }
    onSubmit(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <form
        className="bg-surface rounded-xl shadow-card w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2 className="text-lg font-display mb-3">{title}</h2>
        <textarea
          className="w-full border border-line rounded-md p-2 text-sm min-h-[96px] focus:outline-none focus:border-accent"
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        {error && <div className="text-danger text-sm mt-1">{error}</div>}
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm rounded border border-line hover:bg-cream">
            Cancel
          </button>
          <button type="submit" className="px-3 py-1.5 text-sm rounded bg-accent text-white hover:bg-accent-dark">
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

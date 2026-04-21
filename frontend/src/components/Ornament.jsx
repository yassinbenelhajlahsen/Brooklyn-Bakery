export default function Ornament({ className = '', ...rest }) {
  return (
    <div
      className={`flex items-center justify-center gap-2.5 mx-auto w-[120px] opacity-70 ${className}`}
      aria-hidden="true"
      {...rest}
    >
      <span className="flex-1 h-px bg-line" />
      <span className="w-1.5 h-1.5 bg-accent rotate-45 shrink-0" />
      <span className="flex-1 h-px bg-line" />
    </div>
  );
}

import clsx from 'clsx'

export default function Skeleton({ className = '', ...rest }) {
  return (
    <div
      aria-hidden="true"
      className={clsx(
        "rounded bg-line bg-[linear-gradient(100deg,transparent_30%,var(--color-cream)_50%,transparent_70%)]",
        "bg-[length:200%_100%] animate-shimmer",
        "motion-reduce:animate-none motion-reduce:bg-none",
        className,
      )}
      {...rest}
    />
  )
}

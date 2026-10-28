export function StarMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="antares-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff4d6" />
          <stop offset="35%" stopColor="#ffc94a" />
          <stop offset="70%" stopColor="#ff4d3d" />
          <stop offset="100%" stopColor="#ff4d3d" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill="url(#antares-core)" />
      <path d="M16 3 L17.6 14.4 L29 16 L17.6 17.6 L16 29 L14.4 17.6 L3 16 L14.4 14.4 Z" fill="#fff" opacity="0.9" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2 font-semibold tracking-wide">
      <StarMark />
      <span>
        ANTARES <span className="text-capella">A.I</span>
      </span>
    </span>
  );
}

export function Logo({ size = 34 }: { size?: number }) {
  return (
    <span className="logo">
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
        <rect x="4" y="14" width="56" height="46" rx="10" fill="#FF5A36" />
        <rect x="12" y="6" width="16" height="12" rx="4" fill="#FF7A5C" />
        <rect x="36" y="6" width="16" height="12" rx="4" fill="#FF7A5C" />
        <circle cx="23" cy="36" r="5" fill="#1D1B3A" />
        <circle cx="41" cy="36" r="5" fill="#1D1B3A" />
        <rect x="24" y="47" width="16" height="5" rx="2.5" fill="#1D1B3A" />
      </svg>
      <span className="logo-word">blockify</span>
    </span>
  );
}

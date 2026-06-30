interface AppLogoProps {
  size?: number;
  className?: string;
}

export function AppLogo({ size = 36, className = "" }: AppLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={className}
      style={{ animation: "breathe 5s ease-in-out infinite" }}
    >
      <polygon points="20,2 34,10.5 34,27.5 20,36 6,27.5 6,10.5" fill="#059669" />
      <line x1="13" y1="25" x2="20" y2="14" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="27" y1="25" x2="20" y2="14" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="13" y1="25" x2="27" y2="25" stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeLinecap="round" />
      <circle cx="13" cy="25" r="3" fill="rgba(255,255,255,0.7)" />
      <circle cx="27" cy="25" r="3" fill="rgba(255,255,255,0.7)" />
      <circle cx="20" cy="14" r="4" fill="white" />
      <circle cx="20" cy="14" r="1.8" fill="#059669" />
    </svg>
  );
}

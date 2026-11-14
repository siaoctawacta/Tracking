export function WhatsAppIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M19.05 4.91A9.82 9.82 0 0 0 12.04 2C6.6 2 2.17 6.43 2.17 11.87c0 1.74.46 3.44 1.32 4.93L2.08 22l5.33-1.4a9.86 9.86 0 0 0 4.63 1.18h.01c5.44 0 9.87-4.43 9.87-9.87 0-2.64-1.03-5.12-2.87-7Zm-7.01 15.2h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.16.83.84-3.08-.2-.32a8.17 8.17 0 0 1-1.25-4.34c0-4.52 3.68-8.2 8.21-8.2 2.19 0 4.25.86 5.8 2.41a8.15 8.15 0 0 1 2.4 5.8c0 4.53-3.68 8.21-8.2 8.21Zm4.5-6.15c-.25-.12-1.46-.72-1.69-.8-.23-.08-.39-.12-.56.12-.16.25-.64.8-.78.97-.14.16-.29.18-.54.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.23-1.46-1.37-1.7-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.15.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.42h-.48a.92.92 0 0 0-.66.31c-.23.25-.87.85-.87 2.07s.89 2.4 1.01 2.57c.12.16 1.75 2.67 4.24 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.46-.6 1.67-1.18.2-.58.2-1.07.14-1.18-.06-.1-.22-.16-.47-.29Z" />
    </svg>
  )
}

/** Kader Cargo airplane mark — same geometry as brand/kader-cargo-icon.svg. */
export function LogoMark({ className = 'size-9', inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="16" className={inverted ? 'fill-white' : 'fill-brand'} />
      <path d="M8 50.5C15 51 21 49.2 25.6 45.2" fill="none" className={inverted ? 'stroke-brand' : 'stroke-white'} strokeOpacity=".5" strokeWidth="2.6" strokeLinecap="round" />
      <path
        className={inverted ? 'fill-brand' : 'fill-white'}
        transform="rotate(45 34 30)"
        d="M34 8c2 0 3.2 2.6 3.2 5.4V24l15.3 8.6c.6.3.9.9.9 1.6v2.2l-16.2-4.6v10.6l4.6 3.6c.3.2.4.6.4.9v2l-7.2-2.2-7.2 2.2v-2c0-.3.2-.7.4-.9l4.6-3.6V31.8l-16.2 4.6v-2.2c0-.7.3-1.3.9-1.6L30.8 24V13.4C30.8 10.6 32 8 34 8z"
      />
    </svg>
  )
}

export function Logo({ light = false, tagline = false, compact = false }: { light?: boolean; tagline?: boolean; compact?: boolean }) {
  return (
    <span className={`inline-flex items-center ${compact ? 'gap-2' : 'gap-2.5'}`}>
      <LogoMark inverted={light} className={compact ? 'size-8' : 'size-9'} />
      <span className="leading-none">
        <span className={`block whitespace-nowrap font-display font-extrabold tracking-[0.06em] ${compact ? 'text-[16px]' : 'text-[19px]'} ${light ? 'text-white' : 'text-brand'}`}>KADER CARGO</span>
        {tagline && <span className={`mt-1 block text-[9px] font-bold tracking-[0.14em] ${light ? 'text-white/70' : 'text-muted'}`}>EXPRESS AIR CARGO</span>}
      </span>
    </span>
  )
}

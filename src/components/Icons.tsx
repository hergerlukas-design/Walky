interface IconProps {
  className?: string
}

const base = 'h-5 w-5'

export function MicIcon({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
      <path
        d="M5 11a7 7 0 0 0 14 0M12 18v3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function MicOffIcon({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 9V6a3 3 0 0 1 5.9-.7M15 12v2a3 3 0 0 1-4.4 2.6M5 11a7 7 0 0 0 10.3 6.2M19 11a7 7 0 0 1-.6 2.8M12 18v3M4 3l16 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function SpeakerIcon({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 9h3l4-3v12l-4-3H4z" fill="currentColor" />
      <path
        d="M15.5 9.5a3.5 3.5 0 0 1 0 5M18 7a7 7 0 0 1 0 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function SpeakerOffIcon({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 9h3l4-3v12l-4-3H4z" fill="currentColor" />
      <path d="M16 10l4 4M20 10l-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function LinkIcon({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M10 13a4 4 0 0 0 5.7.3l3-3a4 4 0 0 0-5.7-5.7l-1.3 1.3M14 11a4 4 0 0 0-5.7-.3l-3 3a4 4 0 0 0 5.7 5.7l1.3-1.3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function QrIcon({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <path d="M14 14h3v3h-3zM19 19h2v2h-2z" fill="currentColor" />
    </svg>
  )
}

export function LeaveIcon({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M15 5V4a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-1M10 12h11m0 0-3-3m3 3-3 3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function CheckIcon({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m5 13 4 4L19 7"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function WalkyLogo({ className = 'h-9 w-9' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="12" y="14" width="24" height="30" rx="5" fill="currentColor" opacity="0.18" />
      <rect
        x="12"
        y="14"
        width="24"
        height="30"
        rx="5"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <path d="M30 14V7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="17" y="20" width="14" height="8" rx="2" fill="currentColor" />
      <circle cx="20" cy="35" r="2" fill="currentColor" />
      <circle cx="28" cy="35" r="2" fill="currentColor" />
    </svg>
  )
}

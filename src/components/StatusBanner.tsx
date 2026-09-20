import type { ReactNode } from 'react'

export type BannerTone = 'info' | 'warn' | 'error'

const TONE_STYLES: Record<BannerTone, string> = {
  info: 'border-shell-600 bg-shell-800 text-shell-200',
  warn: 'border-signal-500/50 bg-signal-500/10 text-signal-400',
  error: 'border-alert-500/50 bg-alert-500/10 text-alert-400',
}

interface StatusBannerProps {
  tone: BannerTone
  children: ReactNode
  action?: { label: string; onClick(): void }
}

export function StatusBanner({ tone, children, action }: StatusBannerProps) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${TONE_STYLES[tone]}`}
    >
      <span className="min-w-0 flex-1">{children}</span>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="shrink-0 rounded-lg border border-current px-3 py-1.5 text-xs tracking-wide uppercase transition-opacity hover:opacity-80"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

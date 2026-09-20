import { usePushToTalk } from '../hooks/usePushToTalk'
import { useTranslations } from '../i18n'
import { MicIcon, MicOffIcon } from './Icons'

interface PushToTalkButtonProps {
  onChange(talking: boolean): void
  disabled: boolean
  disabledHint?: string
}

/**
 * Der eigentliche Funkknopf. Bewusst riesig und mit Pointer Capture: Der
 * Finger darf beim Sprechen verrutschen, ohne dass die Übertragung abbricht.
 */
export function PushToTalkButton({ onChange, disabled, disabledHint }: PushToTalkButtonProps) {
  const t = useTranslations()
  const { talking, locked, toggleLock, handlers } = usePushToTalk({ onChange, disabled })

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative flex h-56 w-56 items-center justify-center">
        {talking && (
          <span
            className="animate-ptt-pulse absolute inset-0 rounded-full bg-signal-500"
            aria-hidden="true"
          />
        )}

        <button
          type="button"
          {...handlers}
          disabled={disabled}
          aria-pressed={talking}
          aria-label={talking ? t.ptt.sendingAria : t.ptt.holdAria}
          className={[
            'relative z-10 flex h-52 w-52 select-none flex-col items-center justify-center gap-2',
            'rounded-full border-4 transition-[transform,background-color,border-color] duration-100',
            'touch-none disabled:cursor-not-allowed disabled:opacity-40',
            talking
              ? 'scale-95 border-signal-400 bg-signal-500 text-shell-950 shadow-[0_0_60px_-5px] shadow-signal-500'
              : 'border-shell-600 bg-shell-800 text-shell-200 active:scale-95 hover:border-shell-400',
          ].join(' ')}
        >
          {disabled ? <MicOffIcon className="h-14 w-14" /> : <MicIcon className="h-14 w-14" />}
          <span className="font-display text-sm tracking-[0.2em] uppercase">
            {talking ? t.ptt.sending : t.ptt.idle}
          </span>
        </button>
      </div>

      <div className="flex min-h-10 flex-col items-center gap-2">
        {disabled ? (
          <p className="max-w-xs text-center text-sm text-alert-400">{disabledHint}</p>
        ) : (
          <>
            <button
              type="button"
              onClick={toggleLock}
              aria-pressed={locked}
              className={[
                'rounded-full border px-4 py-2 text-xs tracking-wide uppercase transition-colors',
                locked
                  ? 'border-signal-400 bg-signal-500/15 text-signal-400'
                  : 'border-shell-600 text-shell-400 hover:border-shell-400 hover:text-shell-200',
              ].join(' ')}
            >
              {locked ? t.ptt.lockOff : t.ptt.lockOn}
            </button>
            <p className="text-center text-xs text-shell-400">{t.ptt.hint}</p>
          </>
        )}
      </div>
    </div>
  )
}

import { useTranslations } from '../i18n'
import type { PwaUpdateApi } from '../hooks/usePwaUpdate'

interface UpdateBannerProps {
  update: PwaUpdateApi
  /** Im Kanal kostet das Neuladen die laufende Verbindung. */
  inChannel: boolean
}

/**
 * Läuft im normalen Fluss mit und bleibt beim Scrollen oben kleben. Ein
 * überlagerndes `fixed` hatte den Seitenkopf verdeckt und dessen Knöpfe
 * unklickbar gemacht — der Platzgewinn wog das nicht auf.
 */
export function UpdateBanner({ update, inChannel }: UpdateBannerProps) {
  const t = useTranslations()

  if (!update.updateAvailable && !update.offlineReady) return null

  const isUpdate = update.updateAvailable

  return (
    <div
      role="status"
      aria-live="polite"
      className="safe-top sticky top-0 z-50 flex justify-center px-3 pb-2"
    >
      <div
        className={[
          'flex w-full max-w-md flex-wrap items-center gap-x-3 gap-y-2',
          'rounded-xl border px-4 py-3 text-sm shadow-lg shadow-shell-950/60 backdrop-blur',
          isUpdate
            ? 'border-signal-500/60 bg-shell-800/95 text-shell-200'
            : 'border-live-400/50 bg-shell-800/95 text-live-400',
        ].join(' ')}
      >
        <span className="min-w-0 flex-1">
          {isUpdate ? (
            <>
              {t.update.available}
              {inChannel && (
                <span className="mt-0.5 block text-xs text-shell-400">
                  {t.update.inChannelWarning}
                </span>
              )}
            </>
          ) : (
            t.update.offlineReady
          )}
        </span>

        {isUpdate && (
          <button
            type="button"
            onClick={update.applyUpdate}
            className="shrink-0 rounded-lg bg-signal-500 px-3 py-1.5 text-xs font-medium tracking-wide text-shell-950 uppercase transition-colors hover:bg-signal-400"
          >
            {t.update.reload}
          </button>
        )}

        <button
          type="button"
          onClick={update.dismiss}
          className="shrink-0 rounded-lg border border-shell-600 px-3 py-1.5 text-xs tracking-wide text-shell-400 uppercase transition-colors hover:border-shell-400 hover:text-shell-200"
        >
          {isUpdate ? t.update.later : t.update.dismiss}
        </button>
      </div>
    </div>
  )
}

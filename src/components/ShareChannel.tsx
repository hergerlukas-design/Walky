import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { channelUrl, formatChannelCode } from '../../shared/channelCode'
import { CheckIcon, LinkIcon, QrIcon } from './Icons'

interface ShareChannelProps {
  code: string
}

/**
 * Drei Wege in denselben Kanal: Code vorlesen, Link teilen, QR scannen.
 */
export function ShareChannel({ code }: ShareChannelProps) {
  const [showQr, setShowQr] = useState(false)
  const [copied, setCopied] = useState(false)
  const url = channelUrl(code, window.location.origin)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  const share = async () => {
    // Die native Teilen-Ansicht ist auf dem Handy der kürzeste Weg; sonst
    // landet der Link in der Zwischenablage.
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Walky-Kanal', text: `Kanal ${code}`, url })
        return
      } catch {
        /* abgebrochen — dann eben kopieren */
      }
    }

    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      window.prompt('Link kopieren:', url)
    }
  }

  return (
    <div className="w-full rounded-2xl border border-shell-700 bg-shell-800/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-xs tracking-[0.2em] text-shell-400 uppercase">
            Kanal
          </p>
          <p className="font-display text-2xl tracking-[0.3em] text-signal-400 uppercase">
            {formatChannelCode(code)}
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={share}
            className="flex items-center gap-2 rounded-lg border border-shell-600 px-3 py-2 text-sm text-shell-200 transition-colors hover:border-shell-400"
          >
            {copied ? <CheckIcon className="h-4 w-4 text-live-400" /> : <LinkIcon className="h-4 w-4" />}
            <span className="hidden sm:inline">{copied ? 'Kopiert' : 'Teilen'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowQr((value) => !value)}
            aria-expanded={showQr}
            aria-label="QR-Code anzeigen"
            className={[
              'rounded-lg border p-2 transition-colors',
              showQr
                ? 'border-signal-400 text-signal-400'
                : 'border-shell-600 text-shell-200 hover:border-shell-400',
            ].join(' ')}
          >
            <QrIcon />
          </button>
        </div>
      </div>

      {showQr && <QrPanel url={url} />}
    </div>
  )
}

function QrPanel({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    QRCode.toCanvas(canvas, url, {
      width: 220,
      margin: 1,
      color: { dark: '#0b0f14', light: '#f5f7fa' },
    }).catch(() => setError(true))
  }, [url])

  return (
    <div className="mt-4 flex flex-col items-center gap-3 border-t border-shell-700 pt-4">
      {error ? (
        <p className="text-sm text-alert-400">QR-Code konnte nicht erzeugt werden.</p>
      ) : (
        <canvas ref={canvasRef} className="rounded-lg bg-white p-2" aria-label="QR-Code zum Kanal" />
      )}
      <p className="text-center text-xs break-all text-shell-400">{url}</p>
    </div>
  )
}

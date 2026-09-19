import { useCallback, useMemo, useState } from 'react'
import { useChannelSession } from '../hooks/useChannelSession'
import { useOnline } from '../hooks/useOnline'
import { useWakeLock } from '../hooks/useWakeLock'
import { hasTurnServer } from '../lib/env'
import { ParticipantList } from './ParticipantList'
import { PushToTalkButton } from './PushToTalkButton'
import { RemoteAudio } from './RemoteAudio'
import { ShareChannel } from './ShareChannel'
import { StatusBanner } from './StatusBanner'
import { LeaveIcon } from './Icons'
import type { SignalingStatus } from '../types'

interface ChannelScreenProps {
  code: string
  displayName: string
  onLeave(): void
}

export function ChannelScreen({ code, displayName, onLeave }: ChannelScreenProps) {
  const { snapshot, setTalking, setMuted, retryMicrophone, setPlaybackBlocked } =
    useChannelSession(code, displayName)
  const online = useOnline()
  // Erhöht sich bei jedem "Ton an" und stößt damit ein neues play() an.
  const [unlockToken, setUnlockToken] = useState(0)
  useWakeLock(true)

  const { participants, signaling, signalingError, mic, micError, playbackBlocked } = snapshot

  const remotes = useMemo(
    () => participants.filter((participant) => !participant.isSelf && participant.stream),
    [participants],
  )

  const anyFailed = participants.some(
    (participant) => !participant.isSelf && participant.status === 'failed',
  )

  const onBlocked = useCallback(
    (blocked: boolean) => setPlaybackBlocked(blocked),
    [setPlaybackBlocked],
  )

  const micBroken = mic === 'denied' || mic === 'unavailable'

  return (
    <main className="safe-top safe-bottom mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-5 py-5">
      <header className="flex items-center justify-between gap-3">
        <ConnectionPill status={signaling} online={online} />
        <button
          type="button"
          onClick={onLeave}
          className="flex items-center gap-2 rounded-lg border border-shell-700 px-3 py-2 text-sm text-shell-400 transition-colors hover:border-alert-400 hover:text-alert-400"
        >
          <LeaveIcon className="h-4 w-4" />
          Verlassen
        </button>
      </header>

      <ShareChannel code={code} />

      <div className="flex flex-col gap-2">
        {!online && (
          <StatusBanner tone="error">
            Keine Netzverbindung. Walky verbindet sich automatisch neu, sobald
            wieder Empfang da ist.
          </StatusBanner>
        )}

        {online && signaling === 'error' && (
          <StatusBanner tone="error">
            {signalingError ?? 'Verbindung zum Signaling-Server fehlgeschlagen.'}
          </StatusBanner>
        )}

        {online && signaling === 'reconnecting' && (
          <StatusBanner tone="warn">Verbindung zum Kanal wird wiederhergestellt…</StatusBanner>
        )}

        {micBroken && (
          <StatusBanner
            tone="warn"
            action={{ label: 'Erneut versuchen', onClick: retryMicrophone }}
          >
            {micError ?? 'Kein Mikrofonzugriff.'} Zuhören funktioniert trotzdem.
          </StatusBanner>
        )}

        {playbackBlocked && (
          <StatusBanner
            tone="warn"
            action={{
              label: 'Ton an',
              onClick: () => {
                setPlaybackBlocked(false)
                setUnlockToken((token) => token + 1)
              },
            }}
          >
            Der Browser hat die Wiedergabe blockiert. Einmal tippen, dann ist der
            Ton frei.
          </StatusBanner>
        )}

        {anyFailed && !hasTurnServer && (
          <StatusBanner tone="warn">
            Zu mindestens einem Gerät kommt keine direkte Verbindung zustande.
            Das passiert in Mobilfunk- und Firmennetzen — dafür braucht es einen
            TURN-Server.
          </StatusBanner>
        )}
      </div>

      <div className="flex flex-1 items-center justify-center py-2">
        <PushToTalkButton
          onChange={setTalking}
          disabled={micBroken || signaling === 'error'}
          disabledHint={
            signaling === 'error'
              ? 'Ohne Kanalverbindung kann nicht gesendet werden.'
              : 'Ohne Mikrofon kannst du nur zuhören.'
          }
        />
      </div>

      <ParticipantList participants={participants} onToggleMute={setMuted} />

      {remotes.map((participant) => (
        <RemoteAudio
          key={participant.peerId}
          stream={participant.stream as MediaStream}
          muted={participant.muted}
          retryToken={unlockToken}
          onBlocked={onBlocked}
        />
      ))}
    </main>
  )
}

function ConnectionPill({
  status,
  online,
}: {
  status: SignalingStatus
  online: boolean
}) {
  const [label, tone] = !online
    ? ['offline', 'bg-alert-400']
    : status === 'connected'
      ? ['im Kanal', 'bg-live-400']
      : status === 'error'
        ? ['getrennt', 'bg-alert-400']
        : ['verbindet…', 'bg-signal-400']

  return (
    <span className="flex items-center gap-2 rounded-full border border-shell-700 bg-shell-800/60 px-3 py-2 text-xs tracking-wide text-shell-400 uppercase">
      <span className={`h-2 w-2 rounded-full ${tone}`} aria-hidden="true" />
      {label}
    </span>
  )
}

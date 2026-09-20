import { useCallback, useMemo, useState } from 'react'
import { useChannelSession } from '../hooks/useChannelSession'
import { useMediaSession } from '../hooks/useMediaSession'
import { useOnline } from '../hooks/useOnline'
import { useWakeLock } from '../hooks/useWakeLock'
import { useTranslations } from '../i18n'
import type { SignalingStatus } from '../types'
import { KeepAliveAudio } from './KeepAliveAudio'
import { LanguageToggle } from './LanguageToggle'
import { ParticipantList } from './ParticipantList'
import { PushToTalkButton } from './PushToTalkButton'
import { RemoteAudio } from './RemoteAudio'
import { ShareChannel } from './ShareChannel'
import { StatusBanner } from './StatusBanner'
import { LeaveIcon } from './Icons'

interface ChannelScreenProps {
  code: string
  displayName: string
  onLeave(): void
}

export function ChannelScreen({ code, displayName, onLeave }: ChannelScreenProps) {
  const t = useTranslations()
  const { snapshot, setTalking, setMuted, retryMicrophone, setPlaybackBlocked } =
    useChannelSession(code, displayName)
  const online = useOnline()
  // Erhöht sich bei jedem "Ton an" und stößt damit ein neues play() an.
  const [unlockToken, setUnlockToken] = useState(0)
  useWakeLock(true)

  const {
    participants,
    signaling,
    signalingError,
    mic,
    micError,
    hasTurn,
    iceReason,
    playbackBlocked,
  } = snapshot

  const remotes = useMemo(
    () => participants.filter((participant) => !participant.isSelf && participant.stream),
    [participants],
  )

  // `failed` meldet der Browser erst nach rund 30 Sekunden. Ein Peer, der
  // nach der Frist immer noch nicht steht, ist praktisch derselbe Fall — und
  // ohne Hinweis säße man vor einem endlosen "verbindet…".
  const mediaStuck = participants.some(
    (participant) =>
      !participant.isSelf && (participant.status === 'failed' || participant.stalled),
  )

  const onBlocked = useCallback(
    (blocked: boolean) => setPlaybackBlocked(blocked),
    [setPlaybackBlocked],
  )

  const micBroken = mic === 'denied' || mic === 'unavailable'

  const speaker = participants.find(
    (participant) => !participant.isSelf && participant.talking,
  )

  useMediaSession({
    title: t.lockScreen.title(code),
    artist: snapshot.selfTalking
      ? t.lockScreen.sending
      : speaker
        ? t.lockScreen.speaking(speaker.name)
        : t.lockScreen.idle,
    album: t.lockScreen.listeners(participants.length),
    talking: snapshot.selfTalking,
    onTalkingChange: setTalking,
  })

  return (
    <main className="safe-top safe-bottom mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-5 py-5">
      <header className="flex items-center justify-between gap-2">
        <ConnectionPill status={signaling} online={online} />
        <div className="flex shrink-0 items-center gap-2">
          <LanguageToggle />
          <button
            type="button"
            onClick={onLeave}
            className="flex items-center gap-2 rounded-lg border border-shell-700 px-3 py-2 text-sm text-shell-400 transition-colors hover:border-alert-400 hover:text-alert-400"
          >
            <LeaveIcon className="h-4 w-4" />
            {t.channel.leave}
          </button>
        </div>
      </header>

      <ShareChannel code={code} />

      <div className="flex flex-col gap-2">
        {!online && <StatusBanner tone="error">{t.channel.offlineBanner}</StatusBanner>}

        {online && signaling === 'error' && (
          <StatusBanner tone="error">
            {t.signalingErrors[signalingError ?? 'unreachable']}
          </StatusBanner>
        )}

        {online && signaling === 'reconnecting' && (
          <StatusBanner tone="warn">{t.channel.reconnectingBanner}</StatusBanner>
        )}

        {micBroken && (
          <StatusBanner
            tone="warn"
            action={{ label: t.channel.micRetry, onClick: retryMicrophone }}
          >
            {t.micErrors[micError ?? 'unknown']} {t.channel.micBannerSuffix}
          </StatusBanner>
        )}

        {playbackBlocked && (
          <StatusBanner
            tone="warn"
            action={{
              label: t.channel.playbackUnlock,
              onClick: () => {
                setPlaybackBlocked(false)
                setUnlockToken((token) => token + 1)
              },
            }}
          >
            {t.channel.playbackBlocked}
          </StatusBanner>
        )}

        {mediaStuck && (
          <StatusBanner tone="warn">
            {t.channel.noDirectConnection}{' '}
            {hasTurn
              ? t.channel.turnConfiguredButFailing
              : t.channel.iceReasons[iceReason ?? 'not_configured']}
          </StatusBanner>
        )}
      </div>

      <div className="flex flex-1 items-center justify-center py-2">
        <PushToTalkButton
          onChange={setTalking}
          active={snapshot.selfTalking}
          disabled={micBroken || signaling === 'error'}
          disabledHint={signaling === 'error' ? t.ptt.noChannel : t.ptt.noMic}
        />
      </div>

      <ParticipantList participants={participants} onToggleMute={setMuted} />

      <KeepAliveAudio />

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

function ConnectionPill({ status, online }: { status: SignalingStatus; online: boolean }) {
  const t = useTranslations()

  const [label, tone] = !online
    ? [t.channel.statusOffline, 'bg-alert-400']
    : status === 'connected'
      ? [t.channel.statusConnected, 'bg-live-400']
      : status === 'error'
        ? [t.channel.statusDisconnected, 'bg-alert-400']
        : [t.channel.statusConnecting, 'bg-signal-400']

  return (
    <span className="flex items-center gap-2 rounded-full border border-shell-700 bg-shell-800/60 px-3 py-2 text-xs tracking-wide text-shell-400 uppercase">
      <span className={`h-2 w-2 rounded-full ${tone}`} aria-hidden="true" />
      {label}
    </span>
  )
}

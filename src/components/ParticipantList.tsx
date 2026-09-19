import { initials } from '../lib/callsigns'
import type { Participant, PeerStatus } from '../types'
import { SpeakerIcon, SpeakerOffIcon } from './Icons'

const STATUS_LABEL: Record<PeerStatus, string> = {
  new: 'verbindet…',
  connecting: 'verbindet…',
  connected: 'verbunden',
  reconnecting: 'Verbindung wackelt',
  failed: 'keine Verbindung',
  closed: 'getrennt',
}

const STATUS_TONE: Record<PeerStatus, string> = {
  new: 'bg-shell-400',
  connecting: 'bg-signal-400',
  connected: 'bg-live-400',
  reconnecting: 'bg-signal-400',
  failed: 'bg-alert-400',
  closed: 'bg-shell-600',
}

interface ParticipantListProps {
  participants: Participant[]
  onToggleMute(peerId: string, muted: boolean): void
}

export function ParticipantList({ participants, onToggleMute }: ParticipantListProps) {
  return (
    <section aria-label="Teilnehmer im Kanal" className="w-full">
      <h2 className="mb-3 px-1 font-display text-xs tracking-[0.2em] text-shell-400 uppercase">
        Im Kanal · {participants.length}
      </h2>

      <ul className="flex flex-col gap-2">
        {participants.map((participant) => (
          <ParticipantRow
            key={participant.peerId}
            participant={participant}
            onToggleMute={onToggleMute}
          />
        ))}
      </ul>

      {participants.length === 1 && (
        <p className="mt-4 rounded-xl border border-dashed border-shell-700 px-4 py-5 text-center text-sm text-shell-400">
          Noch niemand sonst da. Teile den Link oder den Code — Beitreten dauert
          keine zehn Sekunden.
        </p>
      )}
    </section>
  )
}

function ParticipantRow({
  participant,
  onToggleMute,
}: {
  participant: Participant
  onToggleMute(peerId: string, muted: boolean): void
}) {
  const { isSelf, talking, status, muted, name } = participant

  return (
    <li
      className={[
        'flex items-center gap-3 rounded-xl border px-3 py-3 transition-colors',
        talking
          ? 'border-live-400/60 bg-live-500/10'
          : 'border-shell-700 bg-shell-800/60',
      ].join(' ')}
    >
      <span
        className={[
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-sm',
          talking ? 'bg-live-500 text-shell-950' : 'bg-shell-700 text-shell-200',
        ].join(' ')}
        aria-hidden="true"
      >
        {initials(name)}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-medium text-shell-200">{name}</span>
          {isSelf && (
            <span className="shrink-0 rounded bg-shell-700 px-1.5 py-0.5 text-[10px] tracking-wider text-shell-400 uppercase">
              Du
            </span>
          )}
        </span>

        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-shell-400">
          {talking ? (
            <>
              <TalkingBars />
              <span className="text-live-400">spricht</span>
            </>
          ) : (
            <>
              <span
                className={`h-1.5 w-1.5 rounded-full ${STATUS_TONE[status]}`}
                aria-hidden="true"
              />
              {isSelf ? 'bereit' : STATUS_LABEL[status]}
            </>
          )}
        </span>
      </span>

      {!isSelf && (
        <button
          type="button"
          onClick={() => onToggleMute(participant.peerId, !muted)}
          aria-pressed={muted}
          aria-label={muted ? `${name} wieder hören` : `${name} stummschalten`}
          className={[
            'shrink-0 rounded-lg border p-2 transition-colors',
            muted
              ? 'border-alert-400/50 bg-alert-500/10 text-alert-400'
              : 'border-shell-600 text-shell-400 hover:border-shell-400 hover:text-shell-200',
          ].join(' ')}
        >
          {muted ? <SpeakerOffIcon /> : <SpeakerIcon />}
        </button>
      )}
    </li>
  )
}

function TalkingBars() {
  return (
    <span className="flex h-3 items-end gap-0.5" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="animate-bars w-0.5 origin-bottom rounded-full bg-live-400"
          style={{ height: '100%', animationDelay: `${index * 0.15}s` }}
        />
      ))}
    </span>
  )
}

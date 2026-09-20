import type {
  IceFailureReason,
  MicErrorCode,
  PeerStatus,
  SignalingErrorCode,
} from '../types'

export const LANGUAGES = ['de', 'en'] as const
export type Language = (typeof LANGUAGES)[number]

/**
 * Deutsch ist die Referenz: `Translations` leitet sich daraus ab, jede weitere
 * Sprache muss dieselbe Form erfüllen. Fehlt ein Schlüssel oder passt eine
 * Signatur nicht, scheitert der Typecheck — nicht erst die Oberfläche.
 *
 * Bewusst kein i18n-Framework: zwei Sprachen, keine Pluralregeln, keine
 * Datumsformate. Ein Wörterbuch mit Funktionen für die Einsetzungen kostet
 * nichts und bleibt lesbar.
 */
const de = {
  language: {
    label: 'Sprache',
    switchTo: 'Switch to English',
    de: 'Deutsch',
    en: 'Englisch',
  },

  app: {
    tagline:
      'Kanal aufmachen, Link teilen, Knopf drücken. Kein Anruf, kein Klingeln, keine Installation nötig.',
    privacyNote:
      'Sprache läuft direkt zwischen den Geräten (WebRTC). Der Server vermittelt nur den Verbindungsaufbau und hört nichts mit.',
  },

  home: {
    callsignLabel: 'Dein Rufzeichen',
    callsignPlaceholder: 'z. B. Blauer Falke',
    reroll: 'Würfeln',
    createChannel: 'Kanal eröffnen',
    orJoin: 'oder beitreten',
    codeLabel: 'Kanal-Code oder Link',
    codePlaceholder: 'Code oder Link einfügen',
    join: 'Los',
    codeTooShort: (min: number) => `Bitte einen Code mit mindestens ${min} Zeichen eingeben.`,
  },

  install: {
    prompt: 'Als App installieren — startet dann ohne Browserleiste',
    iosHintBefore: 'Auf dem iPhone: Teilen-Symbol antippen und ',
    iosHintAction: '„Zum Home-Bildschirm"',
    iosHintAfter:
      ' wählen. Als installierte App fragt Walky eigenständig nach dem Mikrofon.',
  },

  share: {
    channelLabel: 'Kanal',
    share: 'Teilen',
    copied: 'Kopiert',
    showQr: 'QR-Code anzeigen',
    qrAlt: 'QR-Code zum Kanal',
    qrFailed: 'QR-Code konnte nicht erzeugt werden.',
    shareTitle: 'Walky-Kanal',
    shareText: (code: string) => `Kanal ${code}`,
    copyPrompt: 'Link kopieren:',
  },

  channel: {
    leave: 'Verlassen',
    statusOffline: 'offline',
    statusConnected: 'im Kanal',
    statusDisconnected: 'getrennt',
    statusConnecting: 'verbindet…',
    offlineBanner:
      'Keine Netzverbindung. Walky verbindet sich automatisch neu, sobald wieder Empfang da ist.',
    reconnectingBanner: 'Verbindung zum Kanal wird wiederhergestellt…',
    micBannerSuffix: 'Zuhören funktioniert trotzdem.',
    micRetry: 'Erneut versuchen',
    playbackBlocked:
      'Der Browser hat die Wiedergabe blockiert. Einmal tippen, dann ist der Ton frei.',
    playbackUnlock: 'Ton an',
    noDirectConnection:
      'Zu mindestens einem Gerät kommt keine Sprachverbindung zustande. In Mobilfunk- und Firmennetzen geht das nur über ein TURN-Relay.',
    iceReasons: {
      not_configured: 'Es ist keines eingerichtet.',
      unauthorized:
        'Eines ist hinterlegt, aber der Anbieter lehnt die Zugangsdaten ab — Token-ID oder Token stimmt nicht.',
      unknown_key: 'Die hinterlegte Token-ID kennt der Anbieter nicht.',
      unreachable: 'Das Relay ist gerade nicht erreichbar.',
      unexpected_response: 'Der Anbieter hat unerwartet geantwortet.',
    } satisfies Record<IceFailureReason, string>,
    turnConfiguredButFailing:
      'Ein Relay ist eingerichtet und wurde ausgeliefert — prüfe, ob es von diesem Netz aus erreichbar ist.',
  },

  lockScreen: {
    title: (code: string) => `Kanal ${code}`,
    idle: 'Bereit — niemand spricht',
    speaking: (name: string) => `${name} spricht`,
    muted: 'Stummgeschaltet',
    listeners: (count: number) => `${count} im Kanal`,
  },

  ptt: {
    idle: 'Sprechen',
    sending: 'Sendet',
    holdAria: 'Zum Sprechen gedrückt halten',
    sendingAria: 'Sendet — loslassen zum Beenden',
    lockOn: 'Freihändig',
    lockOff: 'Dauersenden aus',
    hint: 'Gedrückt halten zum Sprechen — am Rechner auch mit der Leertaste.',
    noChannel: 'Ohne Kanalverbindung kann nicht gesendet werden.',
    noMic: 'Ohne Mikrofon kannst du nur zuhören.',
  },

  participants: {
    sectionAria: 'Teilnehmer im Kanal',
    heading: (count: number) => `Im Kanal · ${count}`,
    self: 'Du',
    ready: 'bereit',
    talking: 'spricht',
    alone:
      'Noch niemand sonst da. Teile den Link oder den Code — Beitreten dauert keine zehn Sekunden.',
    mute: (name: string) => `${name} stummschalten`,
    unmute: (name: string) => `${name} wieder hören`,
    status: {
      new: 'verbindet…',
      connecting: 'verbindet…',
      connected: 'verbunden',
      reconnecting: 'Verbindung wackelt',
      failed: 'keine Verbindung',
      closed: 'getrennt',
    } satisfies Record<PeerStatus, string>,
    stalled: 'kein Ton — Verbindung kommt nicht zustande',
  },

  update: {
    available: 'Neue Version verfügbar.',
    reload: 'Jetzt aktualisieren',
    later: 'Später',
    inChannelWarning: 'Das Aktualisieren trennt dich kurz vom Kanal.',
    dismiss: 'Hinweis schließen',
    offlineReady: 'Walky ist jetzt auch ohne Netz startklar.',
  },

  micErrors: {
    denied:
      'Mikrofonzugriff wurde abgelehnt. In den Browser-Einstellungen für diese Seite freigeben.',
    notFound: 'Kein Mikrofon gefunden.',
    insecureContext:
      'Dieser Browser gibt kein Mikrofon frei. Die Seite muss über HTTPS laufen.',
    trackEnded: 'Die Mikrofon-Verbindung wurde unterbrochen.',
    unknown: 'Mikrofon konnte nicht gestartet werden.',
  } satisfies Record<MicErrorCode, string>,

  signalingErrors: {
    channelFull: 'Der Kanal ist voll. Für größere Gruppen braucht es einen Media-Server (SFU).',
    invalidChannel: 'Ungültiger Kanal-Code.',
    rejected: 'Der Signaling-Server hat die Verbindung abgelehnt.',
    unreachable: 'Verbindung zum Signaling-Server fehlgeschlagen.',
  } satisfies Record<SignalingErrorCode, string>,
}

export type Translations = typeof de

const en: Translations = {
  language: {
    label: 'Language',
    switchTo: 'Auf Deutsch umschalten',
    de: 'German',
    en: 'English',
  },

  app: {
    tagline:
      'Open a channel, share the link, press the button. No call, no ringing, nothing to install.',
    privacyNote:
      'Voice travels straight between devices (WebRTC). The server only brokers the connection — it never hears a thing.',
  },

  home: {
    callsignLabel: 'Your call sign',
    callsignPlaceholder: 'e.g. Blue Falcon',
    reroll: 'Shuffle',
    createChannel: 'Open a channel',
    orJoin: 'or join one',
    codeLabel: 'Channel code or link',
    codePlaceholder: 'Paste a code or link',
    join: 'Go',
    codeTooShort: (min: number) => `Please enter a code with at least ${min} characters.`,
  },

  install: {
    prompt: 'Install as an app — then it starts without the browser bar',
    iosHintBefore: 'On iPhone: tap the share icon and choose ',
    iosHintAction: '"Add to Home Screen"',
    iosHintAfter: '. Once installed, Walky asks for the microphone on its own.',
  },

  share: {
    channelLabel: 'Channel',
    share: 'Share',
    copied: 'Copied',
    showQr: 'Show QR code',
    qrAlt: 'QR code for this channel',
    qrFailed: 'The QR code could not be generated.',
    shareTitle: 'Walky channel',
    shareText: (code: string) => `Channel ${code}`,
    copyPrompt: 'Copy link:',
  },

  channel: {
    leave: 'Leave',
    statusOffline: 'offline',
    statusConnected: 'in channel',
    statusDisconnected: 'disconnected',
    statusConnecting: 'connecting…',
    offlineBanner:
      'No network connection. Walky reconnects by itself as soon as you are back online.',
    reconnectingBanner: 'Reconnecting to the channel…',
    micBannerSuffix: 'You can still listen.',
    micRetry: 'Try again',
    playbackBlocked: 'Your browser blocked playback. One tap and the sound is through.',
    playbackUnlock: 'Enable sound',
    noDirectConnection:
      'No voice connection to at least one device. On mobile and corporate networks that only works through a TURN relay.',
    iceReasons: {
      not_configured: 'None is set up.',
      unauthorized:
        'One is configured, but the provider rejects the credentials — the token ID or the token is wrong.',
      unknown_key: 'The provider does not know the configured token ID.',
      unreachable: 'The relay cannot be reached right now.',
      unexpected_response: 'The provider returned something unexpected.',
    },
    turnConfiguredButFailing:
      'A relay is set up and was handed out — check whether it is reachable from this network.',
  },

  lockScreen: {
    title: (code: string) => `Channel ${code}`,
    idle: 'Ready — nobody talking',
    speaking: (name: string) => `${name} is talking`,
    muted: 'Muted',
    listeners: (count: number) => `${count} in channel`,
  },

  ptt: {
    idle: 'Talk',
    sending: 'Live',
    holdAria: 'Hold to talk',
    sendingAria: 'Transmitting — release to stop',
    lockOn: 'Hands-free',
    lockOff: 'Stop hands-free',
    hint: 'Hold to talk — on a computer the space bar works too.',
    noChannel: 'Without a channel connection there is nothing to transmit on.',
    noMic: 'Without a microphone you can only listen.',
  },

  participants: {
    sectionAria: 'People in this channel',
    heading: (count: number) => `In channel · ${count}`,
    self: 'You',
    ready: 'ready',
    talking: 'talking',
    alone:
      'Nobody else here yet. Share the link or the code — joining takes under ten seconds.',
    mute: (name: string) => `Mute ${name}`,
    unmute: (name: string) => `Unmute ${name}`,
    status: {
      new: 'connecting…',
      connecting: 'connecting…',
      connected: 'connected',
      reconnecting: 'connection unstable',
      failed: 'no connection',
      closed: 'disconnected',
    },
    stalled: 'no audio — connection not coming up',
  },

  update: {
    available: 'A new version is available.',
    reload: 'Update now',
    later: 'Later',
    inChannelWarning: 'Updating will briefly drop you from the channel.',
    dismiss: 'Dismiss',
    offlineReady: 'Walky is ready to run offline now.',
  },

  micErrors: {
    denied:
      'Microphone access was denied. Allow it for this site in your browser settings.',
    notFound: 'No microphone found.',
    insecureContext:
      'This browser will not release the microphone. The page has to be served over HTTPS.',
    trackEnded: 'The microphone connection was interrupted.',
    unknown: 'The microphone could not be started.',
  },

  signalingErrors: {
    channelFull: 'This channel is full. Larger groups need a media server (SFU).',
    invalidChannel: 'Invalid channel code.',
    rejected: 'The signaling server refused the connection.',
    unreachable: 'Could not reach the signaling server.',
  },
}

export const translations: Record<Language, Translations> = { de, en }

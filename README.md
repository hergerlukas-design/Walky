# Walky

Walkie-Talkie im Browser: Kanal aufmachen, Link teilen, Knopf drücken,
sprechen. Kein Anruf, kein Klingeln, keine Installation aus dem App Store.
Läuft als PWA auf Android und iOS.

Die Sprache geht direkt von Gerät zu Gerät (WebRTC). Der Server vermittelt
nur den Verbindungsaufbau — er bekommt kein Audio zu sehen und speichert
nichts.

```
Gerät A ──┐                        ┌── Gerät B
          │   WebSocket (JSON)     │
          ├──► Signaling-Server ◄──┤     nur SDP, ICE und "spricht gerade"
          │                        │
          └────── WebRTC P2P ──────┘     die Sprache selbst
```

## Stack

| Baustein   | Technik                                                |
| ---------- | ------------------------------------------------------ |
| Frontend   | React 19, TypeScript, Vite 8, Tailwind CSS 4            |
| PWA        | `vite-plugin-pwa` (Workbox), Manifest, Service Worker   |
| Signaling  | Eigener WebSocket-Server (Node 22 + `ws`), ~430 Zeilen  |
| Audio      | WebRTC-Mesh, Opus, Push-to-Talk                         |
| Auslieferung | Derselbe Node-Prozess liefert auch die gebaute PWA aus |
| Hosting    | Fly.io (ein Container, ein Origin)                      |

Es gibt keine Datenbank und kein Login. Ein Kanal existiert genau so lange,
wie jemand drin ist.

## Loslegen

```bash
npm install
npm run dev:server   # Terminal 1 — Signaling auf :8080
npm run dev          # Terminal 2 — PWA auf :5173
```

Der Vite-Dev-Server reicht `/ws` an den Signaling-Server weiter, lokal
braucht es also keine Konfiguration. Danach [http://localhost:5173](http://localhost:5173)
öffnen.

**Zum Testen mit zwei echten Geräten** braucht der Browser HTTPS (ohne
sicheren Kontext gibt es kein Mikrofon — Ausnahme ist nur `localhost`). Am
einfachsten über einen Tunnel:

```bash
npm run build && npm start        # alles zusammen auf :8080
# in einem zweiten Terminal, z. B.:
ssh -R 80:localhost:8080 nokey@localhost.run
```

### Nützliche Befehle

| Befehl              | Zweck                                                |
| ------------------- | ---------------------------------------------------- |
| `npm run build`     | Typen prüfen, PWA bauen, Server kompilieren           |
| `npm start`         | Gebaute App + Signaling aus einem Prozess (Port 8080) |
| `npm test`          | Unit- und Integrationstests (Vitest)                  |
| `npm run typecheck` | Client, Vite-Config und Server getrennt prüfen        |
| `npm run lint`      | ESLint über alles                                     |
| `npm run icons`     | PWA-Icons neu erzeugen (`scripts/generate-icons.mjs`) |

## Aufbau

```
shared/     Protokoll und Kanal-Codes — von Client und Server importiert,
            damit beide Seiten nicht auseinanderlaufen
server/     app.ts (HTTP + WebSocket + statische Auslieferung)
            channels.ts (wer ist in welchem Kanal — reiner Speicher)
            index.ts (Prozessstart, Signal-Handling)
src/lib/    channelSession.ts (Klammer um alles), signaling.ts (WS-Client),
            mesh.ts + peerConnection.ts (WebRTC), microphone.ts
src/hooks/  React-Anbindung: Sitzung, Push-to-Talk, Wake Lock, Route
src/components/  Oberfläche
tests/      Kanal-Codes, Protokoll, Kanalverwaltung, Server end-to-end
```

Die Verbindungslogik liegt bewusst in Klassen und nicht in React-Effekten.
Eine `ChannelSession` wird einmal erzeugt, meldet Änderungen über
`useSyncExternalStore` nach oben und übersteht Re-Renders, den Strict Mode
und Netzwechsel unbeschadet.

### Signaling-Protokoll

Kanal und Peer stehen in der URL, der Beitritt passiert also mit dem
Verbindungsaufbau — ein zusätzlicher Handshake entfällt:

```
wss://<host>/ws/kanal/<code>?peer=<peer-id>&name=<rufzeichen>
```

| Richtung | Nachricht                                    | Zweck                          |
| -------- | -------------------------------------------- | ------------------------------ |
| S → C    | `welcome`                                    | wer ist schon da               |
| S → C    | `peer-join`, `peer-leave`                    | Teilnehmerliste fortschreiben  |
| C → S    | `signal` (`description` \| `candidate`)      | an genau einen Peer adressiert |
| S → C    | `signal`                                     | vom Server weitergereicht      |
| C ↔ S    | `talk`                                       | Sprechtaste gedrückt/los       |
| C ↔ S    | `ping` / `pong`                              | hält Proxys wach               |

Der Server prüft nur Zustellbarkeit und Format (`isClientMessage`), den
Inhalt reicht er unverändert durch. Alle Typen stehen in
[`shared/protocol.ts`](shared/protocol.ts).

### WebRTC-Mesh

Jedes Gerät hält zu jedem anderen eine eigene Verbindung. Bei n Teilnehmern
sind das n−1 Uploads pro Gerät — bis etwa vier bis fünf Teilnehmern
unproblematisch, darüber gehört eine SFU davor (siehe unten). Der Server
begrenzt einen Kanal deshalb auf `MAX_PEERS_PER_CHANNEL` (8).

Zwei Details, die in der Praxis den Unterschied machen:

- **Perfect Negotiation.** Treten zwei Geräte gleichzeitig bei, schicken
  beide ein Angebot. Wer nachgibt, entscheidet ein Vergleich der Peer-IDs —
  ohne Absprache über den Server und ohne Rollenverteilung.
- **`addTrack` statt `addTransceiver`.** Nur ein per `addTrack` angelegter
  Transceiver darf beim Eintreffen eines Angebots mit dessen m-Zeile
  verknüpft werden. Mit `addTransceiver` handelten beide Seiten je eine
  eigene m-Zeile aus, und die Verbindung trug zwei Audiospuren statt einer.

Das Mikrofon wird beim Beitritt einmal angefragt und bleibt danach offen —
aber mit `track.enabled = false`. Übertragen wird erst bei gedrückter Taste.
So gibt es genau einen Berechtigungsdialog und trotzdem keine offene
Leitung.

## Konfiguration

Alle Werte sind optional; ohne Konfiguration läuft die App gegen den eigenen
Origin. Vorlage: [`.env.example`](.env.example).

| Variable               | Wirkung                                                           |
| ---------------------- | ----------------------------------------------------------------- |
| `VITE_SIGNALING_URL`   | Signaling-Server, falls er nicht unter demselben Origin läuft      |
| `VITE_STUN_URLS`       | eigene STUN-Server (Komma-getrennt), Default: Google               |
| `VITE_TURN_URLS`       | TURN-Relay (Komma-getrennt)                                        |
| `VITE_TURN_USERNAME`   | TURN-Zugangsdaten                                                  |
| `VITE_TURN_CREDENTIAL` | TURN-Zugangsdaten                                                  |
| `PORT`, `HOST`         | Server-Bindung (Default `8080` / `0.0.0.0`)                        |
| `CLIENT_DIR`           | Verzeichnis mit dem PWA-Build (Default: `dist` neben `dist-server`) |

`VITE_*`-Variablen backt Vite fest in den Build ein — sie müssen also schon
beim Bauen anliegen, nicht erst zur Laufzeit (siehe `ARG` im Dockerfile).

### TURN: wann es ohne nicht geht

STUN reicht in den meisten WLANs. Hinter symmetrischem NAT — häufig im
Mobilfunk und in Firmennetzen — kommt keine direkte Verbindung zustande;
dann braucht es ein TURN-Relay, über das der Ton läuft. Erfahrungswert:
etwa 10–20 % der Verbindungen. Ohne TURN weist die App in solchen Fällen
sichtbar darauf hin, statt still nichts zu übertragen. Fertige Dienste:
Cloudflare Calls, Twilio, Metered; selbst gehostet: coturn.

## Deployment (Fly.io)

Ein Container liefert die PWA aus und betreibt das Signaling — also eine App,
ein Zertifikat, kein CORS.

**Automatisch:** Jeder Push auf `main` deployt, sobald Typen, Lint, Tests und
Build durch sind (`.github/workflows/ci.yml`). Voraussetzung ist das
Repository-Secret `FLY_API_TOKEN` aus `fly tokens create deploy`.

**Von Hand:**

```bash
fly deploy
```

TURN-Zugangsdaten hinterlegt man als Repository-Secrets (`VITE_TURN_URLS`,
`VITE_TURN_USERNAME`, `VITE_TURN_CREDENTIAL`), der Workflow reicht sie als
Build-Args durch. Von Hand entsprechend:

```bash
fly deploy \
  --build-arg VITE_TURN_URLS=turn:turn.example.com:3478 \
  --build-arg VITE_TURN_USERNAME=walky \
  --build-arg VITE_TURN_CREDENTIAL=geheim
```

> **Eine Instanz.** Die Kanalzuordnung liegt im Arbeitsspeicher. Mit zwei
> Maschinen landen zwei Geräte desselben Kanals womöglich auf
> unterschiedlichen Instanzen und finden sich nie — ein Fehlerbild, das beim
> Test zu zweit nicht auffällt und später sporadisch auftritt.
>
> `max_machines_running = 1` in `fly.toml` begrenzt allerdings nur das
> automatische Hochfahren, nicht die Zahl vorhandener Maschinen — und
> `fly launch` legt standardmäßig zwei an. Maßgeblich ist deshalb:
>
> ```bash
> fly status          # wie viele Maschinen laufen?
> fly scale count 1
> ```
>
> Der Deploy-Workflow führt `fly scale count 1` nach jedem Deploy aus. Für
> echte Skalierung braucht es geteilten Zustand (Redis Pub/Sub) oder Routing
> nach Kanal-Code.

`GET /healthz` liefert Status und die Zahl offener Kanäle und Teilnehmer; der
Workflow prüft die Antwort nach jedem Deploy.

## Was geprüft ist

`npm test` deckt Kanal-Codes, die Protokollprüfung und die Kanalverwaltung
ab und fährt für die Integrationstests einen echten Server auf einem echten
Port hoch (Beitritt, gezielte Zustellung, Kanaltrennung, voller Kanal,
fehlerhafte Nachrichten, Abgang).

Zusätzlich manuell gegen zwei bzw. drei echte Chromium-Instanzen geprüft:
Vollvermaschung steht, genau eine Audiospur je Verbindung, messbare
Audio-Energie beim Empfänger während des Sprechens, Sprecheranzeige und
Abgangserkennung.

**Noch offen:** der echte Mikrofon-Flow auf iOS-Safari und Android-Chrome auf
physischen Geräten. Der aus dem Prototyp bekannte Stolperstein — Mikrofon in
eingebetteten Kontexten mit vorbelegten Berechtigungen — sollte für eine
installierte PWA mit eigener Domain und eigenem Berechtigungsdialog
wegfallen, ist aber im Deployment noch zu bestätigen.

## Bedienung

- **Gedrückt halten** zum Sprechen. Der Finger darf dabei vom Knopf rutschen
  (Pointer Capture).
- **Leertaste** am Rechner, solange kein Textfeld den Fokus hat.
- **Freihändig** rastet die Taste ein, für Situationen ohne freie Hand.
- Nach 60 Sekunden am Stück schaltet sich die Übertragung selbst ab — gegen
  die versehentlich offene Leitung in der Hosentasche.
- Einzelne Teilnehmer lassen sich lokal stummschalten.
- Der Bildschirm bleibt im Kanal an (Wake Lock), damit die Sprechtaste
  erreichbar bleibt.

## Grenzen und nächster Ausbau

- **Mehr als ~5 Teilnehmer** überfordern das Mesh (n−1 Uploads pro Gerät).
  Nächste Stufe: eine SFU, die die Ströme verteilt — LiveKit Cloud oder
  selbst gehostet, wobei Signaling und UI dann an deren SDK gehen und dieser
  Server nur noch die PWA ausliefert.
- **Kanäle sind offen**: Wer den Code hat, ist drin. Für Nicht-Öffentliches
  gehört ein Passwort oder ein signierter Beitrittslink davor.
- **Eine Server-Instanz** (siehe Deployment).
- **Kein Verlauf**: Was gesagt wurde, ist weg. Audio-Clips der letzten
  Wortmeldungen wären eine naheliegende Erweiterung.

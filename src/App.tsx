import { useCallback, useState } from 'react'
import { ChannelScreen } from './components/ChannelScreen'
import { HomeScreen } from './components/HomeScreen'
import { UpdateBanner } from './components/UpdateBanner'
import { usePwaUpdate } from './hooks/usePwaUpdate'
import { useRoute } from './hooks/useRoute'
import { useI18n } from './i18n'
import { loadDisplayName } from './lib/callsigns'

export default function App() {
  const { lang } = useI18n()
  const [route, navigate] = useRoute()
  // Einmal aus dem Speicher lesen; die Startseite schreibt Änderungen zurück.
  const [displayName, setDisplayName] = useState(() => loadDisplayName(lang))
  const update = usePwaUpdate()

  const enter = useCallback((path: string) => navigate(path), [navigate])
  const leave = useCallback(() => navigate('/'), [navigate])

  const inChannel = route.name === 'channel'

  return (
    <>
      <UpdateBanner update={update} inChannel={inChannel} />

      {route.name === 'channel' ? (
        <ChannelScreen
          // Ein Kanalwechsel soll die Sitzung komplett neu aufbauen.
          key={route.code}
          code={route.code}
          displayName={displayName}
          onLeave={leave}
        />
      ) : (
        <HomeScreen
          displayName={displayName}
          onNameChange={setDisplayName}
          onEnter={enter}
        />
      )}
    </>
  )
}

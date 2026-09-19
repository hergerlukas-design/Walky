import { useCallback, useState } from 'react'
import { ChannelScreen } from './components/ChannelScreen'
import { HomeScreen } from './components/HomeScreen'
import { useRoute } from './hooks/useRoute'
import { loadDisplayName } from './lib/callsigns'

export default function App() {
  const [route, navigate] = useRoute()
  // Einmal aus dem Speicher lesen; die Startseite schreibt Änderungen zurück.
  const [displayName] = useState(loadDisplayName)

  const enter = useCallback((path: string) => navigate(path), [navigate])
  const leave = useCallback(() => navigate('/'), [navigate])

  if (route.name === 'channel') {
    return (
      <ChannelScreen
        // Ein Kanalwechsel soll die Sitzung komplett neu aufbauen.
        key={route.code}
        code={route.code}
        displayName={displayName}
        onLeave={leave}
      />
    )
  }

  return <HomeScreen onEnter={enter} />
}

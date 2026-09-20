import { useCallback, useEffect, useState } from 'react'
import { isValidChannelCode, normalizeChannelCode } from '../../shared/channelCode'

export type Route = { name: 'home' } | { name: 'channel'; code: string }

function parse(pathname: string): Route {
  const match = /^\/kanal\/([^/?#]+)/.exec(pathname)
  if (!match) return { name: 'home' }

  const code = normalizeChannelCode(decodeURIComponent(match[1]))
  return isValidChannelCode(code) ? { name: 'channel', code } : { name: 'home' }
}

/**
 * Minimaler Router für genau zwei Ansichten. Eine Router-Bibliothek wäre hier
 * mehr Abhängigkeit als Nutzen.
 */
export function useRoute(): [Route, (path: string, replace?: boolean) => void] {
  const [route, setRoute] = useState<Route>(() => parse(window.location.pathname))

  useEffect(() => {
    const onPopState = () => setRoute(parse(window.location.pathname))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = useCallback((path: string, replace = false) => {
    if (replace) {
      window.history.replaceState(null, '', path)
    } else {
      window.history.pushState(null, '', path)
    }
    setRoute(parse(window.location.pathname))
  }, [])

  return [route, navigate]
}

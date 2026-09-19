import { describe, expect, it } from 'vitest'
import { isClientMessage } from '../shared/protocol'

describe('isClientMessage', () => {
  it('lässt gültige Nachrichten durch', () => {
    expect(
      isClientMessage({
        type: 'signal',
        to: 'peer-a',
        kind: 'description',
        description: { type: 'offer', sdp: 'v=0' },
      }),
    ).toBe(true)
    expect(
      isClientMessage({
        type: 'signal',
        to: 'peer-a',
        kind: 'candidate',
        candidate: { candidate: 'candidate:1 1 udp' },
      }),
    ).toBe(true)
    expect(isClientMessage({ type: 'talk', talking: true })).toBe(true)
    expect(isClientMessage({ type: 'ping' })).toBe(true)
  })

  it('weist fehlerhafte oder fremde Nachrichten ab', () => {
    expect(isClientMessage(null)).toBe(false)
    expect(isClientMessage('ping')).toBe(false)
    expect(isClientMessage({})).toBe(false)
    expect(isClientMessage({ type: 'welcome' })).toBe(false)
    // Adressat fehlt
    expect(isClientMessage({ type: 'signal', kind: 'description', description: {} })).toBe(false)
    // Nutzlast passt nicht zur Art
    expect(
      isClientMessage({ type: 'signal', to: 'peer-a', kind: 'description', candidate: {} }),
    ).toBe(false)
    expect(isClientMessage({ type: 'talk', talking: 'ja' })).toBe(false)
  })
})

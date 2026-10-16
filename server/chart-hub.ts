import type { Session } from './session-store'
import { connectedSessions } from './session-store'
import type { ActiveInfo, SdkBridge } from './engine/sdk-bridge'

export interface LiveCandle {
  from: number
  open: number
  close: number
  min: number
  max: number
}

type Listener = (candle: LiveCandle) => void

interface Feed {
  candles: Map<number, LiveCandle>
  listeners: Set<Listener>
  unsub: () => void
  releaseTimer: ReturnType<typeof setTimeout> | null
}

const feeds = new Map<number, Feed>()
const opening = new Map<number, Promise<Feed>>()

function chartSession(): Session | null {
  const list = connectedSessions()
  if (!list.length) return null
  return list.sort((a, b) => b.lastSeenAt - a.lastSeenAt)[0]
}

function norm(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function cleanTicker(raw: unknown): string | null {
  const ticker = String(raw ?? '').trim().toUpperCase()
  if (!/^[A-Z0-9-]{3,24}$/.test(ticker)) return null
  return ticker
}

export async function resolveActive(sdk: SdkBridge, ticker: string): Promise<ActiveInfo | null> {
  const want = norm(ticker)
  const wantOtc = want.includes('OTC')
  const [digital, binary] = await Promise.all([
    sdk.getAvailableActives('digital').catch(() => []),
    sdk.getAvailableActives('binary').catch(() => []),
  ])
  const all = [...digital, ...binary]
  const exact = all.find(a => norm(a.ticker) === want || norm(a.name) === want)
  if (exact) return exact
  return all.find(a => {
    const name = norm(a.ticker)
    const otc = name.includes('OTC')
    if (otc !== wantOtc) return false
    return name.includes(want) || want.includes(name)
  }) ?? null
}

async function openFeed(sdk: SdkBridge, activeId: number): Promise<Feed> {
  const feed: Feed = {
    candles: new Map(),
    listeners: new Set(),
    unsub: () => {},
    releaseTimer: null,
  }
  const unsub = await sdk.subscribeCandles(activeId, (raw, isLive) => {
    const candle: LiveCandle = {
      from: raw.from,
      open: raw.open,
      close: raw.close,
      min: raw.min,
      max: raw.max,
    }
    feed.candles.set(candle.from, candle)
    if (feed.candles.size > 420) {
      const oldest = feed.candles.keys().next().value
      if (oldest !== undefined) feed.candles.delete(oldest)
    }
    if (!isLive) return
    for (const listener of feed.listeners) listener(candle)
  })
  feed.unsub = unsub
  feeds.set(activeId, feed)
  return feed
}

async function ensureFeed(sdk: SdkBridge, activeId: number): Promise<Feed> {
  const current = feeds.get(activeId)
  if (current) return current
  let pending = opening.get(activeId)
  if (!pending) {
    pending = openFeed(sdk, activeId).finally(() => opening.delete(activeId))
    opening.set(activeId, pending)
  }
  return pending
}

function scheduleRelease(activeId: number): void {
  const feed = feeds.get(activeId)
  if (!feed || feed.releaseTimer) return
  feed.releaseTimer = setTimeout(() => {
    const current = feeds.get(activeId)
    if (!current) return
    current.releaseTimer = null
    if (current.listeners.size > 0) return
    try { current.unsub() } catch { /* ignore */ }
    feeds.delete(activeId)
  }, 20_000)
}

export async function openChartStream(
  ticker: string,
  send: (event: string, data: unknown) => void,
  onClose: (release: () => void) => void,
): Promise<boolean> {
  const session = chartSession()
  if (!session) {
    send('status', { error: 'Entre na versão oficial com a corretora para liberar o gráfico ao vivo.' })
    return false
  }
  const active = await resolveActive(session.sdk, ticker)
  if (!active) {
    send('status', { error: `Ativo ${ticker} não encontrado na corretora.` })
    return false
  }
  const feed = await ensureFeed(session.sdk, active.id)
  if (feed.releaseTimer) {
    clearTimeout(feed.releaseTimer)
    feed.releaseTimer = null
  }
  const history = [...feed.candles.values()].sort((a, b) => a.from - b.from)
  send('history', history)
  const listener: Listener = (candle) => send('candle', candle)
  feed.listeners.add(listener)
  onClose(() => {
    feed.listeners.delete(listener)
    if (feed.listeners.size === 0) scheduleRelease(active.id)
  })
  return true
}

import { randomBytes, randomUUID } from 'crypto'
import { WebSocket } from 'ws'
import { SdkBridge } from './engine/sdk-bridge'
import { BotEngine, type BotConfig, type BotStatus } from './engine/bot-engine'
import { assertRealBankroll } from './engine/balance-rules'
import { callEdgeFunction } from './engine/supabase-client'
import { setTelemetryUser, trackBalanceUpdate } from './engine/telemetry'

export interface Session {
  id: string
  sdk: SdkBridge
  bot: BotEngine
  email: string | null
  userId: string | null
  createdAt: number
  lastSeenAt: number
  verifier: string | null
  brokerLinked: boolean
  clients: Set<WebSocket>
  wsTicket: string
}

const sessions = new Map<string, Session>()
const tickets = new Map<string, string>()

function emit(session: Session, channel: string, payload: unknown) {
  const msg = JSON.stringify({ channel, payload })
  for (const ws of session.clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg)
  }
}

function bindBot(session: Session): void {
  session.bot.on('started', (s) => emit(session, 'bot:started', s))
  session.bot.on('stopped', (s) => emit(session, 'bot:stopped', s))
  session.bot.on('status', (s) => emit(session, 'bot:status', s))
  session.bot.on('trade_entered', (t) => emit(session, 'bot:trade_entered', t))
  session.bot.on('trade_result', (t) => emit(session, 'bot:trade_result', t))
  session.bot.on('stop_triggered', (d) => emit(session, 'bot:stop_triggered', d))
  session.bot.on('log', (m) => emit(session, 'bot:log', m))
  session.bot.on('error', (e) => emit(session, 'bot:error', e))
  session.bot.on('candle', (c) => emit(session, 'bot:candle', c))
  session.bot.on('candles_history', (h) => emit(session, 'bot:candles_history', h))
  session.bot.on('chart_reset', () => emit(session, 'bot:chart_reset', null))
}

export function createSession(): Session {
  const id = randomUUID()
  const sdk = new SdkBridge()
  const bot = new BotEngine(sdk)
  const session: Session = {
    id,
    sdk,
    bot,
    email: null,
    userId: null,
    createdAt: Date.now(),
    lastSeenAt: Date.now(),
    verifier: null,
    brokerLinked: false,
    clients: new Set(),
    wsTicket: randomBytes(24).toString('hex'),
  }
  tickets.set(session.wsTicket, id)
  bindBot(session)
  sessions.set(id, session)
  return session
}

export function getSession(id: string | undefined | null): Session | null {
  if (!id) return null
  const s = sessions.get(id)
  if (s) s.lastSeenAt = Date.now()
  return s ?? null
}

export function getSessionByTicket(ticket: string | undefined | null): Session | null {
  if (!ticket) return null
  return getSession(tickets.get(ticket) ?? null)
}

export function attachClient(session: Session, ws: WebSocket): void {
  session.clients.add(ws)
  ws.on('close', () => session.clients.delete(ws))
}

export async function setSessionEmail(
  session: Session,
  email: string,
): Promise<{ ok: boolean; userId?: string; error?: string }> {
  const clean = String(email ?? '').trim().toLowerCase()
  if (!clean) return { ok: false, error: 'empty_email' }
  session.email = clean
  session.sdk.setUserEmail(clean)
  try {
    const res = await callEdgeFunction('user-upsert', { email: clean })
    if (!res.ok || !res.data?.user_id) {
      return { ok: false, error: res.error ?? 'user_upsert_failed' }
    }
    session.userId = String(res.data.user_id)
    setTelemetryUser(session.userId)
    return { ok: true, userId: session.userId }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'unknown' }
  }
}

export async function startBot(
  session: Session,
  config: BotConfig,
): Promise<{ ok: boolean; error?: string; status?: BotStatus }> {
  try {
    if (session.email && !session.userId) {
      await setSessionEmail(session, session.email)
    }
    if (!session.sdk.isConnected()) {
      return { ok: false, error: 'Broker10 desconectada. Entre de novo com a corretora.' }
    }
    if (!config?.activeId || !config?.balanceId) {
      return { ok: false, error: 'Escolha o ativo e a conta antes de iniciar' }
    }
    if (session.bot.isRunning()) {
      return { ok: true, status: session.bot.getStatus() }
    }
    const balances = await session.sdk.getBalances()
    const bal = balances.find((b) => b.id === config.balanceId)
    if (!bal) return { ok: false, error: 'Saldo não encontrado' }
    assertRealBankroll({
      id: bal.id,
      amount: bal.amount,
      currency: bal.currency,
      type: bal.type,
    })
    session.sdk.subscribeBalanceUpdate(config.balanceId, (amount) => {
      emit(session, 'bot:balance', amount)
      trackBalanceUpdate(amount, bal.currency)
    })
    await session.bot.start(config, bal.amount)
    return { ok: true, status: session.bot.getStatus() }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'unknown' }
  }
}

export async function stopBot(session: Session): Promise<{ ok: boolean; error?: string }> {
  try {
    await session.bot.stop()
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'unknown' }
  }
}

export function emitBrokerConnected(session: Session): void {
  session.brokerLinked = true
  emit(session, 'broker:connected', null)
}

export function emitBrokerError(session: Session, message: string): void {
  emit(session, 'broker:error', message)
}

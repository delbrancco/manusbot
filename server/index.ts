import http from 'http'
import path from 'path'
import fs from 'fs'
import express from 'express'
import cookieParser from 'cookie-parser'
import { WebSocketServer } from 'ws'
import { FEATURE_FLAGS } from './engine/feature-flags'
import { callEdgeFunction } from './engine/supabase-client'
import { trackError } from './engine/telemetry'
import {
  attachClient,
  createSession,
  emitBrokerConnected,
  getSession,
  getSessionByTicket,
  setSessionEmail,
  startBot,
  stopBot,
  type Session,
} from './session-store'

const COOKIE = 'mb_sid'
const EMAIL_COOKIE = 'mb_email'
const PORT = Number(process.env.PORT || 3000)
const VERSION = process.env.npm_package_version ?? '1.0.0'
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const PUBLIC_ORIGIN = (process.env.PUBLIC_ORIGIN || 'https://manusbot.up.railway.app').replace(/\/$/, '')

function sessionCookie() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  }
}

function persistEmail(res: express.Response, email: string) {
  const clean = email.trim().toLowerCase()
  if (EMAIL_RE.test(clean)) res.cookie(EMAIL_COOKIE, clean, sessionCookie())
}

function persistWsTicket(res: express.Response, ticket: string) {
  res.cookie('mb_ticket', ticket, {
    ...sessionCookie(),
    httpOnly: false,
  })
}

function publicOrigin(req: express.Request): string {
  const xfProto = String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim()
  const proto = xfProto || req.protocol || 'https'
  const xfHost = String(req.headers['x-forwarded-host'] ?? '').split(',')[0].trim()
  const host = xfHost || req.get('host') || 'localhost'
  return `${proto}://${host}`
}

function callbackUri(req: express.Request): string {
  return `${publicOrigin(req)}/auth/callback`
}

const app = express()
app.set('trust proxy', 1)
app.set('etag', false)
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  next()
})

function extractOAuthCode(raw: string): string | null {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) return null
  try {
    const u = new URL(trimmed)
    const code = u.searchParams.get('code')
    if (code) return code
  } catch { /* not a URL */ }
  const match = trimmed.match(/[?&]code=([^&]+)/)
  return match ? decodeURIComponent(match[1]) : trimmed
}

function requireSession(req: express.Request, res: express.Response): Session {
  let sid = String(req.cookies?.[COOKIE] ?? '')
  let session = getSession(sid)
  if (!session) {
    session = createSession()
    sid = session.id
    res.cookie(COOKIE, sid, sessionCookie())
  }
  const emailFromCookie = String(req.cookies?.[EMAIL_COOKIE] ?? '').trim().toLowerCase()
  if (!session.email && EMAIL_RE.test(emailFromCookie)) {
    session.email = emailFromCookie
  }
  if (session.email) session.sdk.setUserEmail(session.email)
  persistWsTicket(res, session.wsTicket)
  return session
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'manusbot' })
})

app.get('/api/session', (req, res) => {
  const session = requireSession(req, res)
  res.json({
    ok: true,
    connected: session.sdk.isConnected(),
    running: session.bot.isRunning(),
    wsTicket: session.wsTicket,
  })
})

app.get('/api/version', (_req, res) => {
  res.json({ version: VERSION, platform: 'web' })
})

app.post('/api/auth/start', async (req, res) => {
  const session = requireSession(req, res)
  try {
    const email = String(req.body?.email ?? session.email ?? '').trim().toLowerCase()
    if (EMAIL_RE.test(email)) {
      session.email = email
      session.sdk.setUserEmail(email)
      persistEmail(res, email)
    }
    if (!session.email) {
      return res.json({ ok: false, error: 'Email do usuário não definido — passe pelo acesso antes do login Broker10' })
    }
    session.sdk.setRedirectUri(callbackUri(req))
    const { url, codeVerifier } = await session.sdk.createAuthUrl()
    session.verifier = codeVerifier
    res.json({ ok: true, url, origin: publicOrigin(req) })
  } catch (e: any) {
    res.json({ ok: false, error: e?.message ?? 'auth_start_failed' })
  }
})

app.post('/api/auth/exchange', async (req, res) => {
  const session = requireSession(req, res)
  try {
    const code = extractOAuthCode(String(req.body?.code ?? ''))
    if (!code) return res.json({ ok: false, error: 'URL sem código de autorização' })
    if (!session.verifier) return res.json({ ok: false, error: 'Inicie o fluxo de autenticação primeiro' })
    session.sdk.setRedirectUri(callbackUri(req))
    await session.sdk.exchangeCode(code, session.verifier)
    await session.sdk.connect()
    session.verifier = null
    if (session.email && !session.userId) await setSessionEmail(session, session.email)
    emitBrokerConnected(session)
    res.json({ ok: true })
  } catch (e: any) {
    res.json({ ok: false, error: e?.message ?? 'exchange_failed' })
  }
})

app.get('/auth/callback', async (req, res) => {
  const session = requireSession(req, res)
  const origin = publicOrigin(req)
  try {
    if (req.query.error) return res.redirect('/?auth=denied')
    const code = extractOAuthCode(String(req.query.code ?? ''))
    if (!code) return res.redirect('/?auth=missing_code')
    if (!session.verifier) return res.redirect('/?auth=no_verifier')
    session.sdk.setRedirectUri(callbackUri(req))
    await session.sdk.exchangeCode(code, session.verifier)
    await session.sdk.connect()
    session.verifier = null
    if (session.email && !session.userId) await setSessionEmail(session, session.email)
    emitBrokerConnected(session)
    res.type('html').send(`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Manus IA</title></head>
<body style="background:#252320;color:#f8f8f8;font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
<p id="msg">Conectado. Fechando esta guia...</p>
<script>
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ channel: 'broker:connected' }, ${JSON.stringify(origin)})
      window.opener.focus()
    }
  } catch (e) {}
  window.close()
  setTimeout(function () {
    document.getElementById('msg').textContent = 'Pode fechar esta guia e voltar ao Manus IA.'
  }, 400)
</script>
</body></html>`)
  } catch (e: any) {
    console.error('[auth/callback]', e?.message ?? e)
    res.redirect('/?auth=error')
  }
})

app.get('/api/auth/connected', (req, res) => {
  const session = requireSession(req, res)
  res.json({ connected: session.sdk.isConnected() })
})

app.post('/api/auth/logout', async (req, res) => {
  const session = requireSession(req, res)
  try {
    await session.bot.stop().catch(() => {})
    await session.sdk.logout()
    session.brokerLinked = false
    session.email = null
    session.userId = null
    res.clearCookie(EMAIL_COOKIE, { path: '/' })
    res.json({ ok: true })
  } catch (e: any) {
    res.json({ ok: false, error: e?.message ?? 'logout_failed' })
  }
})

app.post('/api/auth/disconnect', async (req, res) => {
  const session = requireSession(req, res)
  try {
    await session.sdk.disconnect()
    res.json({ ok: true })
  } catch (e: any) {
    res.json({ ok: false, error: e?.message ?? 'disconnect_failed' })
  }
})

app.get('/api/sdk/balances', async (req, res) => {
  const session = requireSession(req, res)
  try {
    res.json({ ok: true, balances: await session.sdk.getBalances() })
  } catch (e: any) {
    res.json({ ok: false, error: e?.message })
  }
})

app.get('/api/sdk/actives', async (req, res) => {
  const session = requireSession(req, res)
  const instrument = req.query.instrument === 'binary' ? 'binary' : 'digital'
  try {
    const actives = await session.sdk.getAvailableActives(instrument)
    res.json({ ok: true, actives })
  } catch (e: any) {
    res.json({ ok: false, error: e?.message })
  }
})

app.post('/api/bot/start', async (req, res) => {
  const session = requireSession(req, res)
  res.json(await startBot(session, req.body))
})

app.post('/api/bot/stop', async (req, res) => {
  const session = requireSession(req, res)
  res.json(await stopBot(session))
})

app.get('/api/bot/status', (req, res) => {
  const session = requireSession(req, res)
  res.json(session.bot.getStatus())
})

app.get('/api/bot/chart-snapshot', (req, res) => {
  const session = requireSession(req, res)
  res.json(session.bot.getChartCandles())
})

app.post('/api/user/email', async (req, res) => {
  const session = requireSession(req, res)
  const result = await setSessionEmail(session, String(req.body?.email ?? ''))
  if (session.email) persistEmail(res, session.email)
  res.json(result)
})

app.get('/api/user', (req, res) => {
  const session = requireSession(req, res)
  res.json({ userId: session.userId, email: session.email })
})

app.get('/api/embed-origin', (req, res) => {
  const origin = publicOrigin(req)
  res.json({ origin, pageUrl: `${origin}/` })
})

app.post('/api/check-update', async (_req, res) => {
  if (!FEATURE_FLAGS.UPDATE_CHECK_ENABLED) return res.json({ ok: true, needs_update: false })
  try {
    const result = await callEdgeFunction('check-update', {
      platform: 'web',
      current_version: VERSION,
    })
    if (!result.ok) return res.json({ ok: false, error: result.error })
    res.json({ ok: true, ...result.data })
  } catch (e: any) {
    trackError(e, { context: 'check_update' })
    res.json({ ok: false, error: e?.message })
  }
})

const publicDir = path.join(__dirname, 'public')
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir))
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    if (req.path.startsWith('/api') || req.path.startsWith('/ws') || req.path.startsWith('/auth')) return next()
    res.sendFile(path.join(publicDir, 'index.html'))
  })
}

const server = http.createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

function ticketFromUpgrade(req: http.IncomingMessage): string {
  const proto = String(req.headers['sec-websocket-protocol'] ?? '')
  const fromProto = proto.split(',').map((s) => s.trim()).find((s) => s.startsWith('mb.'))
  if (fromProto) return fromProto.slice(3)
  const rawUrl = String(req.url ?? '')
  const qs = rawUrl.includes('?') ? new URLSearchParams(rawUrl.slice(rawUrl.indexOf('?') + 1)) : new URLSearchParams()
  return String(qs.get('ticket') ?? '')
}

wss.on('connection', (ws, req) => {
  const ticket = ticketFromUpgrade(req)
  const cookie = String(req.headers.cookie ?? '')
  const sidMatch = cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]+)`))
  const ticketMatch = cookie.match(/(?:^|; )mb_ticket=([^;]+)/)
  const sid = sidMatch ? decodeURIComponent(sidMatch[1]) : ''
  const cookieTicket = ticketMatch ? decodeURIComponent(ticketMatch[1]) : ''
  const session = getSessionByTicket(ticket) || getSessionByTicket(cookieTicket) || getSession(sid)
  if (!session) {
    ws.close(4401, 'no session')
    return
  }
  attachClient(session, ws)
  ws.send(JSON.stringify({
    channel: 'session:hello',
    payload: { connected: session.sdk.isConnected(), running: session.bot.isRunning() },
  }))
  if (session.bot.isRunning()) {
    ws.send(JSON.stringify({ channel: 'bot:started', payload: session.bot.getStatus() }))
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[manusbot] listening on :${PORT} origin=${PUBLIC_ORIGIN}`)
})

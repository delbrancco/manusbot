/** Cliente HTTP + WebSocket que replica a API `window.manusPro` do Electron. */

type Unsub = () => void

const listeners = new Map<string, Set<(...args: any[]) => void>>()

function emit(channel: string, payload: any) {
  const set = listeners.get(channel)
  if (!set) return
  for (const cb of set) {
    try { cb(payload) } catch (err) { console.error('[manusbot]', channel, err) }
  }
}

async function api<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    cache: 'no-store',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  return res.json() as Promise<T>
}

let ws: WebSocket | null = null
let wsTimer: ReturnType<typeof setTimeout> | null = null
let wsTicket = ''

function wsUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const q = wsTicket ? `?ticket=${encodeURIComponent(wsTicket)}` : ''
  return `${proto}//${location.host}/ws${q}`
}

function connectWs() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return
  try {
    ws = wsTicket
      ? new WebSocket(wsUrl(), [`mb.${wsTicket}`])
      : new WebSocket(wsUrl())
  } catch {
    scheduleWs()
    return
  }
  ws.onmessage = (ev) => {
    try {
      const data = JSON.parse(String(ev.data))
      if (data?.channel) emit(data.channel, data.payload)
    } catch { /* ignore */ }
  }
  ws.onclose = (ev) => {
    if (ev.code === 4401) {
      void refreshSession().then(() => scheduleWs())
      return
    }
    scheduleWs()
  }
  ws.onerror = () => { /* onclose follows */ }
}

function scheduleWs() {
  if (wsTimer) return
  wsTimer = setTimeout(() => {
    wsTimer = null
    connectWs()
  }, 2000)
}

async function refreshSession() {
  const s = await api<{ ok?: boolean; wsTicket?: string }>('/api/session')
  if (s?.wsTicket) wsTicket = s.wsTicket
  return s
}

const BROKER_CALLBACK_ORIGIN = 'https://claudepro.online'

if (typeof window !== 'undefined') {
  window.addEventListener('message', (ev) => {
    if (ev.origin === window.location.origin) {
      if (ev.data?.channel === 'broker:connected') emit('broker:connected', null)
      if (ev.data?.channel === 'broker:error') emit('broker:error', ev.data.payload)
      return
    }
    if (ev.origin !== BROKER_CALLBACK_ORIGIN) return
    if (ev.data?.type !== 'manuspro:auth:callback') return
    const code = ev.data?.params?.code || ev.data?.params?.token
    if (!code) {
      emit('broker:error', ev.data?.params?.error_description || ev.data?.params?.error || 'Falha na autenticação')
      return
    }
    void api<{ ok?: boolean; error?: string }>('/api/auth/exchange', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }).then((res) => {
      if (res?.ok) emit('broker:connected', null)
      else emit('broker:error', res?.error || 'Não foi possível concluir a autenticação')
    })
  })
}

void refreshSession().then(() => connectWs()).catch(() => scheduleWs())

window.manusPro = {
  appPlatform: 'web',

  brokerStartAuth: async () => {
    const email = (() => {
      try { return localStorage.getItem('manuspro_licensed_email') || '' } catch { return '' }
    })()
    const res = await api<{ ok: boolean; url?: string; error?: string }>(
      '/api/auth/start',
      { method: 'POST', body: JSON.stringify({ email }) },
    )
    if (res.ok && res.url) {
      const popup = window.open(res.url, 'manusbot-broker')
      if (!popup) {
        return { ok: false, error: 'O navegador bloqueou a janela de login. Permita pop-ups e tente de novo.' }
      }
    }
    return res
  },
  brokerExchangeCode: (code: string) =>
    api('/api/auth/exchange', { method: 'POST', body: JSON.stringify({ code }) }),
  brokerDisconnect: () => api('/api/auth/disconnect', { method: 'POST' }),
  brokerLogout: () => api('/api/auth/logout', { method: 'POST' }),
  brokerIsConnected: () => api('/api/auth/connected'),

  sdkBalances: () => api('/api/sdk/balances'),
  sdkActives: (instrument?: 'binary' | 'digital') =>
    api(`/api/sdk/actives?instrument=${instrument ?? 'digital'}`),

  botStart: (config: any) =>
    api('/api/bot/start', { method: 'POST', body: JSON.stringify(config) }),
  botStop: () => api('/api/bot/stop', { method: 'POST' }),
  botGetStatus: () => api('/api/bot/status'),
  botChartSnapshot: () => api('/api/bot/chart-snapshot'),

  appGetVersion: () => api('/api/version'),
  appCheckUpdate: () => api('/api/check-update', { method: 'POST' }),
  appOpenExternal: async (url: string) => {
    try {
      window.open(url, '_blank', 'noopener,noreferrer')
      return { ok: true }
    } catch (e: any) {
      return { ok: false, error: e?.message ?? 'open_failed' }
    }
  },
  appClearStorage: async () => {
    try { localStorage.clear() } catch { /* ignore */ }
    location.reload()
    return { ok: true }
  },
  appLogout: () => api('/api/auth/logout', { method: 'POST' }),
  setUserEmail: (email: string) =>
    api('/api/user/email', { method: 'POST', body: JSON.stringify({ email }) }),
  appGetUserId: () => api('/api/user'),
  appGetEmbedOrigin: () => api('/api/embed-origin'),

  on: (channel: string, cb: (...args: any[]) => void): Unsub => {
    let set = listeners.get(channel)
    if (!set) {
      set = new Set()
      listeners.set(channel, set)
    }
    set.add(cb)
    return () => { set!.delete(cb) }
  },
}

import { useState, useEffect, useCallback, useRef } from 'react'
import type { BotStatus, BalanceInfo, TradeRecord, BotConfig } from '../types'
import ConfigPanel from '../components/ConfigPanel'
import ScoreBoard from '../components/ScoreBoard'
import TradeLog from '../components/TradeLog'
import LiveChart from '../components/LiveChart'
import LogConsole from '../components/LogConsole'
import { formatCurrency } from '../lib/currency'
import { strategyLabel } from '../lib/strategies'

interface Props {
  onDisconnect: () => void
}

export default function Dashboard({ onDisconnect }: Props) {
  const [balances, setBalances] = useState<BalanceInfo[]>([])
  const [status, setStatus] = useState<BotStatus | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [configOpen, setConfigOpen] = useState(false)
  const [activeBalance, setActiveBalance] = useState<number>(0)
  const [displayBalanceId, setDisplayBalanceId] = useState<number | null>(null)

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [msg, ...prev].slice(0, 200))
  }, [])

  const currency =
    balances.find(b => b.id === displayBalanceId)?.currency
    ?? balances.find(b => b.type === 'real')?.currency
    ?? balances[0]?.currency
    ?? 'BRL'

  const currencyRef = useRef(currency)
  currencyRef.current = currency

  useEffect(() => {
    // Load initial data
    async function init() {
      setLoading(true)
      const bRes = await window.manusPro.sdkBalances()
      if (bRes.ok && bRes.balances) setBalances(bRes.balances)

      const s = await window.manusPro.botGetStatus()
      setStatus(s)
      setLoading(false)
    }
    init()

    // Subscribe to events
    const unsubs = [
      window.manusPro.on('bot:status',        (s) => setStatus(s)),
      window.manusPro.on('bot:started',       (s) => { setStatus(s); addLog('[SISTEMA] Bot iniciado') }),
      window.manusPro.on('bot:stopped',       (s) => { setStatus(s); setDisplayBalanceId(null); addLog('[SISTEMA] Bot parado') }),
      window.manusPro.on('bot:trade_entered', (t: TradeRecord) =>
        addLog(`[ENTRADA] ${strategyLabel(t.strategy)} → ${t.direction} ${formatCurrency(t.amount, currencyRef.current)}`)),
      window.manusPro.on('bot:trade_result',  (t: TradeRecord) =>
        addLog(`[RESULTADO] ${strategyLabel(t.strategy)} ${t.direction} → ${t.result} ${t.profit >= 0 ? '+' : ''}${formatCurrency(t.profit, currencyRef.current)}`)),
      window.manusPro.on('bot:stop_triggered',(d: any) => addLog(`[STOP] ${d.reason}`)),
      window.manusPro.on('bot:log',           (m: string) => addLog(m)),
      window.manusPro.on('bot:balance',       (v: number) => setActiveBalance(v)),
      window.manusPro.on('bot:error',         (e: string) => addLog(`[ERRO] ${e}`)),
    ]

    return () => unsubs.forEach(u => u())
  }, [addLog])

  async function handleStart(config: BotConfig) {
    setConfigOpen(false)
    const res = await window.manusPro.botStart(config)
    if (!res.ok) addLog(`[ERRO] ${res.error}`)
    else setDisplayBalanceId(config.balanceId)
  }

  async function handleStop() {
    await window.manusPro.botStop()
  }

  const isRunning = status?.running ?? false

  return (
    <div className="dashboard">
      {/* ── Top Bar ── */}
      <div className="topbar">
        <div className="topbar-logo">
          <span className="brand-manus">MANUS</span>
          <span className="brand-pro">IA</span>
        </div>

        <div className="topbar-pair">
          {isRunning && (
            <>
              <span className="pair-badge">{status?.activeTicker}</span>
              <span className="instrument-badge">{status?.instrument?.toUpperCase()}</span>
              <span className={`running-dot ${isRunning ? 'active' : ''}`} />
            </>
          )}
        </div>

        <div className="topbar-actions">
          {!isRunning ? (
            <button className="btn-start" onClick={() => setConfigOpen(true)} disabled={loading}>
              ▶ Iniciar Bot
            </button>
          ) : (
            <button className="btn-stop" onClick={handleStop}>
              ■ Parar Bot
            </button>
          )}
          <button className="btn-ghost-sm" onClick={onDisconnect}>Desconectar</button>
        </div>
      </div>

      {/* ── Main Layout ── */}
      <div className="dashboard-body">

        {/* Left: Chart + Log */}
        <div className="dashboard-left">
          <LiveChart activeId={status?.activeId} activeTicker={status?.activeTicker} />
          <LogConsole logs={logs} />
        </div>

        {/* Right: Scoreboard + Trades */}
        <div className="dashboard-right">
          <ScoreBoard status={status} activeBalance={activeBalance} currency={currency} />
          <TradeLog trades={status?.trades ?? []} currency={currency} />
        </div>
      </div>

      {/* ── Config Modal ── */}
      {configOpen && (
        <ConfigPanel
          balances={balances}
          onStart={handleStart}
          onClose={() => setConfigOpen(false)}
        />
      )}
    </div>
  )
}

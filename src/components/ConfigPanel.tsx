import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { BalanceInfo, ActiveInfo, BotConfig } from '../types'
import { currencySymbol, formatCurrency } from '../lib/currency'
import { FEATURE_FLAGS } from '../feature-flags'
import {
  getRealBalances,
  MIN_REAL_BALANCE_BRL,
  validateRealBankroll,
} from '../lib/balance-rules'

interface Props {
  balances: BalanceInfo[]
  onStart: (c: BotConfig) => void
  onClose: () => void
}

const STRATEGIES: Array<{
  id: 'q5' | 'alt' | 'last2' | 'hard'
  label: string
  exclusive?: boolean
}> = [
  { id: 'q5', label: 'FT5' },
  { id: 'alt', label: 'Opostos' },
  { id: 'last2', label: 'P2' },
  { id: 'hard', label: 'Prime', exclusive: true },
]

const INSTRUMENT = 'digital' as const
const CONFIG_STORAGE_KEY = 'manuspro:botConfig'

interface PersistedConfig {
  activeId?: number
  balanceId?: number
  entryAmount?: string
  stopLoss?: string
  stopWin?: string
  stopConsec?: string
  q5?: boolean
  alt?: boolean
  last2?: boolean
  hard?: boolean
  galeEnabled?: boolean
  galeRounds?: string
  sorosEnabled?: boolean
  sorosMaxLevel?: string
}

function loadPersistedConfig(): PersistedConfig {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PersistedConfig) : {}
  } catch {
    return {}
  }
}

function activeOpenFor(a: ActiveInfo): boolean {
  return a.availableDigital
}

export default function ConfigPanel({ balances, onStart, onClose }: Props) {
  const saved = useRef(loadPersistedConfig()).current
  const realBalances = getRealBalances(balances)
  const savedBalanceValid =
    saved.balanceId != null && realBalances.some(b => b.id === saved.balanceId)

  const [actives, setActives] = useState<ActiveInfo[]>([])
  const [activeId, setActiveId] = useState(saved.activeId ?? 0)
  const [balanceId, setBalanceId] = useState(
    savedBalanceValid ? saved.balanceId! : (realBalances[0]?.id ?? 0),
  )
  const [entryAmount, setEntryAmount] = useState(saved.entryAmount ?? '5')
  const [stopLoss, setStopLoss] = useState(saved.stopLoss ?? '50')
  const [stopWin, setStopWin] = useState(saved.stopWin ?? '50')
  const [stopConsec, setStopConsec] = useState(saved.stopConsec ?? '3')
  const [q5, setQ5] = useState(saved.q5 ?? true)
  const [alt, setAlt] = useState(saved.alt ?? true)
  const [last2, setLast2] = useState(saved.last2 ?? true)
  const [hard, setHard] = useState(saved.hard ?? false)
  const [galeEnabled, setGaleEnabled] = useState(saved.galeEnabled ?? false)
  const [galeRounds, setGaleRounds] = useState(saved.galeRounds ?? '2')
  const [sorosEnabled, setSorosEnabled] = useState(saved.sorosEnabled ?? false)
  const [sorosMaxLevel, setSorosMaxLevel] = useState(saved.sorosMaxLevel ?? '1')
  const [advancedOpen, setAdvancedOpen] = useState(false)

  useEffect(() => {
    const cfg: PersistedConfig = {
      activeId, balanceId, entryAmount, stopLoss, stopWin, stopConsec,
      q5, alt, last2, hard, galeEnabled, galeRounds, sorosEnabled, sorosMaxLevel,
    }
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(cfg))
    } catch {
      /* storage indisponível */
    }
  }, [
    activeId, balanceId, entryAmount, stopLoss, stopWin, stopConsec,
    q5, alt, last2, hard, galeEnabled, galeRounds, sorosEnabled, sorosMaxLevel,
  ])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const res = await window.manusPro.sdkActives(INSTRUMENT)
      if (cancelled) return
      if (res.ok && res.actives) setActives(res.actives)
      else setActives([])
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!actives.length) return
    const cur = actives.find(a => a.id === activeId)
    const firstAvail = actives.find(a => activeOpenFor(a))
    if (!cur || !activeOpenFor(cur)) {
      if (firstAvail) setActiveId(firstAvail.id)
      else setActiveId(actives[0].id)
    }
  }, [actives, activeId])

  useEffect(() => {
    const real = getRealBalances(balances)
    if (!real.length) return
    if (!real.some(b => b.id === balanceId)) {
      setBalanceId(real[0].id)
    }
  }, [balances, balanceId])

  function handleStart() {
    const active = actives.find(a => a.id === activeId)
    const balance = realBalances.find(b => b.id === balanceId)
    if (!validateRealBankroll(balance).ok) return
    if (!active || !activeOpenFor(active)) return
    onStart({
      activeId: active.id,
      activeTicker: active.ticker,
      instrument: INSTRUMENT,
      balanceId: Number(balanceId),
      entryAmount: Number(entryAmount) || 5,
      strategies: { q5, alt, last2, hard },
      stopLoss: Number(stopLoss) || 0,
      stopWin: Number(stopWin) || 0,
      stopConsecLosses: Number(stopConsec) || 0,
      galeEnabled,
      galeRounds: Number(galeRounds) || 2,
      sorosEnabled: FEATURE_FLAGS.SOROS_ENABLED && sorosEnabled,
      sorosMaxLevel: Math.max(1, Math.min(3, Number(sorosMaxLevel) || 1)),
    })
  }

  const anyStrategy = q5 || alt || last2 || hard
  const selectedActive = actives.find(a => a.id === activeId)
  const selectedBalance = realBalances.find(b => b.id === balanceId)
  const bankrollCheck = validateRealBankroll(selectedBalance)
  const currentCurrency = selectedBalance?.currency ?? 'BRL'
  const sym = currencySymbol(currentCurrency)

  const strategyState: Record<string, boolean> = { q5, alt, last2, hard }
  const strategySetters: Record<string, (v: boolean) => void> = {
    q5: setQ5,
    alt: setAlt,
    last2: setLast2,
    hard: setHard,
  }

  function handleToggleHard(next: boolean) {
    setHard(next)
    if (next) {
      setQ5(false)
      setAlt(false)
      setLast2(false)
    }
  }

  function handleStrategyClick(id: string) {
    const s = STRATEGIES.find(x => x.id === id)
    if (!s) return
    const active = strategyState[id]
    const next = !active
    if (s.exclusive) {
      handleToggleHard(next)
      return
    }
    if (hard) setHard(false)
    strategySetters[id](next)
  }

  const startDisabled =
    !anyStrategy ||
    !selectedActive ||
    !activeOpenFor(selectedActive) ||
    (hard && (q5 || alt || last2)) ||
    !bankrollCheck.ok ||
    realBalances.length === 0

  const galePreview = Array.from({ length: Number(galeRounds) + 1 }, (_, i) =>
    formatCurrency(Number(entryAmount || 5) * Math.pow(2, i), currentCurrency),
  ).join(' → ')

  const handleClose = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation()
    onClose()
  }, [onClose])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return createPortal(
    <div className="bot-config-overlay" onClick={handleClose} role="presentation">
      <div
        className="bot-config-sheet"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-labelledby="bot-config-title"
        aria-modal="true"
      >
        <div className="bot-config-accent" aria-hidden />

        <header className="bot-config-header">
          <div className="bot-config-header-text">
            <p className="bot-config-eyebrow">Nova sessão</p>
            <h2 id="bot-config-title" className="bot-config-title">
              Calibrar <span className="bot-config-title-manus">Manus</span> IA
            </h2>
            <p className="bot-config-sub">
              Defina mercado, entrada e proteções antes de iniciar.
            </p>
          </div>
          <button
            type="button"
            className="bot-config-close"
            onClick={handleClose}
            aria-label="Fechar"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="bot-config-body">
          <div className="bot-config-grid">
            <section className="bot-config-panel">
              <h3 className="bot-config-panel-title">Mercado</h3>

              <div className="bot-config-field">
                <span className="bot-config-label">Par de moedas</span>
                <ActiveSelect
                  actives={actives}
                  value={activeId}
                  onChange={setActiveId}
                />
              </div>

              <div className="bot-config-instrument">
                <span className="bot-config-label">Instrumento</span>
                <span className="bot-config-instrument-badge">Digital</span>
                <span className="bot-config-instrument-meta">Opções digitais · M1</span>
              </div>

              <h3 className="bot-config-panel-title bot-config-panel-title--spaced">Conta real</h3>

              {realBalances.length === 0 ? (
                <p className="bot-config-inline-warn" role="alert">
                  Nenhuma conta real encontrada. Conecte sua corretora.
                </p>
              ) : realBalances.length === 1 ? (
                <div className="bot-config-balance">
                  <span className="bot-config-balance-label">Saldo disponível</span>
                  <strong className="bot-config-balance-value">
                    {formatCurrency(realBalances[0].amount, realBalances[0].currency)}
                  </strong>
                  <span className="bot-config-balance-min">
                    Mínimo para operar: {formatCurrency(MIN_REAL_BALANCE_BRL, 'BRL')}
                  </span>
                </div>
              ) : (
                <label className="bot-config-field">
                  <span className="bot-config-label">Saldo</span>
                  <select value={balanceId} onChange={e => setBalanceId(Number(e.target.value))}>
                    {realBalances.map(b => (
                      <option key={b.id} value={b.id}>
                        Real — {formatCurrency(b.amount, b.currency)}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {!bankrollCheck.ok && realBalances.length > 0 && (
                <p className="bot-config-inline-warn" role="alert">
                  {bankrollCheck.message}
                </p>
              )}

              <label className="bot-config-field bot-config-field--compact">
                <span className="bot-config-label">Valor por entrada ({sym})</span>
                <input
                  type="number"
                  min="1"
                  value={entryAmount}
                  onChange={e => setEntryAmount(e.target.value)}
                />
              </label>
            </section>

            <section className="bot-config-panel">
              <h3 className="bot-config-panel-title">Estratégias</h3>
              <p className="bot-config-hint">Selecione uma ou mais. Prime desativa as demais.</p>

              <div className="bot-config-chips" role="group" aria-label="Estratégias">
                {STRATEGIES.map(s => {
                  const on = strategyState[s.id]
                  const disabled = !s.exclusive && hard
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={`bot-config-chip${on ? ' is-on' : ''}${disabled ? ' is-disabled' : ''}`}
                      onClick={() => !disabled && handleStrategyClick(s.id)}
                      disabled={disabled}
                      aria-pressed={on}
                    >
                      <span className="bot-config-chip-name">{s.label}</span>
                    </button>
                  )
                })}
              </div>

              {!anyStrategy && (
                <p className="bot-config-inline-warn" role="alert">
                  Escolha ao menos uma estratégia.
                </p>
              )}

              <h3 className="bot-config-panel-title bot-config-panel-title--spaced">Proteção</h3>

              <div className="bot-config-risk-grid">
                <label className="bot-config-risk-cell">
                  <span className="bot-config-label">Stop loss</span>
                  <span className="bot-config-risk-unit">{sym}</span>
                  <input
                    type="number"
                    min="0"
                    value={stopLoss}
                    onChange={e => setStopLoss(e.target.value)}
                    placeholder="0"
                  />
                </label>
                <label className="bot-config-risk-cell">
                  <span className="bot-config-label">Stop win</span>
                  <span className="bot-config-risk-unit">{sym}</span>
                  <input
                    type="number"
                    min="0"
                    value={stopWin}
                    onChange={e => setStopWin(e.target.value)}
                    placeholder="0"
                  />
                </label>
                <label className="bot-config-risk-cell">
                  <span className="bot-config-label">Losses seg.</span>
                  <span className="bot-config-risk-unit">máx</span>
                  <input
                    type="number"
                    min="0"
                    value={stopConsec}
                    onChange={e => setStopConsec(e.target.value)}
                    placeholder="0"
                  />
                </label>
              </div>
            </section>
          </div>

          <details
            className="bot-config-advanced"
            open={advancedOpen}
            onToggle={e => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
          >
            <summary className="bot-config-advanced-summary">
              <span>Opções avançadas</span>
              <span className="bot-config-advanced-chevron" aria-hidden />
            </summary>

            <div className="bot-config-advanced-body">
              <div className="bot-config-switch-row">
                <div>
                  <span className="bot-config-switch-label">Gale (martingale)</span>
                  <span className="bot-config-switch-hint">Dobra entrada após loss</span>
                </div>
                <Toggle active={galeEnabled} onChange={setGaleEnabled} />
              </div>
              {galeEnabled && (
                <div className="bot-config-advanced-fields">
                  <label className="bot-config-field bot-config-field--compact">
                    <span className="bot-config-label">Rounds máximos</span>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      value={galeRounds}
                      onChange={e => setGaleRounds(e.target.value)}
                    />
                  </label>
                  <p className="bot-config-preview">{galePreview}</p>
                </div>
              )}

              {FEATURE_FLAGS.SOROS_ENABLED && (
                <>
                  <div className="bot-config-switch-row">
                    <div>
                      <span className="bot-config-switch-label">Soros</span>
                      <span className="bot-config-switch-hint">Reinveste lucro na próxima entrada</span>
                    </div>
                    <Toggle active={sorosEnabled} onChange={setSorosEnabled} />
                  </div>
                  {sorosEnabled && (
                    <div className="bot-config-advanced-fields">
                      <label className="bot-config-field bot-config-field--compact">
                        <span className="bot-config-label">Níveis (máx. 3)</span>
                        <input
                          type="number"
                          min="1"
                          max="3"
                          value={sorosMaxLevel}
                          onChange={e => setSorosMaxLevel(e.target.value)}
                        />
                      </label>
                    </div>
                  )}
                </>
              )}
            </div>
          </details>
        </div>

        <footer className="bot-config-footer">
          <button
            type="button"
            className="btn-start bot-config-start"
            onClick={handleStart}
            disabled={startDisabled}
          >
            Iniciar bot
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}

function Toggle({ active, onChange }: { active: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      className={`bot-config-toggle${active ? ' is-on' : ''}`}
      onClick={() => onChange(!active)}
    >
      <span className="bot-config-toggle-knob" />
    </button>
  )
}

function ActiveSelect({
  actives,
  value,
  onChange,
}: {
  actives: ActiveInfo[]
  value: number
  onChange: (id: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const selected = actives.find(a => a.id === value) ?? null

  useEffect(() => {
    if (!open) return

    function closeOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    requestAnimationFrame(() => searchRef.current?.focus())
    return () => {
      document.removeEventListener('mousedown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const normalizedQuery = query.trim().toUpperCase()
  const matches = (active: ActiveInfo) =>
    !normalizedQuery || active.ticker.toUpperCase().includes(normalizedQuery)
  const openMarket = actives.filter(a => !a.isOtc && matches(a))
  const otcMarket = actives.filter(a => a.isOtc && matches(a))

  function pick(active: ActiveInfo) {
    if (!activeOpenFor(active)) return
    onChange(active.id)
    setOpen(false)
    setQuery('')
  }

  function renderOption(active: ActiveInfo, otc: boolean) {
    const available = activeOpenFor(active)
    const isSelected = active.id === value

    return (
      <li
        key={active.id}
        role="option"
        aria-selected={isSelected}
        aria-disabled={!available}
        className={`asset-option${isSelected ? ' active' : ''}${available ? '' : ' disabled'}`}
        onClick={() => pick(active)}
      >
        <span className="asset-ticker">
          {active.ticker}{otc ? ' (OTC)' : ''}
        </span>
        {available ? (
          isSelected && <span className="asset-check" aria-hidden>✓</span>
        ) : (
          <span className="asset-closed">Fechado</span>
        )}
      </li>
    )
  }

  return (
    <div className={`asset-select${open ? ' open' : ''}`} ref={ref}>
      <button
        type="button"
        className="asset-trigger"
        onClick={() => setOpen(current => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="asset-trigger-label">
          {selected
            ? `${selected.ticker}${selected.isOtc ? ' (OTC)' : ''}`
            : 'Selecione o ativo'}
        </span>
        <span className="asset-chevron" aria-hidden />
      </button>

      {open && (
        <div className="asset-menu">
          <div className="asset-search-wrap">
            <input
              ref={searchRef}
              type="search"
              className="asset-search"
              placeholder="Buscar par de moedas…"
              value={query}
              onChange={event => setQuery(event.target.value)}
            />
          </div>
          <ul className="asset-list" role="listbox">
            {openMarket.length > 0 && (
              <>
                <li className="asset-group-label" aria-hidden>Mercado aberto</li>
                {openMarket.map(active => renderOption(active, false))}
              </>
            )}
            {otcMarket.length > 0 && (
              <>
                <li className="asset-group-label" aria-hidden>OTC</li>
                {otcMarket.map(active => renderOption(active, true))}
              </>
            )}
            {openMarket.length === 0 && otcMarket.length === 0 && (
              <li className="asset-empty">Nenhum ativo encontrado</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

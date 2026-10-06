import type { BotStatus } from '../types'
import { currencySymbol, formatCurrency } from '../lib/currency'

interface Props {
  status: BotStatus | null
  activeBalance: number
  currency?: string
}

function formatAmount(value: number, currency: string): string {
  const loc = currency.toUpperCase() === 'BRL' ? 'pt-BR' : 'en-US'
  return Math.abs(value).toLocaleString(loc, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default function ScoreBoard({ status, activeBalance, currency = 'USD' }: Props) {
  const pnl = status?.totalPnl ?? 0
  const wins = status?.wins ?? 0
  const losses = status?.losses ?? 0
  const winRate = status?.winRate ?? 0
  const total = wins + losses
  const balanceCurrent = activeBalance || status?.balanceCurrent || 0
  const pnlTone = pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'neutral'
  const winShare = total > 0 ? Math.round((wins / total) * 100) : 50

  return (
    <aside className="score-card" aria-label="Resumo da sessão">
      <div className="score-card-accent" aria-hidden />

      <div className="score-card-top">
        <div className="score-card-heading">
          <span className="score-card-eyebrow">Sessão</span>
          <span className="score-card-kicker">Resultado ao vivo</span>
        </div>
        {status?.running ? (
          <span className="score-card-live">
            <span className="score-card-live-dot" aria-hidden />
            Ao vivo
          </span>
        ) : (
          <span className="score-card-idle">Em espera</span>
        )}
      </div>

      <p className={`score-card-pnl score-card-pnl--${pnlTone}`}>
        <span className="score-card-pnl-sign">{pnl >= 0 ? '+' : '−'}</span>
        <span className="score-card-pnl-sym">{currencySymbol(currency)}</span>
        <span className="score-card-pnl-value">{formatAmount(pnl, currency)}</span>
      </p>

      <div className="score-card-meter" aria-hidden>
        <div className="score-card-meter-track">
          <div className="score-card-meter-fill" style={{ width: `${winShare}%` }} />
        </div>
        <div className="score-card-meter-meta">
          <span>W {wins}</span>
          <span>{winRate}% acerto</span>
          <span>L {losses}</span>
        </div>
      </div>

      <ul className="score-card-stats">
        <li>
          <span className="score-card-stat-val score-card-stat-val--win">{wins}</span>
          <span className="score-card-stat-lbl">Vitórias</span>
        </li>
        <li>
          <span className="score-card-stat-val score-card-stat-val--loss">{losses}</span>
          <span className="score-card-stat-lbl">Derrotas</span>
        </li>
      </ul>

      {balanceCurrent > 0 && (
        <div className="score-card-balance">
          <span className="score-card-balance-lbl">Saldo</span>
          <strong className="score-card-balance-val">
            {formatCurrency(balanceCurrent, currency)}
          </strong>
        </div>
      )}
    </aside>
  )
}

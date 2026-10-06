import type { TradeRecord } from '../types'
import { formatCurrency } from '../lib/currency'
import { strategyLabel } from '../lib/strategies'

interface Props {
  trades: TradeRecord[]
  currency?: string
}

function timeStr(ms: number): string {
  return new Date(ms).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function resultLabel(result: TradeRecord['result']): string {
  if (result === 'PENDING') return 'Pendente'
  if (result === 'WIN') return 'Vitória'
  return 'Derrota'
}

export default function TradeLog({ trades, currency = 'USD' }: Props) {
  return (
    <section className="tradelog" aria-label="Operações da sessão">
      <header className="tradelog-header">
        <span className="tradelog-title">Operações</span>
        {trades.length > 0 && (
          <span className="tradelog-count">{trades.length}</span>
        )}
      </header>

      <div className="tradelog-body">
        {trades.length === 0 ? (
          <div className="tradelog-empty">
            <span className="tradelog-empty-mark" aria-hidden />
            <p>Nenhuma operação ainda</p>
            <span>As entradas da sessão aparecem aqui</span>
          </div>
        ) : (
          <ul className="tradelog-list">
            {trades.map((t) => {
              const tone = t.result.toLowerCase()
              return (
                <li key={t.id} className={`trade-row trade-row--${tone}`}>
                  <span className="trade-row-rail" aria-hidden />

                  <div className="trade-main">
                    <div className="trade-meta">
                      <span className={`direction-badge direction-badge--${t.direction.toLowerCase()}`}>
                        {t.direction}
                      </span>
                      <span className="strategy-tag">{strategyLabel(t.strategy)}</span>
                      <span className={`result-tag result-tag--${tone}`}>
                        <span className="result-tag-dot" aria-hidden />
                        {resultLabel(t.result)}
                      </span>
                    </div>

                    <div className="trade-aside">
                      {t.result !== 'PENDING' ? (
                        <span className={`profit-val profit-val--${t.profit >= 0 ? 'win' : 'loss'}`}>
                          {t.profit >= 0 ? '+' : ''}
                          {formatCurrency(t.profit, currency)}
                        </span>
                      ) : (
                        <span className="profit-val profit-val--pending">Em aberto</span>
                      )}
                      <time className="trade-time" dateTime={new Date(t.enteredAt).toISOString()}>
                        {timeStr(t.enteredAt)}
                      </time>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}

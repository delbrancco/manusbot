import { useRef, useEffect, useState } from 'react'

const STORAGE_KEY = 'manuspro_log_open'

interface Props {
  logs: string[]
}

function readStoredOpen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export default function LogConsole({ logs }: Props) {
  const [open, setOpen] = useState(readStoredOpen)
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(logs.length)

  useEffect(() => {
    if (!open) return
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs, open])

  useEffect(() => {
    if (open) prevCountRef.current = logs.length
  }, [open, logs.length])

  const newWhileClosed = !open && logs.length > prevCountRef.current
    ? logs.length - prevCountRef.current
    : 0

  function toggle() {
    setOpen((v) => {
      const next = !v
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      if (next) prevCountRef.current = logs.length
      return next
    })
  }

  return (
    <div className={`log-console${open ? ' log-console--open' : ' log-console--closed'}`}>
      <button
        type="button"
        className="log-console-toggle"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="log-console-body"
      >
        <span className="log-console-toggle-label">Log</span>
        {newWhileClosed > 0 && (
          <span className="log-console-badge" aria-label={`${newWhileClosed} novas linhas`}>
            {newWhileClosed > 99 ? '99+' : newWhileClosed}
          </span>
        )}
        {!open && logs.length > 0 && newWhileClosed === 0 && (
          <span className="log-console-hint">{logs.length} linhas</span>
        )}
        <svg
          className="log-console-chevron"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div id="log-console-body" className="log-console-body">
          {logs.length === 0 ? (
            <p className="log-console-empty">Nenhum evento ainda.</p>
          ) : (
            [...logs].reverse().map((line, i) => {
              const isWin = line.includes('WIN') || line.includes('✅')
              const isLoss = line.includes('LOSS') || line.includes('❌')
              const isStop = line.includes('Stop') || line.includes('🛑') || line.includes('🏆')
              const isEntry = line.includes('ENTRADA') || line.includes('📍')
              return (
                <div
                  key={i}
                  className={`log-line ${isWin ? 'win' : isLoss ? 'loss' : isStop ? 'warning' : isEntry ? 'entry' : ''}`}
                >
                  {line}
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  )
}

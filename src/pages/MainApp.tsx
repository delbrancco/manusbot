import { useState } from 'react'
import Operacoes from './Operacoes'
import Aulas from './Aulas'
import Suporte from './Suporte'
import NotificationBell from '../components/NotificationBell'
import sidebarLogoIcon from '../../img/logo icone.png'

type Tab = 'aulas' | 'operacoes' | 'suporte'

interface Props { onLogout: () => void | Promise<void> }

function IconAulas({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8 7h8M8 11h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function IconOperacoes({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="7" height="18" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="14" y="8" width="7" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.5 21V3M16.5 21V8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function IconSuporte({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 15a2 2 0 0 1-2 2H7l-4 3v-3H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h15a2 2 0 0 1 2 2v9z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function IconLogout({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SidebarLogoMark() {
  return (
    <div className="sidebar-brand" title="MANUS IA">
      <div className="sidebar-logo-mark">
        <img
          src={sidebarLogoIcon}
          alt=""
          className="sidebar-logo-img"
          draggable={false}
        />
      </div>
      <div className="sidebar-brand-text" aria-label="MANUS IA">
        <span className="sidebar-brand-manus">MANUS</span>
        <span className="sidebar-brand-ia">IA</span>
      </div>
    </div>
  )
}

const NAV: { id: Tab; label: string; icon: typeof IconAulas }[] = [
  { id: 'aulas', label: 'Aulas', icon: IconAulas },
  { id: 'operacoes', label: 'Operações', icon: IconOperacoes },
  { id: 'suporte', label: 'Suporte', icon: IconSuporte },
]

export default function MainApp({ onLogout }: Props) {
  const [tab, setTab] = useState<Tab>('operacoes')
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      try {
        await window.manusPro?.brokerLogout?.()
      } catch {
        /* best-effort */
      }
      await onLogout()
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <div className="mainapp members-shell members-shell--bottom-nav">
      <div className="members-main">
        <div className="mainapp-body">
          <div className="tab-panel" style={{ display: tab === 'aulas' ? 'contents' : 'none' }}>
            <Aulas />
          </div>
          <div className="tab-panel" style={{ display: tab === 'operacoes' ? 'contents' : 'none' }}>
            <Operacoes />
          </div>
          <div className="tab-panel" style={{ display: tab === 'suporte' ? 'contents' : 'none' }}>
            <Suporte />
          </div>
        </div>
      </div>

      <aside className="members-sidebar members-sidebar--bottom" aria-label="Barra inferior">
        <div className="members-sidebar-pill members-sidebar-pill--floating members-sidebar-pill--bottom">
          <div className="sidebar-zone sidebar-zone--brand">
            <SidebarLogoMark />
          </div>

          <nav className="sidebar-zone sidebar-zone--nav" aria-label="Secções">
            {NAV.map(({ id, label, icon: Icon }) => {
              const active = tab === id
              const isCta = id === 'operacoes'
              return (
                <button
                  key={id}
                  type="button"
                  title={label}
                  className={[
                    'sidebar-nav-btn',
                    isCta ? 'sidebar-nav-btn--operacoes' : '',
                    active ? 'active' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => setTab(id)}
                >
                  <span className="sidebar-nav-iconWrap">
                    <Icon className="sidebar-nav-icon" />
                  </span>
                  <span className="sidebar-nav-label">{label}</span>
                </button>
              )
            })}
          </nav>

          <div className="sidebar-zone sidebar-zone--footer">
            <div className="sidebar-actions">
              <div className="sidebar-account-chip" title="Conta conectada">
                <span className="sidebar-account-avatar" aria-hidden>M</span>
                <span className="sidebar-account-meta">
                  <span className="sidebar-account-kicker">Corretora</span>
                  <span className="sidebar-account-name">Broker10</span>
                </span>
              </div>

              <span className="sidebar-actions-divider" aria-hidden />

              <div className="sidebar-actions-tools">
                <div className="sidebar-notify-slot">
                  <NotificationBell />
                </div>
                <button
                  type="button"
                  className="sidebar-icon-btn sidebar-icon-btn--logout"
                  onClick={() => void handleLogout()}
                  disabled={loggingOut}
                  aria-label="Sair"
                  title="Sair"
                >
                  <IconLogout className="sidebar-icon-btn-svg" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}

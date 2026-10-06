// ════════════════════════════════════════════════════════════════════
// LicenseGate — pede e-mail no primeiro contato (qualquer e-mail válido).
// ════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import logoIcon from '../../img/logo icone.png'
import { LICENSE_STORAGE_KEY } from '../lib/auth-storage'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../feature-flags'

interface Props {
  onAuthorized: (email: string) => void
}

async function verifyLicenseEmail(email: string): Promise<{ authorized: boolean; message?: string }> {
  let appVersion = 'unknown'
  try {
    const v = await window.manusPro?.appGetVersion?.()
    if (v?.version) appVersion = v.version
  } catch {
    /* ignore */
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-license`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, app_version: appVersion }),
  })

  const data = await res.json().catch(() => ({})) as { authorized?: boolean; message?: string }
  if (!res.ok || !data.authorized) {
    return { authorized: false, message: data.message ?? 'Acesso não autorizado.' }
  }
  return { authorized: true, message: data.message }
}

function LogoMark() {
  return (
    <img
      src={logoIcon}
      alt=""
      className="lic-gate-logo"
      draggable={false}
      aria-hidden
    />
  )
}

function IconEnvelope() {
  return (
    <svg className="lic-gate-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function BrandHeader({ subtitle }: { subtitle?: string }) {
  return (
    <header className="lic-gate-header">
      <div className="lic-gate-logo-wrap">
        <LogoMark />
      </div>
      <h1 className="lic-gate-title">
        <span className="lic-gate-title-manus">MANUS</span>
        <span className="lic-gate-title-pro">IA</span>
      </h1>
      {subtitle ? <p className="lic-gate-sub">{subtitle}</p> : null}
    </header>
  )
}

function PremiumShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="lic-gate-page premium-auth-page">
      <div className="lic-gate-grid premium-auth-grid" aria-hidden />
      <div className="lic-gate-glow premium-auth-glow" aria-hidden />
      <div className="premium-auth-orb premium-auth-orb--a" aria-hidden />
      <div className="premium-auth-orb premium-auth-orb--b" aria-hidden />
      {children}
    </div>
  )
}

export default function LicenseGate({ onAuthorized }: Props) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkingCache, setCheckingCache] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem(LICENSE_STORAGE_KEY)
    if (saved) {
      void validateEmail(saved, true)
    } else {
      setCheckingCache(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function validateEmail(emailToCheck: string, silent = false) {
    if (!silent) setLoading(true)
    setError(null)

    const trimmed = emailToCheck.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      setCheckingCache(false)
      if (!silent) setError('Email inválido.')
      setLoading(false)
      return
    }

    try {
      const license = await verifyLicenseEmail(trimmed)
      if (!license.authorized) {
        localStorage.removeItem(LICENSE_STORAGE_KEY)
        setCheckingCache(false)
        if (!silent) setError(license.message ?? 'Acesso não autorizado.')
        return
      }

      localStorage.setItem(LICENSE_STORAGE_KEY, trimmed)
      try {
        await window.manusPro?.setUserEmail?.(trimmed)
      } catch {
        /* ignore */
      }
      onAuthorized(trimmed)
    } catch {
      localStorage.removeItem(LICENSE_STORAGE_KEY)
      setCheckingCache(false)
      if (!silent) {
        setError('Erro ao continuar. Tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) {
      setError('Digite um e-mail válido.')
      return
    }
    void validateEmail(trimmed)
  }

  if (checkingCache) {
    return (
      <PremiumShell>
        <div className="lic-gate-card premium-auth-card" role="status" aria-live="polite">
          <div className="lic-gate-accent premium-auth-accent" aria-hidden />
          <BrandHeader />
          <div className="lic-gate-loading">
            <div className="lic-gate-spinner" />
            <p>Preparando seu acesso…</p>
          </div>
        </div>
      </PremiumShell>
    )
  }

  return (
    <PremiumShell>
      <form className="lic-gate-card premium-auth-card" onSubmit={handleSubmit}>
        <div className="lic-gate-accent premium-auth-accent" aria-hidden />

        <BrandHeader subtitle="Digite seu e-mail para continuar." />

        <div className="lic-gate-fields">
          <label className="lic-gate-label" htmlFor="lic-email">E-mail</label>
          <div className="lic-gate-input-wrap">
            <IconEnvelope />
            <input
              id="lic-email"
              type="email"
              className="lic-gate-input"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="email"
              autoFocus
            />
          </div>
        </div>

        {error && (
          <div className="lic-gate-alert" role="alert">
            {error}
          </div>
        )}

        <button type="submit" className="lic-gate-submit" disabled={loading || !email.trim()}>
          {loading ? (
            'Entrando…'
          ) : (
            <>
              Continuar
              <svg className="lic-gate-submit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </>
          )}
        </button>
      </form>
    </PremiumShell>
  )
}

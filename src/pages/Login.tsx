import { useState, useEffect, useRef } from 'react'
import logoIcon from '../../img/logo icone.png'

interface Props { onLoggedIn: () => void }
type Step = 'idle' | 'waiting_code' | 'connecting'

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

export default function Login({ onLoggedIn }: Props) {
  const [step, setStep] = useState<Step>('idle')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)

  const onLoggedInRef = useRef(onLoggedIn)
  onLoggedInRef.current = onLoggedIn

  useEffect(() => {
    const unsubOk = window.manusPro.on('broker:connected', () => {
      console.log('[LOGIN] broker:connected recebido!')
      setIsConnecting(false)
      onLoggedInRef.current()
    })
    const unsubErr = window.manusPro.on('broker:error', (msg: string) => {
      console.error('[LOGIN] broker:error:', msg)
      setIsConnecting(false)
      setError(typeof msg === 'string' ? msg : String(msg))
      setStep('waiting_code')
    })

    void window.manusPro.brokerIsConnected().then((res) => {
      if (res.connected) {
        console.log('[LOGIN] broker já conectado ao montar — avançando')
        onLoggedInRef.current()
      }
    })

    return () => {
      unsubOk()
      unsubErr()
    }
  }, [])

  async function handleLogin() {
    setIsConnecting(true)
    setError('')
    const res = await window.manusPro.brokerStartAuth()
    if (!res.ok) {
      console.error('Erro ao iniciar auth:', res.error)
      setIsConnecting(false)
      setError(res.error ?? 'Não foi possível abrir o login da Broker10')
      return
    }
    // Mantém spinner enquanto a janela interna da corretora está aberta.
    // waiting_code só aparece se o callback falhar (fallback de colar URL).
    setStep('waiting_code')
  }

  async function handleCode() {
    if (!code.trim()) return setError('Cole a URL de retorno completa')
    setError('')
    setStep('connecting')

    const ex = await window.manusPro.brokerExchangeCode(code.trim())
    if (!ex.ok) {
      setError(ex.error ?? 'Não foi possível concluir a autenticação')
      setStep('waiting_code')
      return
    }

    onLoggedIn()
  }

  return (
    <div className="login-page premium-auth-page">
      <div className="lic-gate-grid premium-auth-grid" aria-hidden />
      <div className="lic-gate-glow premium-auth-glow" aria-hidden />
      <div className="premium-auth-orb premium-auth-orb--a" aria-hidden />
      <div className="premium-auth-orb premium-auth-orb--b" aria-hidden />

      <div className={`login-card premium-auth-card${isConnecting ? ' login-card-loading' : ''}`}>
        <div className="lic-gate-accent premium-auth-accent" aria-hidden />

        {isConnecting ? (
          <div className="login-loading">
            <div className="lic-gate-spinner" aria-hidden />
            <h2>Conectando ao Broker10</h2>
            <p>Faça login na janela que abriu. Não feche o aplicativo.</p>
          </div>
        ) : (
          <>
            <header className="lic-gate-header">
              <div className="lic-gate-logo-wrap">
                <LogoMark />
              </div>
              <p className="lic-gate-badge">Corretora integrada</p>
              <h1 className="lic-gate-title">
                <span className="lic-gate-title-manus">MANUS</span>
                <span className="lic-gate-title-pro">IA</span>
              </h1>
              <p className="lic-gate-sub login-tagline">
                O futuro das operações em opções binárias
              </p>
            </header>

            {step === 'idle' && (
              <>
                <p className="login-desc">
                  Conecte sua conta Broker10 para acessar a plataforma.
                </p>
                {error && <div className="lic-gate-alert login-error">{error}</div>}
                <button type="button" className="lic-gate-submit btn-broker" onClick={handleLogin}>
                  Entrar com Broker10
                  <svg className="lic-gate-submit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </>
            )}

            {step === 'waiting_code' && (
              <>
                <p className="login-desc">
                  Se o app não avançar sozinho após o login na janela da Broker10, cole aqui a URL
                  completa da barra de endereços. Cada link só funciona uma vez.
                </p>
                <div className="lic-gate-fields">
                  <label className="lic-gate-label" htmlFor="broker-callback">URL de retorno</label>
                  <div className="lic-gate-input-wrap">
                    <input
                      id="broker-callback"
                      className="lic-gate-input"
                      value={code}
                      onChange={e => setCode(e.target.value)}
                      placeholder="https://claudepro.online/metacode/auth/callback?code=..."
                      autoFocus
                    />
                  </div>
                </div>
                {error && <div className="lic-gate-alert login-error">{error}</div>}
                <button type="button" className="lic-gate-submit btn-broker" onClick={handleCode}>
                  Continuar
                </button>
                <button
                  type="button"
                  className="btn-ghost login-back"
                  onClick={() => { setIsConnecting(false); setStep('idle'); setCode(''); setError('') }}
                >
                  ← Voltar
                </button>
              </>
            )}

            {step === 'connecting' && (
              <div className="login-connecting">
                <div className="lic-gate-spinner" />
                <p>Conectando à Broker10…</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

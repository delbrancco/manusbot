// ════════════════════════════════════════════════════════════════════
// Feature flags — espelho de electron/main/feature-flags.ts.
// Mantenha os dois arquivos em sincronia ao mudar valores.
// ════════════════════════════════════════════════════════════════════

export const FEATURE_FLAGS = {
  /** ⚠️ MUDAR PARA true QUANDO FOR COMERCIALIZAR. */
  LOGIN_REQUIRED: false,
  /** Gate Misespay — exige email com Manusia pago antes do login Broker10. */
  LICENSE_REQUIRED: true,
  /** Gate Broker10 — exige login na corretora após validar licença. */
  BROKER10_AUTH_REQUIRED: true,
  TELEMETRY_ENABLED: true,
  NOTIFICATIONS_ENABLED: true,
  UPDATE_CHECK_ENABLED: true,
  /** Soros (reinvestimento em cadeia). Mudar para true para reativar. */
  SOROS_ENABLED: false,
  /** Fase A — auth Broker10 via Edge Functions (desligado; login local permanece padrão). */
  USE_EDGE_AUTH: true,
}

/** Backend Railway (MANUS IA / delnyx). Supabase antigo permanece intacto para builds antigos. */
export const SUPABASE_URL = 'https://api-edge-production-873f.up.railway.app'
export const SUPABASE_ANON_KEY = 'sb_publishable_D7wIdZwqPZg8pvyJMYxs-A_JiZ4KeeM'

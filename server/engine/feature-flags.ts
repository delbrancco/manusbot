// ════════════════════════════════════════════════════════════════════
// Feature flags — DUPLICADAS também em src/feature-flags.ts.
// Mantenha os dois arquivos em sincronia ao mudar valores.
// (Electron main e renderer não compartilham módulos por padrão
// neste setup; um dia migramos pra um pacote shared, mas por ora
// a duplicação é só 6 linhas e evita refactor.)
// ════════════════════════════════════════════════════════════════════

export const FEATURE_FLAGS = {
  /** ⚠️ MUDAR PARA true QUANDO FOR COMERCIALIZAR.
   *  Enquanto false: app abre direto, sem login Supabase.
   *  Telemetria fica em arquivo JSON local.
   *  Notificações ficam escondidas.
   *  Credenciais Broker10 continuam em config.ts. */
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

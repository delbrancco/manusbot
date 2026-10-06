/**
 * BROKER CONFIGURATION (público / não-secreto).
 * client_secret NÃO fica no app — só no Railway (app_secrets / env).
 * USE_EDGE_AUTH=true: exchange/refresh via Edge.
 */
export const BROKER_CONFIG = {
  clientId:     350522037064121,
  /** Removido do bundle — OAuth secret só no Railway. */
  clientSecret: '',
  platformId:   482,
  wsUrl:        'wss://ws.trade.broker10.com/echo/websocket',
  apiUrl:       'https://api.trade.broker10.com',
  redirectUri:  'https://claudepro.online/metacode/auth/callback',
  scope:        'full offline_access',
}

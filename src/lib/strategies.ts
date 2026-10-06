/** Nomes internos do bot → rótulos exibidos na UI. */
const STRATEGY_LABELS: Record<string, string> = {
  q5: 'FT5',
  Q5: 'FT5',
  alt: 'Opostos',
  ALT: 'Opostos',
  last2: 'P2',
  LAST2: 'P2',
  hard: 'Prime',
  HARD: 'Prime',
}

export function strategyLabel(name: string | null | undefined): string {
  if (!name) return ''
  return STRATEGY_LABELS[name] ?? name
}

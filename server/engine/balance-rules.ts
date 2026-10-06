/** Validação de banca real — espelho de src/lib/balance-rules.ts (sem importar src/ no Electron). */

export const MIN_REAL_BALANCE_BRL = 60

export interface RealBalanceCheck {
  id: number
  amount: number
  currency: string
  type: 'real' | 'demo'
}

function formatBrl(value: number): string {
  const abs = Math.abs(value)
  return `R$ ${abs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function validateRealBankroll(
  balance: RealBalanceCheck | undefined,
): { ok: true } | { ok: false; message: string } {
  if (!balance || balance.type !== 'real') {
    return { ok: false, message: 'Conta real não encontrada. Conecte sua corretora.' }
  }
  if (balance.currency.toUpperCase() !== 'BRL') {
    return { ok: false, message: 'O bot opera apenas com conta real em reais (BRL).' }
  }
  if (balance.amount < MIN_REAL_BALANCE_BRL) {
    return {
      ok: false,
      message: `Saldo mínimo de ${formatBrl(MIN_REAL_BALANCE_BRL)} para iniciar. Disponível: ${formatBrl(balance.amount)}.`,
    }
  }
  return { ok: true }
}

export function assertRealBankroll(balance: RealBalanceCheck | undefined): void {
  const result = validateRealBankroll(balance)
  if (!result.ok) throw new Error(result.message)
}

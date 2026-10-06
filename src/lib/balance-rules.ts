import type { BalanceInfo } from '../types'
import { formatCurrency } from './currency'

export const MIN_REAL_BALANCE_BRL = 60

export function getRealBalances(balances: BalanceInfo[]): BalanceInfo[] {
  return balances.filter(b => b.type === 'real')
}

export function validateRealBankroll(
  balance: BalanceInfo | undefined,
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
      message: `Saldo mínimo de ${formatCurrency(MIN_REAL_BALANCE_BRL, 'BRL')} para iniciar. Disponível: ${formatCurrency(balance.amount, 'BRL')}.`,
    }
  }
  return { ok: true }
}

export function assertRealBankroll(balance: BalanceInfo | undefined): void {
  const result = validateRealBankroll(balance)
  if (!result.ok) throw new Error(result.message)
}

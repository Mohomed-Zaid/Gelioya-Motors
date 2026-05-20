export function formatCurrency(amount: number): string {
  return `Rs. ${Number(amount).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function parseCurrencyInput(value: string): number {
  const cleaned = value.replace(/[^0-9.]/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

export function formatNumberInput(value: string): string {
  if (value === '' || value === undefined || value === null) return ''
  const parts = value.split('.')
  const intPart = parts[0].replace(/[^0-9]/g, '')
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  if (parts.length > 1) {
    const decPart = parts[1].replace(/[^0-9]/g, '').slice(0, 2)
    return decPart ? `${formatted}.${decPart}` : `${formatted}.`
  }
  return formatted
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

export function tomorrowISO(): string {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return tomorrow.toISOString().split('T')[0]
}

export function generateInvoiceNumber(prefix: string, seq: number): string {
  const date = new Date()
  const yy = String(date.getFullYear()).slice(-2)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const num = String(seq).padStart(4, '0')
  return `${prefix}${yy}${mm}-${num}`
}

export function getMonthRange(date: Date): { start: string; end: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1).toISOString()
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59).toISOString()
  return { start, end }
}

export function formatChequeNumber(value: string): string {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '')
  // Format as XXXXXX-XXXX-XXX (6-4-3)
  if (digits.length <= 6) return digits
  if (digits.length <= 10) return `${digits.slice(0, 6)}-${digits.slice(6)}`
  return `${digits.slice(0, 6)}-${digits.slice(6, 10)}-${digits.slice(10, 13)}`
}

export function parseChequeNumber(value: string): string {
  return value.replace(/\D/g, '')
}

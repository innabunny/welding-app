/**
 * Числа DecimalField ходят строками с точкой: "132.5".
 * Здесь — проверка ввода под разрядность поля и округление.
 */

export interface DecimalLimits {
  /** max_digits: всего цифр */
  digits: number
  /** decimal_places: цифр после точки */
  places: number
  negative?: boolean
}

/** «12,5» → «12.5». Остальное не трогаем — решает fitsDecimal */
export function normalizeDecimal(text: string): string {
  return text.trim().replace(',', '.')
}

/** Годится ли недописанный ввод: «», «-», «12.», «12.5» — да; «1a», «1.2.3» — нет */
export function fitsDecimal(text: string, { digits, places, negative }: DecimalLimits): boolean {
  const pattern = places > 0 ? /^(-?)(\d*)(?:\.(\d*))?$/ : /^(-?)(\d*)$/
  const m = pattern.exec(text)
  if (!m) return false
  const [, minus = '', int = '', frac = ''] = m
  if (minus && !negative) return false
  if (frac.length > places) return false
  // ведущие нули разрядность не занимают
  return int.replace(/^0+(?=\d)/, '').length <= digits - places
}

/** Округление до places знаков; пусто и «-» → null */
export function roundDecimal(text: string | null, places: number): string | null {
  if (text === null) return null
  const v = normalizeDecimal(text)
  if (v === '' || v === '-' || v === '.' || v === '-.') return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return n.toFixed(places)
}

/** Для поля ввода: точка → запятая, как привычно в русской раскладке */
export function displayDecimal(value: string | null | undefined): string {
  return value ? value.replace('.', ',') : ''
}

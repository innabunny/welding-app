/** «11,8» → «11.8»; пусто → null. Не число — вернётся как есть, его поймает validate */
export function toDecimal(value: string | null): string | null {
  const v = (value ?? '').trim().replace(',', '.')
  return v === '' ? null : v
}

export function isBadDecimal(value: string | null): boolean {
  const v = toDecimal(value)
  return v !== null && !(Number.isFinite(Number(v)) && Number(v) > 0)
}

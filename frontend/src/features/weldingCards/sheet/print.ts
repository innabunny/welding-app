/**
 * Печать через отдельное окно, а не window.print() на странице:
 * у приложения свои стили скролла и раскладки, они режут документ.
 */

/** Вырезает все блоки @media print { … } с учётом вложенных скобок */
export function stripPrintMedia(css: string): string {
  let out = ''
  let i = 0
  const re = /@media\s+print\b[^{]*\{/g
  let m: RegExpExecArray | null
  while ((m = re.exec(css)) !== null) {
    out += css.slice(i, m.index)
    let depth = 1
    let j = m.index + m[0].length
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++
      else if (css[j] === '}') depth--
      j++
    }
    i = j
    re.lastIndex = j
  }
  return out + css.slice(i)
}

// без этого глобальный overflow: hidden (он нужен для скролла приложения)
// обрезает документ после первого листа
const PRINT_FIX = 'html, body { height: auto !important; overflow: visible !important; margin: 0; background: #fff; }'

export function printSheet(element: HTMLElement, css: string, title: string): boolean {
  const win = window.open('', '_blank', 'width=1100,height=800')
  if (!win) return false

  const doc = win.document
  doc.open()
  doc.write('<!doctype html><html lang="ru"><head><meta charset="utf-8"></head><body></body></html>')
  doc.close()
  doc.title = title

  const style = doc.createElement('style')
  style.textContent = `${stripPrintMedia(css)}\n${PRINT_FIX}`
  doc.head.appendChild(style)
  doc.body.appendChild(doc.importNode(element, true))

  // дать браузеру разложить страницу и шрифты, потом печатать
  // окно закрываем по afterprint: в Safari print() не ждёт закрытия диалога
  win.addEventListener('afterprint', () => win.close())
  win.focus()
  win.setTimeout(() => win.print(), 250)
  return true
}

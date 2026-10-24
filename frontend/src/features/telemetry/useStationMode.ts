import { useState } from 'react'

// localStorage здесь — мелкое удобство, как выбранная вкладка: данные не хранит
const KEY = 'telemetry-station-mode'

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Режим у станка: тёмный фон и крупные цифры, чтобы читать
 * с расстояния. Только для экрана аппарата, тема портала не меняется.
 */
export function useStationMode(): [boolean, () => void] {
  const [on, setOn] = useState(read)
  const toggle = () => {
    setOn((prev) => {
      const next = !prev
      try {
        localStorage.setItem(KEY, next ? '1' : '0')
      } catch {
        // хранилище запрещено — режим просто не запомнится
      }
      return next
    })
  }
  return [on, toggle]
}

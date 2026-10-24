import { useEffect, useState } from 'react'

/** Текущее время, обновляемое раз в intervalMs: для секундомеров и «давно ли пришло» */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { logout } from '@/shared/api/auth'
import { useSession } from '@/shared/api/session'

export function useLogout() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const clear = useSession((s) => s.clear)

  return async () => {
    try {
      await logout()
    } catch {
      // токен мог уже протухнуть — выходим всё равно
    }
    clear()
    queryClient.clear()
    navigate('/login', { replace: true })
  }
}

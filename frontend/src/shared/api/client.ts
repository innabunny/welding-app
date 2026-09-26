import axios, { AxiosError } from 'axios'
import { useSession } from './session'

export const LOGIN_URL = '/auth/login/'
export const LOGIN_PAGE = '/login'

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = useSession.getState().token
  if (token) config.headers.Authorization = `Token ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    // неверный пароль на самом входе — тоже 401, его показывает форма
    const isLoginRequest = error instanceof AxiosError && error.config?.url === LOGIN_URL
    if (error instanceof AxiosError && error.response?.status === 401 && !isLoginRequest) {
      useSession.getState().clear()
      if (window.location.pathname !== LOGIN_PAGE) {
        const next = window.location.pathname + window.location.search
        window.location.assign(`${LOGIN_PAGE}?next=${encodeURIComponent(next)}`)
      }
    }
    return Promise.reject(error)
  },
)

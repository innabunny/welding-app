import type { LoginRequest, LoginResponse } from '@/shared/types/auth'
import { api, LOGIN_URL } from './client'

export async function login(body: LoginRequest): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>(LOGIN_URL, body)
  return data
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout/')
}

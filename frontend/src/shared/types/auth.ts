export type UserRole = 'admin' | 'master' | 'mechanic' | 'technologist' | 'inspector' | ''

export interface User {
  id: number
  login: string
  name: string
  role: UserRole
  active: boolean
  workshopId: number | null
}

export interface LoginRequest {
  login: string
  password: string
}

export interface LoginResponse {
  token: string
  user: User
}

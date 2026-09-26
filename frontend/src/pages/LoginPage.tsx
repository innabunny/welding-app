import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { login } from '@/shared/api/auth'
import { errorMessage } from '@/shared/api/errors'
import { useSession } from '@/shared/api/session'
import { Button } from '@/shared/ui/Button'
import { Field, Input } from '@/shared/ui/Form'

/** Только внутренний путь: иначе ?next=https://… увёл бы на чужой сайт */
function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

export function LoginPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { token, setSession } = useSession()
  const [form, setForm] = useState({ login: '', password: '' })
  const next = safeNext(params.get('next'))

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      setSession(data.token, data.user)
      navigate(next, { replace: true })
    },
  })

  if (token) return <Navigate to={next} replace />

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    mutation.mutate(form)
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-card border border-border bg-surface p-7 shadow-card"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-[38px] place-items-center rounded-tile bg-primary text-lg font-bold text-white">
            СП
          </div>
          <div>
            <strong className="block text-nav leading-tight">Сварочное производство</strong>
            <span className="text-xs text-muted">Вход в портал</span>
          </div>
        </div>

        <div className="grid gap-4">
          <Field label="Логин">
            {(id) => (
              <Input
                id={id}
                autoComplete="username"
                autoFocus
                required
                value={form.login}
                onChange={(e) => setForm({ ...form, login: e.target.value })}
              />
            )}
          </Field>
          <Field label="Пароль">
            {(id) => (
              <Input
                id={id}
                type="password"
                autoComplete="current-password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            )}
          </Field>

          {mutation.isError && (
            <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
              {errorMessage(mutation.error)}
            </p>
          )}

          <Button type="submit" disabled={mutation.isPending} className="mt-1 w-full">
            {mutation.isPending ? 'Входим…' : 'Войти'}
          </Button>
        </div>
      </form>
    </div>
  )
}

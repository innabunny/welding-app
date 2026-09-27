import type { UseMutationResult } from '@tanstack/react-query'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { errorMessage, fieldErrors } from '@/shared/api/errors'
import { Button } from './Button'
import { Modal } from './Modal'

/** Тело мутации сохранения: id null — создать, число — заменить (PUT) */
export interface SaveVars<W> {
  id: number | null
  body: W
}

/** null — форма закрыта, id: null — новая запись */
export type Editing<W> = { id: number | null; initial: W } | null

export type Errors = Record<string, string>

export interface FieldsApi<W> {
  draft: W
  update: (patch: Partial<W>) => void
  errors: Errors
}

interface Props<W, R> {
  editing: Editing<W>
  /** «материал», «группу» — для заголовка «Новый …» и «Изменить …» */
  newTitle: string
  editTitle: string
  save: UseMutationResult<R, Error, SaveVars<W>>
  validate: (draft: W) => Errors
  /** Чистка перед отправкой: trim, пустое → null */
  prepare: (draft: W) => W
  onClose: () => void
  /** После успешного сохранения, до закрытия: например, перейти к созданной записи */
  onSaved?: (result: R, id: number | null) => void
  children: (api: FieldsApi<W>) => ReactNode
}

/** Модалка «создать / изменить» для простых сущностей: черновик, проверка, ошибки сервера */
export function FormModal<W, R>({ editing, onClose, onSaved, newTitle, editTitle, save, ...rest }: Props<W, R>) {
  const formId = useId()
  const close = () => {
    save.reset()
    onClose()
  }

  return (
    <Modal
      open={editing !== null}
      title={editing?.id === null ? newTitle : editTitle}
      onClose={close}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Отмена
          </Button>
          <Button type="submit" form={formId} disabled={save.isPending}>
            {save.isPending ? 'Сохраняем…' : 'Сохранить'}
          </Button>
        </>
      }
    >
      {editing && (
        <FormBody
          // новый черновик на каждое открытие
          key={editing.id ?? 'new'}
          editing={editing}
          formId={formId}
          save={save}
          onSaved={(result) => {
            onSaved?.(result, editing.id)
            close()
          }}
          {...rest}
        />
      )}
    </Modal>
  )
}

interface BodyProps<W, R> {
  editing: NonNullable<Editing<W>>
  formId: string
  save: UseMutationResult<R, Error, SaveVars<W>>
  validate: (draft: W) => Errors
  prepare: (draft: W) => W
  onSaved: (result: R) => void
  children: (api: FieldsApi<W>) => ReactNode
}

function FormBody<W, R>({ editing, formId, save, validate, prepare, onSaved, children }: BodyProps<W, R>) {
  const [draft, setDraft] = useState<W>(editing.initial)
  const [localErrors, setLocalErrors] = useState<Errors>({})

  const update = (patch: Partial<W>) => {
    setDraft((prev) => ({ ...prev, ...patch }))
    // ошибка поля устаревает, как только его поправили
    setLocalErrors((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(patch)) delete next[key]
      return next
    })
  }

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const found = validate(draft)
    setLocalErrors(found)
    if (Object.keys(found).length > 0) return
    save.mutate({ id: editing.id, body: prepare(draft) }, { onSuccess: onSaved })
  }

  const errors = { ...fieldErrors(save.error), ...localErrors }

  return (
    <form id={formId} onSubmit={submit} noValidate className="grid gap-4">
      {save.isError && (
        <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
          {errorMessage(save.error)}
        </p>
      )}
      {children({ draft, update, errors })}
    </form>
  )
}

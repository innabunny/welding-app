import { useParams } from 'react-router'
import { AttestationForm } from '@/features/attestation/AttestationForm'
import { useAttestation } from '@/features/attestation/queries'
import { EmptyState, ErrorState, SkeletonRows } from '@/shared/ui/States'

/** /attestation/new — новая, /attestation/:id — карточка */
export function AttestationEditPage() {
  // у маршрута /attestation/new параметра id нет — это новая аттестация
  const { id } = useParams()
  const isNew = id === undefined || id === 'new'
  const attestationId = isNew ? null : Number(id)
  const attestation = useAttestation(Number.isInteger(attestationId) ? attestationId : null)

  if (!isNew && !Number.isInteger(attestationId)) return <EmptyState title="Аттестация не найдена" />
  if (attestationId === null) return <AttestationForm key="new" attestation={undefined} />
  if (attestation.isPending) return <SkeletonRows rows={8} />
  if (attestation.isError) return <ErrorState error={attestation.error} onRetry={() => attestation.refetch()} />
  return <AttestationForm key={attestation.data.id} attestation={attestation.data} />
}

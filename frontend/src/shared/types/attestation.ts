import type { IsoDate, IsoDateTime } from './common'

/** Считается на бэке: '' — срока нет, soon — 60 дней и меньше */
export type ExpiryState = '' | 'valid' | 'soon' | 'expired'

export interface AttestationListItem {
  id: number
  welderFio: string
  welderWorkshop: string
  methodName: string
  groupCode: string
  kind: string
  status: string
  statusDisplay: string
  attestedAt: IsoDate | null
  validUntil: IsoDate | null
  expiryState: ExpiryState
  protocolNo: string
  certificateNo: string
  itemsCount: number
  createdAt: IsoDateTime
}

/** GET /attestations/expiring/ — просроченные и истекающие в 60 дней */
export interface AttestationExpiring {
  expiredCount: number
  soonCount: number
  items: AttestationListItem[]
}

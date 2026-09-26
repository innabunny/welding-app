import type { IsoDateTime } from './common'

/** Только поля, которые сейчас нужны фронту; полная карта — много больше */
export interface WeldingCardListItem {
  id: number
  cardNo: string
  revision: string
  partNumber: string
  partName: string
  seamNumber: string
  methodName: string
  equipmentName: string
  isReleased: boolean
  authorName: string
  updatedAt: IsoDateTime
}

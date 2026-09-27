import type { PartWrite, SeamWrite } from '@/shared/types/technology'

/** Пустые черновики для форм «Новая деталь» и «Новый шов» */
export const emptyPart: PartWrite = { number: '', name: '', note: '', isActive: true }

export const emptySeam = (partId: number): SeamWrite => ({
  partId,
  number: '',
  jointType: '',
  material1Id: null,
  material2Id: null,
  thickness1: null,
  thickness2: null,
  pos1: '',
  pos2: '',
  mass1: null,
  mass2: null,
  seamType: '',
  seamDiameter: null,
  seamLength: null,
})

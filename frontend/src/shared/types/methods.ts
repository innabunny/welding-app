export interface WeldingMethod {
  /** Строковый код способа: "diff", "tig_manual" */
  id: string
  name: string
  designation: string
  process: string
  tplKey: string
  order: number
  isActive: boolean
}

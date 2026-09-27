export interface Workstation {
  id: number
  number: string
  name: string
  sectionId: number
  sectionName: string
  workshopName: string
  equipmentCount: number
  isActive: boolean
}

export interface Workshop {
  id: number
  name: string
  number: string
}

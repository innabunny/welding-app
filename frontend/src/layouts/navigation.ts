import {
  Activity,
  AlignLeft,
  FileText,
  House,
  Layers,
  UserRound,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react'

export const paths = {
  dashboard: '/',
  welds: '/welds',
  cards: '/cards',
  parts: '/parts',
  references: '/references',
  equipment: '/equipment',
  attestation: '/attestation',
  service: '/service',
  login: '/login',
} as const

/** Какой счётчик показывать у пункта меню */
export type NavCounter = 'attestation' | 'service'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  counter?: NavCounter
}

export interface NavGroup {
  title: string
  items: NavItem[]
}

export const navigation: NavGroup[] = [
  {
    title: 'Производство',
    items: [
      { to: paths.dashboard, label: 'Рабочий стол', icon: House },
      { to: paths.welds, label: 'Швы и паспорта', icon: Activity },
    ],
  },
  {
    title: 'Технология',
    items: [
      { to: paths.cards, label: 'Технологические карты', icon: FileText },
      { to: paths.parts, label: 'Детали и операции', icon: AlignLeft },
      { to: paths.references, label: 'Справочники', icon: Layers },
    ],
  },
  {
    title: 'Персонал и парк',
    items: [
      { to: paths.attestation, label: 'Аттестация сварщиков', icon: UserRound, counter: 'attestation' },
      { to: paths.equipment, label: 'Оборудование', icon: Zap },
      { to: paths.service, label: 'Заявки на обслуживание', icon: Wrench, counter: 'service' },
    ],
  },
]

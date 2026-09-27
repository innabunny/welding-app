/** Процессы сварки — как choices WeldingMethod.Process на бэке */
export const processLabels: Record<string, string> = {
  tig: 'Неплавящийся электрод в защитном газе',
  mig: 'Плавящийся электрод в защитном газе',
  plasma: 'Плазменная',
  ebw: 'Электронно-лучевая',
  diff: 'Диффузионная',
  contact: 'Контактная',
  laser: 'Лазерная',
}

import { createBrowserRouter } from 'react-router'
import { AppLayout } from '@/layouts/AppLayout'
import { paths } from '@/layouts/navigation'
import type { RouteHandle } from '@/layouts/Topbar'
import { DashboardPage } from '@/pages/DashboardPage'
import { EquipmentPage } from '@/pages/EquipmentPage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { StubPage } from '@/pages/StubPage'

const stub = (path: string, crumb: string) => ({
  path,
  element: <StubPage title={crumb} />,
  handle: { crumb } satisfies RouteHandle,
})

export const router = createBrowserRouter([
  { path: paths.login, element: <LoginPage /> },
  {
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
        handle: { crumb: 'Рабочий стол' } satisfies RouteHandle,
      },
      {
        path: paths.equipment,
        element: <EquipmentPage />,
        handle: { crumb: 'Оборудование' } satisfies RouteHandle,
      },
      stub(paths.welds, 'Швы и паспорта'),
      stub(paths.cards, 'Технологические карты'),
      stub(paths.parts, 'Детали и операции'),
      stub(paths.references, 'Справочники'),
      stub(paths.attestation, 'Аттестация сварщиков'),
      stub(paths.service, 'Заявки на обслуживание'),
      { path: '*', element: <NotFoundPage />, handle: { crumb: 'Не найдено' } satisfies RouteHandle },
    ],
  },
])

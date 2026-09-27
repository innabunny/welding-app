import { createBrowserRouter } from 'react-router'
import { AppLayout } from '@/layouts/AppLayout'
import { paths } from '@/layouts/navigation'
import type { RouteHandle } from '@/layouts/Topbar'
import { CardEditPage } from '@/pages/CardEditPage'
import { CardSheetPage } from '@/pages/CardSheetPage'
import { CardsPage } from '@/pages/CardsPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { EquipmentPage } from '@/pages/EquipmentPage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PartPage } from '@/pages/PartPage'
import { PartsPage } from '@/pages/PartsPage'
import { MaterialsPage } from '@/pages/MaterialsPage'
import { ServicePage } from '@/pages/ServicePage'
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
      stub(paths.welds, 'Сварные швы'),
      {
        path: paths.cards,
        element: <CardsPage />,
        handle: { crumb: 'Технологические карты' } satisfies RouteHandle,
      },
      {
        path: `${paths.cards}/new`,
        element: <CardEditPage />,
        handle: { crumb: 'Новая карта' } satisfies RouteHandle,
      },
      {
        path: `${paths.cards}/:id`,
        element: <CardEditPage />,
        handle: { crumb: 'Технологическая карта' } satisfies RouteHandle,
      },
      {
        path: `${paths.cards}/:id/sheet`,
        element: <CardSheetPage />,
        handle: { crumb: 'Бланк техкарты' } satisfies RouteHandle,
      },
      {
        path: paths.parts,
        element: <PartsPage />,
        handle: { crumb: 'Детали и операции' } satisfies RouteHandle,
      },
      {
        path: `${paths.parts}/:id`,
        element: <PartPage />,
        handle: { crumb: 'Деталь' } satisfies RouteHandle,
      },
      {
        path: paths.materials,
        element: <MaterialsPage />,
        handle: { crumb: 'Справочники' } satisfies RouteHandle,
      },
      stub(paths.attestation, 'Аттестация сварщиков'),
      {
        path: paths.service,
        element: <ServicePage />,
        handle: { crumb: 'Заявки на обслуживание' } satisfies RouteHandle,
      },
      { path: '*', element: <NotFoundPage />, handle: { crumb: 'Не найдено' } satisfies RouteHandle },
    ],
  },
])

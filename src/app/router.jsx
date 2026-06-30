import { createBrowserRouter } from 'react-router-dom';
import { MainLayout } from './layout/MainLayout';
import { Home } from './routes/Home';
import { Tools } from './routes/Tools';
import { Pricing } from './routes/Pricing';
import { NotFound } from './routes/NotFound';
import { ReceiptPage } from '../tools/receipt/ReceiptPage';
import { ResumePage } from '../tools/resume/ResumePage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'ferramentas', element: <Tools /> },
      { path: 'ferramentas/gerador-de-recibo', element: <ReceiptPage /> },
      { path: 'ferramentas/gerador-de-curriculo', element: <ResumePage /> },
      { path: 'precos', element: <Pricing /> },
      { path: '*', element: <NotFound /> }
    ]
  }
]);

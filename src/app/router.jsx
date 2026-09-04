import { Navigate, createBrowserRouter } from 'react-router-dom';
import { MainLayout } from './layout/MainLayout';
import { Home } from './routes/Home';
import { Tools } from './routes/Tools';
import { Services } from './routes/Services';
import { MarketingDigital } from './routes/MarketingDigital';
import { Help } from './routes/Help';
import { NotFound } from './routes/NotFound';
import { ReceiptPage } from '../tools/receipt/ReceiptPage';
import { ResumePage } from '../tools/resume/ResumePage';
import { CheckoutPage } from './routes/CheckoutPage';
import { LegalDocumentPage } from '../legal/LegalDocumentPage';
import { legalDocumentsByPath } from '../legal/legalDocuments';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'ferramentas', element: <Tools /> },
      { path: 'servicos', element: <Services /> },
      { path: 'marketing-digital', element: <MarketingDigital /> },
      { path: 'ajuda', element: <Help /> },
      { path: 'ferramentas/gerador-de-recibo', element: <ReceiptPage /> },
      { path: 'ferramentas/gerador-de-curriculo', element: <ResumePage /> },
      { path: 'precos', element: <Navigate to="/ajuda" replace /> },
      { path: 'checkout/:orderId', element: <CheckoutPage /> },
      { path: 'termos-de-uso', element: <LegalDocumentPage document={legalDocumentsByPath['/termos-de-uso']} /> },
      { path: 'politica-de-privacidade', element: <LegalDocumentPage document={legalDocumentsByPath['/politica-de-privacidade']} /> },
      { path: '*', element: <NotFound /> }
    ]
  }
]);

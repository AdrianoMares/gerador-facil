import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { router } from './app/router';
import './styles.css';

function suppressPublicOrderTelemetry(event) {
  try {
    return new URL(event.url).pathname.startsWith('/pedido/') ? null : event;
  } catch {
    return null;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
    <Analytics beforeSend={suppressPublicOrderTelemetry} />
    <SpeedInsights beforeSend={suppressPublicOrderTelemetry} />
  </React.StrictMode>
);

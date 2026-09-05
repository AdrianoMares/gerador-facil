import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import './ServiceOrderSuccessNotice.css';

const pagBankSandboxEnabled = import.meta.env?.VITE_PAGBANK_SANDBOX_ENABLED === 'true';

export function ServiceOrderSuccessNotice() {
  const { orderId } = useParams();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!supabase || !orderId) return undefined;

    let active = true;
    let timer;

    async function detectServiceOrder() {
      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select('product_id')
        .eq('order_id', orderId);

      if (itemsError || !Array.isArray(items) || items.length === 0) return false;

      const productIds = [...new Set(items.map((item) => item.product_id).filter(Boolean))];
      if (productIds.length === 0) return false;

      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, product_type, fulfillment_mode')
        .in('id', productIds);

      if (productsError || !Array.isArray(products)) return false;

      return products.some((product) => (
        product.product_type === 'service'
        && product.fulfillment_mode === 'service_request'
      ));
    }

    async function checkServiceRequest() {
      const { data, error } = await supabase
        .from('service_requests')
        .select('id, status')
        .eq('order_id', orderId)
        .maybeSingle();

      if (!active || error || !data) return;

      setVisible(true);
      if (timer) clearInterval(timer);
    }

    async function start() {
      const isServiceOrder = await detectServiceOrder();
      if (!active || !isServiceOrder) return;

      await checkServiceRequest();
      if (active) timer = setInterval(checkServiceRequest, 3000);
    }

    start();

    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [orderId]);

  if (!visible) return null;

  return (
    <div className="container service-order-success-wrap">
      <section className="checkout-notice service-order-success-card" aria-live="polite">
        <h2>Solicitação recebida</h2>
        <p>Seu pagamento foi confirmado e sua solicitação já foi registrada. Em breve, você receberá no e-mail informado as instruções para dar continuidade ao serviço.</p>
        {pagBankSandboxEnabled && (
          <p className="service-order-success-test"><strong>Ambiente de teste:</strong> o envio automático desse e-mail ainda não está ativo.</p>
        )}
      </section>
    </div>
  );
}

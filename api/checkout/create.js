import { createClient } from '@supabase/supabase-js';
import { bearerToken, sendJson } from '../_documentAiAuth.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FINANCIAL_FIELDS = new Set(['amount', 'total', 'price', 'unitPrice', 'currency', 'status', 'paid', 'provider', 'providerPaymentId']);
const ALLOWED_FIELDS = new Set(['productCode', 'resourceId']);

function checkoutClient(createClientImpl, env, accessToken) {
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) throw new Error('AUTH_NOT_CONFIGURED');

  return createClientImpl(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } }
  });
}

function validateBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('INVALID_BODY');
  const fields = Object.keys(body);
  if (fields.some((field) => FINANCIAL_FIELDS.has(field) || !ALLOWED_FIELDS.has(field))) {
    throw new Error('UNSUPPORTED_FIELD');
  }
  if (typeof body.productCode !== 'string' || !body.productCode.trim() || body.productCode.length > 100) {
    throw new Error('INVALID_PRODUCT_CODE');
  }
  if (body.resourceId !== null && body.resourceId !== undefined && (!UUID_PATTERN.test(body.resourceId))) {
    throw new Error('INVALID_RESOURCE_ID');
  }

  return { productCode: body.productCode.trim(), resourceId: body.resourceId || null };
}

function publicError(error) {
  const code = error?.message;
  if (['INVALID_BODY', 'UNSUPPORTED_FIELD', 'INVALID_PRODUCT_CODE', 'INVALID_RESOURCE_ID'].includes(code)) {
    return { status: 400, code };
  }
  if (code === 'PRODUCT_NOT_AVAILABLE') return { status: 409, code };
  if (['INVALID_FULFILLMENT', 'INVALID_DOCUMENT_RESOURCE'].includes(code)) return { status: 422, code };
  if (code === 'AUTH_NOT_CONFIGURED') return { status: 503, code: 'SERVICE_NOT_CONFIGURED' };
  return { status: 500, code: 'CHECKOUT_UNAVAILABLE' };
}

export function createCheckoutHandler({ createClientImpl = createClient, env = process.env } = {}) {
  return async function checkoutCreate(request, response) {
    if (request.method !== 'POST') {
      return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' }, { Allow: 'POST' });
    }

    const accessToken = bearerToken(request.headers?.authorization);
    if (!accessToken) return sendJson(response, 401, { error: 'UNAUTHORIZED' });

    try {
      const input = validateBody(request.body);
      const client = checkoutClient(createClientImpl, env, accessToken);
      const { data: userData, error: userError } = await client.auth.getUser(accessToken);
      if (userError || !userData?.user) return sendJson(response, 401, { error: 'UNAUTHORIZED' });

      const { data: orderId, error } = await client.rpc('create_checkout_order', {
        p_product_code: input.productCode,
        p_resource_id: input.resourceId
      });
      if (error) throw new Error(error.message);
      if (!UUID_PATTERN.test(orderId || '')) throw new Error('INVALID_ORDER_RESPONSE');

      return sendJson(response, 201, {
        orderId,
        checkoutUrl: `/checkout/${orderId}`
      });
    } catch (error) {
      const result = publicError(error);
      return sendJson(response, result.status, { error: result.code });
    }
  };
}

export default createCheckoutHandler();

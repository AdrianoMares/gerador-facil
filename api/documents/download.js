import { createClient } from '@supabase/supabase-js';
import { bearerToken, sendJson } from '../_documentAiAuth.js';
import { renderDocumentPdf } from '../_documentPdfRenderers.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function downloadClient(createClientImpl, env, accessToken) {
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) throw new Error('AUTH_NOT_CONFIGURED');
  return createClientImpl(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } }
  });
}

function validInput(body) {
  return body && typeof body === 'object' && !Array.isArray(body)
    && Object.keys(body).length === 1 && UUID_PATTERN.test(body.resourceId || '');
}

function sendPdf(response, filename, content) {
  response.setHeader('Content-Type', 'application/pdf');
  response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  response.setHeader('Cache-Control', 'private, no-store');
  return response.status(200).send(content);
}

export function createDocumentDownloadHandler({ createClientImpl = createClient, env = process.env } = {}) {
  return async function documentDownload(request, response) {
    if (request.method !== 'POST') return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' }, { Allow: 'POST' });
    const accessToken = bearerToken(request.headers?.authorization);
    if (!accessToken) return sendJson(response, 401, { error: 'UNAUTHORIZED' });
    if (!validInput(request.body)) return sendJson(response, 400, { error: 'INVALID_RESOURCE_ID' });

    try {
      const client = downloadClient(createClientImpl, env, accessToken);
      const { data: userData, error: userError } = await client.auth.getUser(accessToken);
      if (userError || !userData?.user) return sendJson(response, 401, { error: 'UNAUTHORIZED' });

      const { data: draft, error: draftError } = await client
        .from('document_drafts')
        .select('id, service_type, payload, status')
        .eq('id', request.body.resourceId)
        .eq('user_id', userData.user.id)
        .maybeSingle();
      if (draftError) throw draftError;
      if (!draft) return sendJson(response, 404, { error: 'DOCUMENT_NOT_FOUND' });
      if (draft.status !== 'ready') return sendJson(response, 403, { error: 'DOCUMENT_NOT_AVAILABLE' });

      const { data: entitlements, error: entitlementError } = await client
        .from('entitlements')
        .select('resource_id, resource_type, revoked_at, product:products!inner(product_type, fulfillment_mode, resource_kind), order:orders!inner(status)')
        .eq('user_id', userData.user.id)
        .eq('resource_id', draft.id)
        .is('revoked_at', null);
      if (entitlementError) throw entitlementError;
      const allowed = (entitlements || []).some((entitlement) => {
        const product = entitlement.product;
        return entitlement.revoked_at === null
          && entitlement.order?.status === 'paid'
          && entitlement.resource_type === draft.service_type
          && product?.product_type === 'tool'
          && product?.fulfillment_mode === 'document_download'
          && product?.resource_kind === draft.service_type;
      });
      if (!allowed) return sendJson(response, 403, { error: 'DOCUMENT_NOT_AVAILABLE' });

      const pdf = renderDocumentPdf(draft.service_type, draft.payload, { variant: 'final' });
      return sendPdf(response, pdf.filename, pdf.content);
    } catch (error) {
      if (error?.message === 'AUTH_NOT_CONFIGURED') return sendJson(response, 503, { error: 'SERVICE_NOT_CONFIGURED' });
      if (error?.message === 'UNSUPPORTED_DOCUMENT') return sendJson(response, 422, { error: 'UNSUPPORTED_DOCUMENT' });
      return sendJson(response, 500, { error: 'DOCUMENT_DOWNLOAD_UNAVAILABLE' });
    }
  };
}

export default createDocumentDownloadHandler();

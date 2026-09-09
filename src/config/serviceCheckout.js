export function readServiceCheckoutEnabled(env = import.meta.env) {
  return env?.VITE_SERVICE_CHECKOUT_ENABLED === 'true';
}

export const serviceCheckoutEnabled = readServiceCheckoutEnabled();

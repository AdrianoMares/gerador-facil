export function isServiceCheckoutReady(service) {
  return service?.status !== 'planned'
    && service?.checkout?.ready === true
    && typeof service.checkout.productCode === 'string'
    && Boolean(service.checkout.productCode.trim());
}

export function isServicePurchaseEnabled(service, environmentEnabled) {
  return environmentEnabled === true && isServiceCheckoutReady(service);
}

export function canStartServicePurchase(service, environmentEnabled, termsAccepted, privacyAccepted) {
  return isServicePurchaseEnabled(service, environmentEnabled)
    && Boolean(termsAccepted)
    && Boolean(privacyAccepted);
}

export function canStartServicePurchase(service, termsAccepted, privacyAccepted) {
  return service?.status === 'active' && Boolean(termsAccepted) && Boolean(privacyAccepted);
}

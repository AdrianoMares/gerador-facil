import { Turnstile } from '@marsidev/react-turnstile';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { canStartServicePurchase, isServiceCheckoutReady } from '../services/servicePurchase.js';
import { createServicePurchaseFlow } from '../services/servicePurchaseFlow.js';
import { formatCurrencyBRL } from '../utils/formatters';
import { ServiceLegalAcceptance } from './ServiceLegalAcceptance';
import './ServicePurchase.css';

const unavailableMessage = 'A contratação deste serviço ainda está sendo configurada.';
const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

const turnstileOptions = {
  appearance: 'interaction-only',
  size: 'flexible',
  theme: 'light'
};

export function ServicePurchase({ service, environmentEnabled = false }) {
  const [message, setMessage] = useState('');
  const [purchaseState, setPurchaseState] = useState('idle');
  const [captchaKey, setCaptchaKey] = useState(0);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const purchaseFlowRef = useRef(null);
  const navigate = useNavigate();

  if (!isServiceCheckoutReady(service)) return null;

  const purchaseEnabled = environmentEnabled === true;
  const purchasePending = purchaseState !== 'idle';

  if (purchaseFlowRef.current == null) {
    purchaseFlowRef.current = createServicePurchaseFlow();
  }

  function requestCaptcha(nextMessage = 'Conclua a verificação de segurança para continuar.') {
    if (!turnstileSiteKey) {
      purchaseFlowRef.current.reset();
      setPurchaseState('idle');
      setMessage('A verificação de segurança está indisponível agora. Tente novamente em instantes.');
      return;
    }

    setMessage(nextMessage);
    setPurchaseState('captcha');
    setCaptchaKey((key) => key + 1);
  }

  function handleFlowResult(result) {
    if (result.status === 'captcha-required') {
      requestCaptcha();
      return;
    }

    if (result.status === 'completed') {
      navigate(result.checkoutUrl);
    }
  }

  function handleFlowError(error) {
    if (purchaseFlowRef.current.getState() === 'captcha-required') {
      requestCaptcha('Sua sessão precisa ser renovada. Faça uma nova verificação para continuar.');
      return;
    }

    setPurchaseState('idle');

    if (error.code === 'LEGAL_ACCEPTANCE_REQUIRED') {
      setMessage('Não foi possível confirmar os aceites obrigatórios. Tente novamente.');
    } else if (error.code === 'PRODUCT_NOT_AVAILABLE' || error.code === 'CHECKOUT_DISABLED') {
      setMessage(unavailableMessage);
    } else {
      setMessage('Não foi possível preparar o pagamento agora. Tente novamente em instantes.');
    }
  }

  async function handlePurchase() {
    if (purchaseFlowRef.current.getState() !== 'idle') return;

    setMessage('');

    if (!purchaseEnabled) {
      setMessage(unavailableMessage);
      return;
    }

    if (!canStartServicePurchase(service, purchaseEnabled, termsAccepted, privacyAccepted)) {
      setMessage('Marque os aceites obrigatórios para continuar.');
      return;
    }

    setPurchaseState('preparing');

    try {
      const result = await purchaseFlowRef.current.start(service.checkout.productCode);
      handleFlowResult(result);
    } catch (error) {
      handleFlowError(error);
    }
  }

  async function handleCaptchaSuccess(captchaToken) {
    if (purchaseFlowRef.current.getState() !== 'captcha-required') return;

    setMessage('Verificação concluída. Preparando a contratação...');
    setPurchaseState('preparing');

    try {
      const result = await purchaseFlowRef.current.completeCaptcha(
        service.checkout.productCode,
        captchaToken
      );
      handleFlowResult(result);
    } catch (error) {
      handleFlowError(error);
    }
  }

  function handleCaptchaFailure() {
    if (purchaseFlowRef.current.getState() !== 'captcha-required') return;

    setMessage('A verificação expirou ou falhou. Faça uma nova verificação para continuar.');
    setCaptchaKey((key) => key + 1);
    setPurchaseState('captcha');
  }

  function purchaseButtonLabel() {
    if (purchaseState === 'captcha') return 'Aguardando verificação...';
    if (purchasePending) return 'Preparando...';
    return 'Contratar serviço';
  }

  function clearMessage() {
    if (!purchasePending) {
      setMessage('');
    }
  }

  const hasPrice = Number.isInteger(service.priceCents) && service.priceCents > 0;
  const purchaseTitle = service.detail?.purchaseTitle || 'Pronto para contratar?';
  const purchaseDescription = service.detail?.purchaseDescription || 'Você seguirá para o checkout seguro, com Pix, cartão de crédito ou boleto.';

  return (
    <aside className="service-purchase" aria-label="Contratação do serviço">
      <span>Contratação online</span>
      <strong>{purchaseTitle}</strong>

      {hasPrice && (
        <div className="service-purchase-price">
          {formatCurrencyBRL(service.priceCents / 100)}
          {service.priceSuffix && <small>{service.priceSuffix}</small>}
        </div>
      )}

      <p>{purchaseDescription}</p>

      <ServiceLegalAcceptance
        termsAccepted={termsAccepted}
        privacyAccepted={privacyAccepted}
        disabled={!purchaseEnabled || purchasePending}
        onTermsChange={(accepted) => {
          setTermsAccepted(accepted);
          clearMessage();
        }}
        onPrivacyChange={(accepted) => {
          setPrivacyAccepted(accepted);
          clearMessage();
        }}
      />

      <button
        className="button"
        type="button"
        onClick={handlePurchase}
        disabled={
          purchasePending ||
          !canStartServicePurchase(
            service,
            purchaseEnabled,
            termsAccepted,
            privacyAccepted
          )
        }
      >
        {purchaseButtonLabel()}
      </button>

      {purchaseState === 'captcha' && turnstileSiteKey && (
        <div className="service-purchase-turnstile" aria-label="Verificação de segurança">
          <Turnstile
            key={captchaKey}
            siteKey={turnstileSiteKey}
            options={turnstileOptions}
            onSuccess={handleCaptchaSuccess}
            onError={handleCaptchaFailure}
            onExpire={handleCaptchaFailure}
          />
        </div>
      )}

      {!purchaseEnabled && (
        <p className="service-purchase-message" role="status">
          {unavailableMessage}
        </p>
      )}

      {message && (
        <p className="service-purchase-message" role="status" aria-live="polite">
          {message}
        </p>
      )}
    </aside>
  );
}
import { Link } from 'react-router-dom';
import './ServiceLegalAcceptance.css';

export function ServiceLegalAcceptance({
  termsAccepted = false,
  privacyAccepted = false,
  onTermsChange,
  onPrivacyChange,
  disabled = false
}) {
  return (
    <div className="service-legal-acceptance">
      <label className="service-legal-check">
        <input
          type="checkbox"
          checked={termsAccepted}
          disabled={disabled}
          onChange={(event) => onTermsChange?.(event.target.checked)}
        />
        <span>Li e aceito os <Link to="/termos-de-uso" target="_blank" rel="noreferrer">Termos de Uso</Link>.</span>
      </label>
      <label className="service-legal-check">
        <input
          type="checkbox"
          checked={privacyAccepted}
          disabled={disabled}
          onChange={(event) => onPrivacyChange?.(event.target.checked)}
        />
        <span>Li e aceito a <Link to="/politica-de-privacidade" target="_blank" rel="noreferrer">Política de Privacidade</Link>.</span>
      </label>
    </div>
  );
}

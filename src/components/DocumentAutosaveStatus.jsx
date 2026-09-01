import { Turnstile } from '@marsidev/react-turnstile';

const saveMessages = {
  checking: 'Verificando para salvar...',
  conflict: 'Conflito de edição. Suas alterações continuam neste dispositivo.',
  error: 'Não foi possível salvar. Suas alterações continuam neste dispositivo.',
  idle: 'O salvamento automático começa após a primeira alteração.',
  local: 'Alterações somente neste dispositivo.',
  pending: 'Alterações pendentes...',
  saved: 'Salvo',
  saving: 'Salvando...'
};

const turnstileOptions = {
  appearance: 'interaction-only',
  size: 'flexible',
  theme: 'light'
};

export function DocumentAutosaveStatus({
  captchaKey,
  onCaptchaError,
  onCaptchaExpire,
  onCaptchaSuccess,
  requiresCaptcha,
  retry,
  saveState,
  turnstileSiteKey
}) {
  const canRetry = saveState === 'error';

  return (
    <div className={`document-autosave document-autosave-${saveState}`}>
      <div className="document-autosave-line" role="status" aria-live="polite">
        <span className="document-autosave-dot" aria-hidden="true" />
        <span>{saveMessages[saveState]}</span>
        {canRetry && (
          <button className="text-button" type="button" onClick={retry}>
            Tentar novamente
          </button>
        )}
      </div>
      {requiresCaptcha && turnstileSiteKey && (
        <div className="document-turnstile">
          <Turnstile
            key={captchaKey}
            siteKey={turnstileSiteKey}
            options={turnstileOptions}
            onSuccess={onCaptchaSuccess}
            onError={onCaptchaError}
            onExpire={onCaptchaExpire}
          />
        </div>
      )}
    </div>
  );
}

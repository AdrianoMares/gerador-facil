import { useEffect, useState } from 'react';
import { AiDocumentAssistError, requestAiDocumentAssist } from '../services/aiDocumentAssist';
import { Button } from './Button';

const errorMessages = {
  AI_PROVIDER_ERROR: 'O serviço de IA está temporariamente indisponível. Tente novamente.',
  AI_QUOTA: 'O limite temporário do serviço de IA foi atingido. Tente novamente mais tarde.',
  AI_TIMEOUT: 'A IA demorou mais que o esperado. Tente novamente.',
  BODY_TOO_LARGE: 'Há informações demais para uma única solicitação. Resuma a mensagem e tente novamente.',
  INVALID_BODY: 'Não foi possível enviar esses dados. Reduza o conteúdo e tente novamente.',
  INVALID_AI_RESPONSE: 'A IA não conseguiu organizar os dados desta vez. Tente reformular a mensagem.',
  INVALID_RESPONSE: 'Recebemos uma resposta inesperada. Tente novamente.',
  SESSION_REQUIRED: 'Conclua a verificação de segurança para usar a IA.',
  SERVICE_NOT_CONFIGURED: 'O modo IA não está disponível neste ambiente. Seus dados foram preservados.',
  UNAUTHORIZED: 'Sua sessão precisa ser renovada. Conclua a verificação e tente novamente.'
};

function completionMessage(assistantMessage, validation) {
  if (validation.valid) {
    return `${assistantMessage} Os campos obrigatórios estão completos. Você pode revisar o documento na prévia ou no modo Manual.`.slice(0, 1200);
  }

  return `${assistantMessage} Ainda precisamos completar: ${validation.missingFields.join(', ')}. Conte esses dados na próxima mensagem.`.slice(0, 1200);
}

export function DocumentAiAssistant({
  applyPatch,
  data,
  onChange,
  requestSession,
  serializePayload,
  serviceType,
  sessionConfigured,
  sessionReady,
  validateData
}) {
  const [message, setMessage] = useState('');
  const [conversation, setConversation] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const validation = validateData(data);

  useEffect(() => {
    if (sessionConfigured && !sessionReady) requestSession();
  }, [requestSession, sessionConfigured, sessionReady]);

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage || isSending) return;

    if (!sessionReady) {
      requestSession();
      setErrorMessage(errorMessages.SESSION_REQUIRED);
      return;
    }

    setIsSending(true);
    setErrorMessage('');

    try {
      const result = await requestAiDocumentAssist({
        serviceType,
        message: trimmedMessage,
        currentPayload: serializePayload(data),
        conversation
      });
      const updatedData = applyPatch(data, result.patch);
      const updatedValidation = validateData(updatedData);
      const assistantContent = completionMessage(result.assistantMessage, updatedValidation);

      onChange(updatedData);
      setConversation((current) => [
        ...current,
        { role: 'user', content: trimmedMessage },
        { role: 'assistant', content: assistantContent }
      ].slice(-8));
      setMessage('');
    } catch (error) {
      const code = error instanceof AiDocumentAssistError ? error.code : 'UNKNOWN';
      setErrorMessage(errorMessages[code] || 'Não foi possível usar a IA agora. Seus dados foram preservados; tente novamente.');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="card document-form-card ai-assistant" aria-labelledby={`${serviceType}-ai-title`}>
      <span className="eyebrow">Assistente de preenchimento</span>
      <h2 id={`${serviceType}-ai-title`}>Conte o que você precisa</h2>
      <p>Descreva os dados do documento. A IA organiza somente o que você informar e a prévia é atualizada ao lado.</p>

      <p className="ai-privacy-note">
        O texto enviado será processado por um serviço de inteligência artificial para ajudar a preencher seu documento.
      </p>

      {!sessionConfigured && (
        <p className="ai-alert" role="alert">
          O modo IA não está configurado neste ambiente. O preenchimento Manual continua disponível.
        </p>
      )}

      {conversation.length > 0 && (
        <div className="ai-conversation" aria-live="polite">
          {conversation.map((entry, index) => (
            <div className={`ai-message ai-message-${entry.role}`} key={`${entry.role}-${index}`}>
              <strong>{entry.role === 'user' ? 'Você' : 'Assistente'}</strong>
              <p>{entry.content}</p>
            </div>
          ))}
        </div>
      )}

      {conversation.length === 0 && !validation.valid && (
        <p className="ai-missing-fields">
          <strong>Para concluir:</strong> {validation.missingFields.join(', ')}.
        </p>
      )}

      <form className="ai-composer" onSubmit={handleSubmit}>
        <label className="form-field" htmlFor={`${serviceType}-ai-message`}>
          <span>Sua mensagem</span>
          <textarea
            className="textarea"
            id={`${serviceType}-ai-message`}
            maxLength="4000"
            placeholder={serviceType === 'receipt'
              ? 'Ex.: Recebi R$ 450 de Maria Silva referente à manutenção do computador...'
              : 'Ex.: Sou contador, trabalhei cinco anos com imposto de renda e moro em Aracruz...'}
            rows="6"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            disabled={isSending || !sessionConfigured}
          />
        </label>
        <div className="ai-composer-footer">
          <small>{message.length}/4000</small>
          <Button type="submit" disabled={!message.trim() || isSending || !sessionReady}>
            {isSending ? 'Organizando...' : sessionReady ? 'Enviar para a IA' : 'Aguardando verificação'}
          </Button>
        </div>
      </form>

      {errorMessage && <p className="ai-alert" role="alert">{errorMessage}</p>}
    </section>
  );
}

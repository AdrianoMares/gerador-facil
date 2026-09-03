import { useEffect, useRef, useState } from 'react';
import { AiDocumentAssistError, requestAiDocumentAssist } from '../services/aiDocumentAssist';
import { AiTranscriptionError, requestAiTranscription } from '../services/aiTranscription';
import { Button } from './Button';

const MAX_AUDIO_BYTES = 4_000_000;
const MAX_RECORDING_MS = 120_000;
const AUDIO_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus'
];

const errorMessages = {
  AI_PROVIDER_ERROR: 'O serviço de IA está temporariamente indisponível. Tente novamente.',
  AI_QUOTA: 'O limite temporário do serviço de IA foi atingido. Tente novamente mais tarde.',
  AI_TIMEOUT: 'A IA demorou mais que o esperado. Tente novamente.',
  BODY_TOO_LARGE: 'Há informações demais para uma única solicitação. Resuma a mensagem e tente novamente.',
  INVALID_BODY: 'Não foi possível enviar esses dados. Reduza o conteúdo e tente novamente.',
  INVALID_AI_RESPONSE: 'A IA não conseguiu organizar os dados desta vez. Tente reformular a mensagem.',
  INVALID_RESPONSE: 'Recebemos uma resposta inesperada. Tente novamente.',
  AUDIO_REQUIRED: 'Não foi possível capturar o áudio. Tente novamente.',
  AUDIO_TOO_LARGE: 'Gravação muito longa. O limite é de 2 minutos.',
  EMPTY_TRANSCRIPTION: 'Não identificamos fala no áudio. Tente novamente.',
  INVALID_AUDIO_TYPE: 'Este navegador gerou um formato de áudio não compatível.',
  MICROPHONE_DENIED: 'Não foi possível acessar o microfone. Verifique a permissão do navegador.',
  MICROPHONE_UNAVAILABLE: 'O microfone não está disponível neste dispositivo.',
  RECORDING_FAILED: 'Não foi possível iniciar a gravação. Tente novamente.',
  SESSION_REQUIRED: 'Conclua a verificação de segurança para usar a IA.',
  SERVICE_NOT_CONFIGURED: 'O modo IA não está disponível neste ambiente. Seus dados foram preservados.',
  TRANSCRIPTION_FAILED: 'Não conseguimos transcrever o áudio. Tente novamente.',
  TRANSCRIPTION_TIMEOUT: 'A transcrição demorou mais que o esperado. Tente novamente.',
  TRANSCRIPTION_TOO_LONG: 'A transcrição ficou longa demais. Grave uma mensagem mais curta.',
  UNAUTHORIZED: 'Sua sessão precisa ser renovada. Conclua a verificação e tente novamente.'
};

function MicrophoneIcon({ recording }) {
  return recording ? (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
      <path
        d="M12 15a4 4 0 0 0 4-4V6a4 4 0 1 0-8 0v5a4 4 0 0 0 4 4Zm-7-4a1 1 0 1 1 2 0 5 5 0 0 0 10 0 1 1 0 1 1 2 0 7 7 0 0 1-6 6.92V20h3a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2h3v-2.08A7 7 0 0 1 5 11Z"
        fill="currentColor"
      />
    </svg>
  );
}

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
  const [isRecording, setIsRecording] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState('');
  const audioChunksRef = useRef([]);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const recordingStartRef = useRef(false);
  const shouldTranscribeRef = useRef(true);
  const textareaRef = useRef(null);
  const transcriptionAbortRef = useRef(null);
  const isMountedRef = useRef(true);
  const validation = validateData(data);

  useEffect(() => {
    if (sessionConfigured && !sessionReady) requestSession();
  }, [requestSession, sessionConfigured, sessionReady]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      recordingStartRef.current = false;
      transcriptionAbortRef.current?.abort();
      window.clearTimeout(recordingTimerRef.current);
      shouldTranscribeRef.current = false;
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = null;
        recorder.stop();
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      audioChunksRef.current = [];
    };
  }, []);

  function releaseMicrophone() {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }

  function stopRecording(status = 'Transcrevendo...') {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    setRecordingStatus(status);
    setIsRecording(false);
    recorder.stop();
  }

  function appendTranscription(transcription) {
    setMessage((current) => {
      const separator = current.trim() ? '\n' : '';
      const available = 4000 - current.length - separator.length;
      if (available <= 0) return current;
      return `${current}${separator}${transcription.slice(0, available)}`;
    });
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  }

  async function transcribeAudio(audioBlob) {
    const controller = new AbortController();
    transcriptionAbortRef.current = controller;
    setIsTranscribing(true);
    setRecordingStatus('Transcrevendo...');
    setErrorMessage('');

    try {
      if (audioBlob.size > MAX_AUDIO_BYTES) throw new AiTranscriptionError('AUDIO_TOO_LARGE');
      const transcription = await requestAiTranscription(audioBlob, { signal: controller.signal });
      if (!isMountedRef.current) return;
      appendTranscription(transcription);
      setRecordingStatus('Transcrição concluída. Revise o texto antes de enviar.');
    } catch (error) {
      if (!isMountedRef.current) return;
      const code = error instanceof AiTranscriptionError ? error.code : 'TRANSCRIPTION_FAILED';
      setErrorMessage(errorMessages[code] || errorMessages.TRANSCRIPTION_FAILED);
      setRecordingStatus('');
      if (code === 'UNAUTHORIZED' || code === 'SESSION_REQUIRED') requestSession();
    } finally {
      if (transcriptionAbortRef.current === controller) transcriptionAbortRef.current = null;
      if (isMountedRef.current) setIsTranscribing(false);
    }
  }

  async function startRecording() {
    if (recordingStartRef.current || isRecording || isTranscribing) return;
    setErrorMessage('');

    if (!sessionReady) {
      requestSession();
      setErrorMessage(errorMessages.SESSION_REQUIRED);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setErrorMessage('A gravação de voz não é compatível com este navegador.');
      return;
    }

    recordingStartRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!isMountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        recordingStartRef.current = false;
        return;
      }
      mediaStreamRef.current = stream;
      const mimeType = AUDIO_MIME_TYPES.find((type) => (
        typeof window.MediaRecorder.isTypeSupported !== 'function'
        || window.MediaRecorder.isTypeSupported(type)
      ));
      const recorder = mimeType
        ? new window.MediaRecorder(stream, { mimeType })
        : new window.MediaRecorder(stream);

      audioChunksRef.current = [];
      shouldTranscribeRef.current = true;
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data?.size) audioChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        recordingStartRef.current = false;
        shouldTranscribeRef.current = false;
        window.clearTimeout(recordingTimerRef.current);
        releaseMicrophone();
        audioChunksRef.current = [];
        mediaRecorderRef.current = null;
        setIsRecording(false);
        setRecordingStatus('');
        setErrorMessage(errorMessages.RECORDING_FAILED);
      };
      recorder.onstop = () => {
        window.clearTimeout(recordingTimerRef.current);
        releaseMicrophone();
        mediaRecorderRef.current = null;
        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];
        if (!shouldTranscribeRef.current) return;
        const audioBlob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
        if (!audioBlob.size) {
          setRecordingStatus('');
          setErrorMessage(errorMessages.AUDIO_REQUIRED);
          return;
        }
        void transcribeAudio(audioBlob);
      };

      recorder.start(1000);
      recordingStartRef.current = false;
      setIsRecording(true);
      setRecordingStatus('Gravando...');
      recordingTimerRef.current = window.setTimeout(() => {
        stopRecording('Limite de 2 minutos atingido. Transcrevendo...');
      }, MAX_RECORDING_MS);
    } catch (error) {
      releaseMicrophone();
      recordingStartRef.current = false;
      if (!isMountedRef.current) return;
      const code = ['NotAllowedError', 'SecurityError'].includes(error?.name)
        ? 'MICROPHONE_DENIED'
        : ['NotFoundError', 'NotReadableError', 'AbortError'].includes(error?.name)
          ? 'MICROPHONE_UNAVAILABLE'
          : 'RECORDING_FAILED';
      setErrorMessage(errorMessages[code]);
      setRecordingStatus('');
    }
  }

  function handleVoiceButton() {
    if (isRecording) {
      stopRecording();
      return;
    }
    void startRecording();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage || isSending || isRecording || isTranscribing) return;

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
            ref={textareaRef}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            disabled={isSending || isTranscribing || !sessionConfigured}
          />
        </label>
        <div className="ai-voice-controls">
          <button
            aria-label={isRecording ? 'Parar gravação' : 'Falar'}
            aria-pressed={isRecording}
            className={`ai-voice-button${isRecording ? ' ai-voice-button-recording' : ''}`}
            disabled={isSending || isTranscribing || !sessionConfigured || (!sessionReady && !isRecording)}
            onClick={handleVoiceButton}
            title={isRecording ? 'Parar gravação' : 'Falar'}
            type="button"
          >
            <MicrophoneIcon recording={isRecording} />
            <span>{isRecording ? 'Parar gravação' : isTranscribing ? 'Transcrevendo...' : 'Falar'}</span>
          </button>
          {recordingStatus && (
            <span className="ai-recording-status" role="status" aria-live="polite">
              {isRecording && <span className="ai-recording-dot" aria-hidden="true" />}
              {recordingStatus}
            </span>
          )}
        </div>
        <div className="ai-composer-footer">
          <small>{message.length}/4000</small>
          <Button type="submit" disabled={!message.trim() || isSending || isRecording || isTranscribing || !sessionReady}>
            {isSending ? 'Organizando...' : sessionReady ? 'Enviar para a IA' : 'Aguardando verificação'}
          </Button>
        </div>
      </form>

      {errorMessage && <p className="ai-alert" role="alert">{errorMessage}</p>}
    </section>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createAnonymousDocumentSession,
  createDocumentDraft,
  DocumentDraftConflictError,
  getDocumentDraftSession,
  getLatestDocumentDraft,
  isDocumentDraftStorageConfigured,
  updateDocumentDraft
} from '../services/documentDrafts';

const AUTOSAVE_DELAY_MS = 1200;
const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

function snapshotKey(snapshot) {
  return `${snapshot.status}:${JSON.stringify(snapshot.payload)}`;
}

export function useDocumentDraft({
  data,
  setData,
  serviceType,
  isValid,
  serializePayload,
  hydratePayload
}) {
  const currentSnapshot = useMemo(() => ({
    payload: serializePayload(data),
    status: isValid ? 'ready' : 'draft'
  }), [data, isValid, serializePayload]);
  const currentSnapshotKey = snapshotKey(currentSnapshot);
  const initialSnapshotKeyRef = useRef(currentSnapshotKey);
  const latestSnapshotRef = useRef(currentSnapshot);
  const latestSnapshotKeyRef = useRef(currentSnapshotKey);
  const latestDataRef = useRef(data);
  const lastSavedSnapshotKeyRef = useRef(currentSnapshotKey);
  const draftRef = useRef(null);
  const sessionRef = useRef(null);
  const saveQueueRef = useRef(Promise.resolve());
  const mountedRef = useRef(true);
  const conflictRef = useRef(false);
  const authPendingRef = useRef(false);
  const [initialized, setInitialized] = useState(false);
  const [sessionVersion, setSessionVersion] = useState(0);
  const [saveState, setSaveState] = useState('checking');
  const [requiresCaptcha, setRequiresCaptcha] = useState(false);
  const [captchaKey, setCaptchaKey] = useState(0);

  const environmentReady = isDocumentDraftStorageConfigured() && Boolean(turnstileSiteKey);

  useEffect(() => {
    latestSnapshotRef.current = currentSnapshot;
    latestSnapshotKeyRef.current = currentSnapshotKey;
    latestDataRef.current = data;
  }, [currentSnapshot, currentSnapshotKey, data]);

  const persistSnapshot = useCallback(async (snapshot) => {
    if (!sessionRef.current || conflictRef.current) return;

    if (mountedRef.current) setSaveState('saving');

    try {
      const isNewDraft = !draftRef.current;

      if (isNewDraft) {
        draftRef.current = await createDocumentDraft({
          serviceType,
          payload: snapshot.payload
        });
      }

      const savedDraft = isNewDraft && draftRef.current.status === snapshot.status
        ? draftRef.current
        : await updateDocumentDraft({
            id: draftRef.current.id,
            payload: snapshot.payload,
            status: snapshot.status,
            revision: draftRef.current.revision
          });

      draftRef.current = savedDraft;
      lastSavedSnapshotKeyRef.current = snapshotKey(snapshot);

      if (mountedRef.current) {
        setSaveState(
          latestSnapshotKeyRef.current === lastSavedSnapshotKeyRef.current
            ? 'saved'
            : 'pending'
        );
      }
    } catch (error) {
      if (!mountedRef.current) return;

      if (error instanceof DocumentDraftConflictError) {
        conflictRef.current = true;
        setSaveState('conflict');
        return;
      }

      setSaveState('error');
    }
  }, [serviceType]);

  const enqueueSave = useCallback((snapshot) => {
    saveQueueRef.current = saveQueueRef.current.then(
      () => persistSnapshot(snapshot),
      () => persistSnapshot(snapshot)
    );
  }, [persistSnapshot]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initializeDraft() {
      if (!environmentReady) {
        if (!cancelled) {
          setSaveState('local');
          setInitialized(true);
        }
        return;
      }

      try {
        const session = await getDocumentDraftSession();
        if (cancelled) return;

        sessionRef.current = session;

        if (!session) {
          setSaveState('idle');
          setInitialized(true);
          return;
        }

        const draft = await getLatestDocumentDraft(serviceType);
        if (cancelled) return;

        if (draft) {
          const hydratedData = hydratePayload(draft.payload, latestDataRef.current);
          const hydratedSnapshot = {
            payload: serializePayload(hydratedData),
            status: draft.status
          };

          draftRef.current = draft;
          lastSavedSnapshotKeyRef.current = snapshotKey(hydratedSnapshot);

          if (latestSnapshotKeyRef.current === initialSnapshotKeyRef.current) {
            setData(hydratedData);
          }

          setSaveState('saved');
        } else {
          setSaveState('idle');
        }

        setInitialized(true);
        setSessionVersion((version) => version + 1);
      } catch {
        if (!cancelled) {
          setSaveState('error');
          setInitialized(true);
        }
      }
    }

    initializeDraft();

    return () => {
      cancelled = true;
    };
  }, [environmentReady, hydratePayload, serializePayload, serviceType, setData]);

  useEffect(() => {
    if (!initialized || !environmentReady || conflictRef.current) return undefined;

    if (currentSnapshotKey === lastSavedSnapshotKeyRef.current) {
      return undefined;
    }

    if (
      !draftRef.current
      && currentSnapshotKey === initialSnapshotKeyRef.current
    ) {
      setRequiresCaptcha(false);
      setSaveState('idle');
      return undefined;
    }

    if (!sessionRef.current) {
      setRequiresCaptcha(true);
      setSaveState('checking');
      return undefined;
    }

    setSaveState('pending');
    const timeout = window.setTimeout(() => {
      enqueueSave(latestSnapshotRef.current);
    }, AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [currentSnapshotKey, enqueueSave, environmentReady, initialized, sessionVersion]);

  const handleCaptchaSuccess = useCallback(async (captchaToken) => {
    if (authPendingRef.current || sessionRef.current) return;

    if (
      !draftRef.current
      && latestSnapshotKeyRef.current === initialSnapshotKeyRef.current
    ) {
      setRequiresCaptcha(false);
      setSaveState('idle');
      return;
    }

    authPendingRef.current = true;
    setSaveState('checking');

    try {
      const session = await createAnonymousDocumentSession(captchaToken);
      if (!session) throw new Error('A sessão anônima não foi criada.');

      sessionRef.current = session;
      setRequiresCaptcha(false);
      setSessionVersion((version) => version + 1);
    } catch {
      setSaveState('error');
    } finally {
      authPendingRef.current = false;
    }
  }, []);

  const handleCaptchaError = useCallback(() => {
    setSaveState('error');
  }, []);

  const retry = useCallback(() => {
    if (!environmentReady || conflictRef.current) return;

    if (!sessionRef.current) {
      setSaveState('checking');
      setRequiresCaptcha(true);
      setCaptchaKey((key) => key + 1);
      return;
    }

    setSaveState('pending');
    enqueueSave(latestSnapshotRef.current);
  }, [enqueueSave, environmentReady]);

  return {
    captchaKey,
    onCaptchaError: handleCaptchaError,
    onCaptchaExpire: handleCaptchaError,
    onCaptchaSuccess: handleCaptchaSuccess,
    requiresCaptcha,
    retry,
    saveState,
    turnstileSiteKey
  };
}

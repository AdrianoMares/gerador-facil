const PAGBANK_ENVIRONMENTS = Object.freeze({
  sandbox: {
    apiBaseUrl: 'https://sandbox.api.pagseguro.com',
    apiHostname: 'sandbox.api.pagseguro.com'
  },
  production: {
    apiBaseUrl: 'https://api.pagseguro.com',
    apiHostname: 'api.pagseguro.com'
  }
});

const HOMOLOGATION_LOG_CHUNK_SIZE = 1200;

export function pagBankEnvironment(env = process.env) {
  const value = env?.PAGBANK_ENV;
  return Object.prototype.hasOwnProperty.call(PAGBANK_ENVIRONMENTS, value) ? value : null;
}

export function requirePagBankEnvironment(env = process.env) {
  const environment = pagBankEnvironment(env);
  if (!environment || !env?.PAGBANK_TOKEN) throw new Error('PAYMENT_NOT_CONFIGURED');
  return environment;
}

export function pagBankApiBaseUrl(env = process.env) {
  const environment = pagBankEnvironment(env);
  return environment ? PAGBANK_ENVIRONMENTS[environment].apiBaseUrl : null;
}

export function pagBankApiHostname(env = process.env) {
  const environment = pagBankEnvironment(env);
  return environment ? PAGBANK_ENVIRONMENTS[environment].apiHostname : null;
}

export function pagBankHomologationLogsEnabled(env = process.env) {
  return env?.PAGBANK_HOMOLOGATION_LOGS === 'true';
}

export function logPagBankHomologation(method, direction, payload, {
  env = process.env,
  log = console.info
} = {}) {
  if (!pagBankHomologationLogsEnabled(env)) return;

  const serialized = JSON.stringify(payload);
  const referenceId = typeof payload?.reference_id === 'string' && payload.reference_id
    ? payload.reference_id
    : 'unknown';
  const totalChunks = Math.max(1, Math.ceil(serialized.length / HOMOLOGATION_LOG_CHUNK_SIZE));

  for (let index = 0; index < totalChunks; index += 1) {
    const start = index * HOMOLOGATION_LOG_CHUNK_SIZE;
    const chunk = serialized.slice(start, start + HOMOLOGATION_LOG_CHUNK_SIZE);
    log(
      `[PAGBANK_HOMOLOGATION][${method}][${direction}][REF:${referenceId}][CHUNK:${index + 1}/${totalChunks}]`,
      chunk
    );
  }
}

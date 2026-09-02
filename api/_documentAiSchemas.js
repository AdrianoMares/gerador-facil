export const MAX_AI_BODY_BYTES = 24_000;
export const MAX_AI_MESSAGE_LENGTH = 4_000;
export const MAX_AI_CONVERSATION_MESSAGES = 8;

const MAX_CONVERSATION_MESSAGE_LENGTH = 1_200;
const MAX_SHORT_TEXT_LENGTH = 500;
const MAX_LONG_TEXT_LENGTH = 2_000;
const MAX_ASSISTANT_MESSAGE_LENGTH = 400;

const RECEIPT_FIELD_LIMITS = {
  payerName: 150,
  payerDocument: 30,
  recipientName: 150,
  recipientDocument: 30,
  amount: 30,
  description: 300,
  city: 120,
  date: 10
};

const RESUME_FIELD_LIMITS = {
  fullName: 150,
  professionalTitle: 150,
  phone: 40,
  email: 254,
  location: 120,
  professionalSummary: 2_000,
  company: 150,
  role: 150,
  course: 180,
  institution: 180,
  courseName: 180,
  skill: 100,
  activity: 1_200
};

const AMOUNT_PATTERN = '^(?:0|[1-9][0-9]{0,14})(?:\\.[0-9]{1,2})?$';
const DATE_PATTERN = '^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])$';
const MONTH_PATTERN = '^[0-9]{4}-(?:0[1-9]|1[0-2])$';

const receiptFields = [
  'payerName',
  'payerDocument',
  'recipientName',
  'recipientDocument',
  'amount',
  'description',
  'city',
  'date'
];

const personalFields = [
  'fullName',
  'professionalTitle',
  'phone',
  'email',
  'location'
];

const idSchema = { type: 'string', maxLength: 120 };
const monthSchema = { type: 'string', minLength: 7, maxLength: 7, pattern: MONTH_PATTERN };

function textSchema(maxLength) {
  return { type: 'string', maxLength };
}

const receiptPatchProperties = {
  payerName: textSchema(RECEIPT_FIELD_LIMITS.payerName),
  payerDocument: textSchema(RECEIPT_FIELD_LIMITS.payerDocument),
  recipientName: textSchema(RECEIPT_FIELD_LIMITS.recipientName),
  recipientDocument: textSchema(RECEIPT_FIELD_LIMITS.recipientDocument),
  amount: {
    ...textSchema(RECEIPT_FIELD_LIMITS.amount),
    pattern: AMOUNT_PATTERN
  },
  description: textSchema(RECEIPT_FIELD_LIMITS.description),
  city: textSchema(RECEIPT_FIELD_LIMITS.city),
  date: {
    ...textSchema(RECEIPT_FIELD_LIMITS.date),
    minLength: RECEIPT_FIELD_LIMITS.date,
    pattern: DATE_PATTERN
  }
};

const resumePersonalProperties = {
  fullName: textSchema(RESUME_FIELD_LIMITS.fullName),
  professionalTitle: textSchema(RESUME_FIELD_LIMITS.professionalTitle),
  phone: textSchema(RESUME_FIELD_LIMITS.phone),
  email: textSchema(RESUME_FIELD_LIMITS.email),
  location: textSchema(RESUME_FIELD_LIMITS.location)
};

const activitySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: idSchema,
    description: textSchema(RESUME_FIELD_LIMITS.activity)
  }
};

const experienceSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: idSchema,
    company: textSchema(RESUME_FIELD_LIMITS.company),
    role: textSchema(RESUME_FIELD_LIMITS.role),
    startDate: monthSchema,
    endDate: monthSchema,
    current: { type: 'boolean' },
    activities: {
      type: 'array',
      maxItems: 8,
      items: activitySchema
    }
  }
};

const educationSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: idSchema,
    course: textSchema(RESUME_FIELD_LIMITS.course),
    institution: textSchema(RESUME_FIELD_LIMITS.institution),
    startDate: monthSchema,
    endDate: monthSchema
  }
};

const courseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: idSchema,
    name: textSchema(RESUME_FIELD_LIMITS.courseName),
    institution: textSchema(RESUME_FIELD_LIMITS.institution),
    completionDate: monthSchema
  }
};

const skillSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: idSchema,
    name: textSchema(RESUME_FIELD_LIMITS.skill)
  }
};

const patchSchemas = {
  receipt: {
    type: 'object',
    additionalProperties: false,
    properties: receiptPatchProperties
  },
  resume: {
    type: 'object',
    additionalProperties: false,
    properties: {
      personal: {
        type: 'object',
        additionalProperties: false,
        properties: resumePersonalProperties
      },
      professionalSummary: textSchema(RESUME_FIELD_LIMITS.professionalSummary),
      education: { type: 'array', maxItems: 10, items: educationSchema },
      courses: { type: 'array', maxItems: 10, items: courseSchema },
      skills: { type: 'array', maxItems: 20, items: skillSchema },
      experiences: { type: 'array', maxItems: 10, items: experienceSchema }
    }
  }
};

export function getAiResponseSchema(serviceType) {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      assistantMessage: { type: 'string', minLength: 1, maxLength: MAX_ASSISTANT_MESSAGE_LENGTH },
      patch: patchSchemas[serviceType]
    },
    required: ['assistantMessage', 'patch']
  };
}

function nullableSchema(schema) {
  return {
    ...schema,
    type: Array.isArray(schema.type)
      ? [...new Set([...schema.type, 'null'])]
      : [schema.type, 'null']
  };
}

function strictNullableObject(schema) {
  const properties = Object.fromEntries(Object.entries(schema.properties).map(([field, property]) => {
    if (property.type === 'object') {
      return [field, strictNullableObject(property)];
    }

    if (property.type === 'array') {
      const items = property.items?.type === 'object'
        ? strictNullableObject(property.items)
        : property.items;
      return [field, { ...property, items }];
    }

    return [field, nullableSchema(property)];
  }));

  return {
    ...schema,
    properties,
    required: Object.keys(properties)
  };
}

export function getOpenAiResponseSchema(serviceType) {
  const patchSchema = serviceType === 'resume'
    ? strictNullableObject(patchSchemas.resume)
    : strictNullableObject(patchSchemas.receipt);

  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      assistantMessage: { type: 'string', minLength: 1, maxLength: MAX_ASSISTANT_MESSAGE_LENGTH },
      patch: patchSchema
    },
    required: ['assistantMessage', 'patch']
  };
}

export function normalizeOpenAiNullableResponse(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeOpenAiNullableResponse);
  }

  if (!isPlainObject(value)) return value;

  return Object.fromEntries(Object.entries(value).flatMap(([field, fieldValue]) => (
    fieldValue === null
      ? []
      : [[field, normalizeOpenAiNullableResponse(fieldValue)]]
  )));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanString(
  value,
  maxLength = MAX_LONG_TEXT_LENGTH,
  { allowEmpty = true, rejectOverlong = false } = {}
) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (rejectOverlong && trimmed.length > maxLength) return undefined;
  const cleaned = trimmed.slice(0, maxLength);
  if (!allowEmpty && !cleaned) return undefined;
  return cleaned;
}

function cleanId(value, options = {}) {
  return cleanString(value, 120, { ...options, allowEmpty: false });
}

function cleanObjectStrings(source, fields, maxLength = MAX_LONG_TEXT_LENGTH, options) {
  if (!isPlainObject(source)) return {};

  return Object.fromEntries(fields.flatMap((field) => {
    const value = cleanString(source[field], maxLength, options);
    return value === undefined ? [] : [[field, value]];
  }));
}

function cleanList(source, limit, cleaner) {
  if (!Array.isArray(source)) return [];
  return source.slice(0, limit).map(cleaner).filter((item) => Object.keys(item).length > 0);
}

function normalizedValidationText(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

function containsAiPlaceholder(value) {
  const normalized = normalizedValidationText(value);
  return [
    '(vazio)',
    'nao informado',
    'nao foi possivel inferir',
    'nao ha informacao suficiente',
    'o usuario nao informou',
    'nao mencionado',
    'campo ausente',
    'desconhecido'
  ].some((placeholder) => normalized.includes(placeholder));
}

function cleanStructuredString(value, maxLength, options = {}, { maxWords = 20 } = {}) {
  const cleaned = cleanString(value, maxLength, options);
  if (cleaned === undefined) return undefined;
  if (containsAiPlaceholder(cleaned) || /[\r\n]/.test(cleaned)) return undefined;
  if (cleaned.split(/\s+/).length > maxWords) return undefined;
  return cleaned;
}

function cleanAmount(value, options) {
  const cleaned = cleanString(value, RECEIPT_FIELD_LIMITS.amount, options);
  if (!cleaned || !new RegExp(AMOUNT_PATTERN).test(cleaned)) return undefined;
  const amount = Number(cleaned);
  return Number.isFinite(amount) && amount > 0 ? cleaned : undefined;
}

function cleanDate(value, options) {
  const cleaned = cleanString(value, RECEIPT_FIELD_LIMITS.date, options);
  if (!cleaned || !new RegExp(DATE_PATTERN).test(cleaned)) return undefined;

  const [year, month, day] = cleaned.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
    ? cleaned
    : undefined;
}

function cleanMonth(value, options) {
  const cleaned = cleanString(value, 7, options);
  return cleaned && new RegExp(MONTH_PATTERN).test(cleaned) ? cleaned : undefined;
}

function cleanConfiguredStrings(source, fieldConfig, options) {
  if (!isPlainObject(source)) return {};

  return Object.fromEntries(Object.entries(fieldConfig).flatMap(([field, config]) => {
    const value = cleanStructuredString(source[field], config.maxLength, options, config);
    return value === undefined ? [] : [[field, value]];
  }));
}

function cleanActivities(source, options, { strictPatch = false } = {}) {
  return cleanList(source, 8, (activity) => ({
    ...(cleanId(activity?.id, options) ? { id: cleanId(activity.id, options) } : {}),
    ...cleanObjectStrings(
      activity,
      ['description'],
      strictPatch ? RESUME_FIELD_LIMITS.activity : MAX_LONG_TEXT_LENGTH,
      options
    )
  }));
}

function cleanExperiences(source, options, { strictPatch = false } = {}) {
  return cleanList(source, 10, (experience) => {
    if (!isPlainObject(experience)) return {};
    const id = cleanId(experience.id, options);
    const activities = cleanActivities(experience.activities, options, { strictPatch });

    const structuredFields = strictPatch
      ? cleanConfiguredStrings(experience, {
          company: { maxLength: RESUME_FIELD_LIMITS.company, maxWords: 20 },
          role: { maxLength: RESUME_FIELD_LIMITS.role, maxWords: 20 }
        }, options)
      : cleanObjectStrings(
          experience,
          ['company', 'role'],
          MAX_SHORT_TEXT_LENGTH,
          options
        );

    const dateFields = strictPatch
      ? Object.fromEntries(['startDate', 'endDate'].flatMap((field) => {
          const value = cleanMonth(experience[field], options);
          return value === undefined ? [] : [[field, value]];
        }))
      : cleanObjectStrings(
          experience,
          ['startDate', 'endDate'],
          MAX_SHORT_TEXT_LENGTH,
          options
        );

    return {
      ...(id ? { id } : {}),
      ...structuredFields,
      ...dateFields,
      ...(typeof experience.current === 'boolean' ? { current: experience.current } : {}),
      ...(activities.length > 0 ? { activities } : {})
    };
  });
}

function cleanResumePayload(source, options = {}) {
  if (!isPlainObject(source)) return {
    personal: {},
    professionalSummary: '',
    education: [],
    courses: [],
    skills: [],
    experiences: []
  };

  return {
    personal: cleanObjectStrings(source.personal, personalFields, MAX_SHORT_TEXT_LENGTH, options),
    ...(cleanString(source.professionalSummary, MAX_LONG_TEXT_LENGTH, options) !== undefined
      ? { professionalSummary: cleanString(source.professionalSummary, MAX_LONG_TEXT_LENGTH, options) }
      : {}),
    education: cleanList(source.education, 10, (item) => ({
      ...(cleanId(item?.id) ? { id: cleanId(item.id) } : {}),
      ...cleanObjectStrings(item, ['course', 'institution', 'startDate', 'endDate'], MAX_SHORT_TEXT_LENGTH, options)
    })),
    courses: cleanList(source.courses, 10, (item) => ({
      ...(cleanId(item?.id) ? { id: cleanId(item.id) } : {}),
      ...cleanObjectStrings(item, ['name', 'institution', 'completionDate'], MAX_SHORT_TEXT_LENGTH, options)
    })),
    skills: cleanList(source.skills, 20, (item) => ({
      ...(cleanId(item?.id) ? { id: cleanId(item.id) } : {}),
      ...cleanObjectStrings(item, ['name'], MAX_SHORT_TEXT_LENGTH, options)
    })),
    experiences: cleanExperiences(source.experiences, options)
  };
}

function cleanResumePatch(source, options) {
  if (!isPlainObject(source)) return {};

  return {
    personal: cleanConfiguredStrings(source.personal, {
      fullName: { maxLength: RESUME_FIELD_LIMITS.fullName, maxWords: 20 },
      professionalTitle: { maxLength: RESUME_FIELD_LIMITS.professionalTitle, maxWords: 20 },
      phone: { maxLength: RESUME_FIELD_LIMITS.phone, maxWords: 5 },
      email: { maxLength: RESUME_FIELD_LIMITS.email, maxWords: 2 },
      location: { maxLength: RESUME_FIELD_LIMITS.location, maxWords: 15 }
    }, options),
    ...(cleanString(source.professionalSummary, RESUME_FIELD_LIMITS.professionalSummary, options) !== undefined
      ? { professionalSummary: cleanString(source.professionalSummary, RESUME_FIELD_LIMITS.professionalSummary, options) }
      : {}),
    education: cleanList(source.education, 10, (item) => ({
      ...(cleanId(item?.id, options) ? { id: cleanId(item.id, options) } : {}),
      ...cleanConfiguredStrings(item, {
        course: { maxLength: RESUME_FIELD_LIMITS.course, maxWords: 25 },
        institution: { maxLength: RESUME_FIELD_LIMITS.institution, maxWords: 25 }
      }, options),
      ...Object.fromEntries(['startDate', 'endDate'].flatMap((field) => {
        const value = cleanMonth(item?.[field], options);
        return value === undefined ? [] : [[field, value]];
      }))
    })),
    courses: cleanList(source.courses, 10, (item) => ({
      ...(cleanId(item?.id, options) ? { id: cleanId(item.id, options) } : {}),
      ...cleanConfiguredStrings(item, {
        name: { maxLength: RESUME_FIELD_LIMITS.courseName, maxWords: 25 },
        institution: { maxLength: RESUME_FIELD_LIMITS.institution, maxWords: 25 }
      }, options),
      ...(cleanMonth(item?.completionDate, options)
        ? { completionDate: cleanMonth(item.completionDate, options) }
        : {})
    })),
    skills: cleanList(source.skills, 20, (item) => ({
      ...(cleanId(item?.id, options) ? { id: cleanId(item.id, options) } : {}),
      ...cleanConfiguredStrings(item, {
        name: { maxLength: RESUME_FIELD_LIMITS.skill, maxWords: 12 }
      }, options)
    })),
    experiences: cleanExperiences(source.experiences, options, { strictPatch: true })
  };
}

function cleanReceiptPayload(source, options = {}) {
  return cleanObjectStrings(source, receiptFields, MAX_LONG_TEXT_LENGTH, options);
}

function cleanReceiptPatch(source, options) {
  if (!isPlainObject(source)) return {};

  const cleaners = {
    payerName: (value) => cleanStructuredString(value, RECEIPT_FIELD_LIMITS.payerName, options),
    payerDocument: (value) => cleanStructuredString(value, RECEIPT_FIELD_LIMITS.payerDocument, options, { maxWords: 4 }),
    recipientName: (value) => cleanStructuredString(value, RECEIPT_FIELD_LIMITS.recipientName, options),
    recipientDocument: (value) => cleanStructuredString(value, RECEIPT_FIELD_LIMITS.recipientDocument, options, { maxWords: 4 }),
    amount: (value) => cleanAmount(value, options),
    description: (value) => cleanString(value, RECEIPT_FIELD_LIMITS.description, options),
    city: (value) => cleanStructuredString(value, RECEIPT_FIELD_LIMITS.city, options, { maxWords: 15 }),
    date: (value) => cleanDate(value, options)
  };

  return Object.fromEntries(receiptFields.flatMap((field) => {
    const value = cleaners[field](source[field]);
    return value === undefined ? [] : [[field, value]];
  }));
}

export function sanitizeCurrentPayload(serviceType, payload) {
  return serviceType === 'receipt'
    ? cleanReceiptPayload(payload)
    : cleanResumePayload(payload);
}

export function sanitizePatch(serviceType, patch) {
  const options = { allowEmpty: false, rejectOverlong: true };
  return serviceType === 'receipt'
    ? cleanReceiptPatch(patch, options)
    : cleanResumePatch(patch, options);
}

function parseBody(body) {
  if (typeof body !== 'string') return body;
  try {
    return JSON.parse(body);
  } catch {
    throw new AiRequestError('INVALID_BODY');
  }
}

function bodySize(body) {
  try {
    return Buffer.byteLength(JSON.stringify(body), 'utf8');
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export class AiRequestError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

export function validateAndSanitizeAiRequest(rawBody) {
  const body = parseBody(rawBody);
  if (!isPlainObject(body) || bodySize(body) > MAX_AI_BODY_BYTES) {
    throw new AiRequestError('INVALID_BODY');
  }

  const allowedKeys = new Set(['serviceType', 'message', 'currentPayload', 'conversation']);
  if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
    throw new AiRequestError('UNSUPPORTED_FIELD');
  }

  if (!['receipt', 'resume'].includes(body.serviceType)) {
    throw new AiRequestError('INVALID_SERVICE_TYPE');
  }

  const message = cleanString(body.message, MAX_AI_MESSAGE_LENGTH, { allowEmpty: false });
  if (!message || body.message.length > MAX_AI_MESSAGE_LENGTH) {
    throw new AiRequestError('INVALID_MESSAGE');
  }

  const rawConversation = body.conversation ?? [];
  if (!Array.isArray(rawConversation) || rawConversation.length > MAX_AI_CONVERSATION_MESSAGES) {
    throw new AiRequestError('INVALID_CONVERSATION');
  }

  const conversation = rawConversation.map((entry) => {
    if (!isPlainObject(entry) || !['user', 'assistant'].includes(entry.role)) {
      throw new AiRequestError('INVALID_CONVERSATION');
    }

    const content = cleanString(entry.content, MAX_CONVERSATION_MESSAGE_LENGTH, { allowEmpty: false });
    if (!content || entry.content.length > MAX_CONVERSATION_MESSAGE_LENGTH) {
      throw new AiRequestError('INVALID_CONVERSATION');
    }

    return { role: entry.role, content };
  });

  return {
    serviceType: body.serviceType,
    message,
    currentPayload: sanitizeCurrentPayload(body.serviceType, body.currentPayload),
    conversation
  };
}

export function parseAiAssistantResponse(serviceType, response) {
  let parsed = response;
  if (typeof response === 'string') {
    try {
      parsed = JSON.parse(response);
    } catch {
      throw new AiRequestError('INVALID_AI_RESPONSE');
    }
  }

  if (!isPlainObject(parsed) || !isPlainObject(parsed.patch)) {
    throw new AiRequestError('INVALID_AI_RESPONSE');
  }

  const assistantMessage = cleanString(
    parsed.assistantMessage,
    MAX_ASSISTANT_MESSAGE_LENGTH,
    { allowEmpty: false, rejectOverlong: true }
  );
  if (!assistantMessage) throw new AiRequestError('INVALID_AI_RESPONSE');

  return {
    assistantMessage,
    patch: sanitizePatch(serviceType, parsed.patch)
  };
}

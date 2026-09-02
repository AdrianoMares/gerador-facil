export const AI_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';
export const MAX_AI_BODY_BYTES = 24_000;
export const MAX_AI_MESSAGE_LENGTH = 4_000;
export const MAX_AI_CONVERSATION_MESSAGES = 8;

const MAX_CONVERSATION_MESSAGE_LENGTH = 1_200;
const MAX_SHORT_TEXT_LENGTH = 500;
const MAX_LONG_TEXT_LENGTH = 2_000;

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

const stringSchema = { type: 'string', maxLength: MAX_LONG_TEXT_LENGTH };
const shortStringSchema = { type: 'string', maxLength: MAX_SHORT_TEXT_LENGTH };
const idSchema = { type: 'string', maxLength: 120 };
const monthSchema = { type: 'string', maxLength: 7 };

const activitySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: idSchema,
    description: stringSchema
  }
};

const experienceSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: idSchema,
    company: shortStringSchema,
    role: shortStringSchema,
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
    course: shortStringSchema,
    institution: shortStringSchema,
    startDate: monthSchema,
    endDate: monthSchema
  }
};

const courseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: idSchema,
    name: shortStringSchema,
    institution: shortStringSchema,
    completionDate: monthSchema
  }
};

const skillSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: idSchema,
    name: shortStringSchema
  }
};

const patchSchemas = {
  receipt: {
    type: 'object',
    additionalProperties: false,
    properties: Object.fromEntries(receiptFields.map((field) => [field, stringSchema]))
  },
  resume: {
    type: 'object',
    additionalProperties: false,
    properties: {
      personal: {
        type: 'object',
        additionalProperties: false,
        properties: Object.fromEntries(personalFields.map((field) => [field, stringSchema]))
      },
      professionalSummary: stringSchema,
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
      assistantMessage: { type: 'string', minLength: 1, maxLength: 400 },
      patch: patchSchemas[serviceType]
    },
    required: ['assistantMessage', 'patch']
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanString(value, maxLength = MAX_LONG_TEXT_LENGTH, { allowEmpty = true } = {}) {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.trim().slice(0, maxLength);
  if (!allowEmpty && !cleaned) return undefined;
  return cleaned;
}

function cleanId(value) {
  return cleanString(value, 120, { allowEmpty: false });
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

function cleanActivities(source, options) {
  return cleanList(source, 8, (activity) => ({
    ...(cleanId(activity?.id) ? { id: cleanId(activity.id) } : {}),
    ...cleanObjectStrings(activity, ['description'], MAX_LONG_TEXT_LENGTH, options)
  }));
}

function cleanExperiences(source, options) {
  return cleanList(source, 10, (experience) => {
    if (!isPlainObject(experience)) return {};
    const id = cleanId(experience.id);
    const activities = cleanActivities(experience.activities, options);

    return {
      ...(id ? { id } : {}),
      ...cleanObjectStrings(
        experience,
        ['company', 'role', 'startDate', 'endDate'],
        MAX_SHORT_TEXT_LENGTH,
        options
      ),
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

function cleanReceiptPayload(source, options = {}) {
  return cleanObjectStrings(source, receiptFields, MAX_LONG_TEXT_LENGTH, options);
}

export function sanitizeCurrentPayload(serviceType, payload) {
  return serviceType === 'receipt'
    ? cleanReceiptPayload(payload)
    : cleanResumePayload(payload);
}

export function sanitizePatch(serviceType, patch) {
  const options = { allowEmpty: false };
  return serviceType === 'receipt'
    ? cleanReceiptPayload(patch, options)
    : cleanResumePayload(patch, options);
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

  const assistantMessage = cleanString(parsed.assistantMessage, 400, { allowEmpty: false });
  if (!assistantMessage) throw new AiRequestError('INVALID_AI_RESPONSE');

  return {
    assistantMessage,
    patch: sanitizePatch(serviceType, parsed.patch)
  };
}

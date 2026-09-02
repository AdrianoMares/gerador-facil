import {
  createActivityItem,
  createCourseItem,
  createEducationItem,
  createExperienceItem,
  createSkillItem
} from '../tools/resume/resumeSchema.js';

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

function definedFields(source, fields) {
  if (!source || typeof source !== 'object') return {};
  return Object.fromEntries(fields.flatMap((field) => (
    typeof source[field] === 'string' && source[field].trim()
      ? [[field, source[field].trim()]]
      : []
  )));
}

function normalize(value) {
  return String(value || '').trim().toLocaleLowerCase('pt-BR');
}

function mergeActivities(currentActivities, patches) {
  if (!Array.isArray(patches)) return currentActivities;
  const result = [...currentActivities];

  patches.forEach((patch) => {
    const fields = definedFields(patch, ['description']);
    if (!fields.description) return;

    const index = result.findIndex((activity) => (
      (patch.id && activity.id === patch.id)
      || normalize(activity.description) === normalize(fields.description)
    ));

    if (index >= 0) {
      result[index] = { ...result[index], ...fields };
    } else {
      const emptyIndex = result.findIndex((activity) => !activity.description.trim());
      if (emptyIndex >= 0) {
        result[emptyIndex] = { ...result[emptyIndex], ...fields };
      } else {
        result.push({ ...createActivityItem(), ...fields });
      }
    }
  });

  return result.filter((activity, index) => (
    activity.description.trim() || index === 0
  ));
}

function mergeExperiences(currentItems, patches) {
  if (!Array.isArray(patches)) return currentItems;
  const result = [...currentItems];

  patches.forEach((patch) => {
    const fields = definedFields(patch, ['company', 'role', 'startDate', 'endDate']);
    if (typeof patch?.current === 'boolean') fields.current = patch.current;
    if (fields.current) fields.endDate = '';

    const index = result.findIndex((item) => (
      (patch?.id && item.id === patch.id)
      || (
        normalize(item.company) === normalize(fields.company)
        && normalize(item.role) === normalize(fields.role)
        && normalize(item.startDate) === normalize(fields.startDate)
        && Boolean(fields.company || fields.role)
      )
    ));

    if (index >= 0) {
      result[index] = {
        ...result[index],
        ...fields,
        activities: mergeActivities(result[index].activities, patch.activities)
      };
      return;
    }

    if (!Object.keys(fields).length && !patch?.activities?.length) return;
    const created = createExperienceItem();
    result.push({
      ...created,
      ...fields,
      activities: mergeActivities(created.activities, patch.activities)
    });
  });

  return result;
}

function mergeSimpleList(currentItems, patches, { createItem, fields, identity }) {
  if (!Array.isArray(patches)) return currentItems;
  const result = [...currentItems];

  patches.forEach((patch) => {
    const values = definedFields(patch, fields);
    if (!Object.keys(values).length) return;

    const index = result.findIndex((item) => (
      (patch?.id && item.id === patch.id)
      || (
        normalize(values[identity[0]])
        && identity
          .filter((field) => normalize(values[field]))
          .every((field) => normalize(item[field]) === normalize(values[field]))
      )
    ));

    if (index >= 0) {
      result[index] = { ...result[index], ...values };
    } else {
      result.push({ ...createItem(), ...values });
    }
  });

  return result;
}

export function applyReceiptAiPatch(currentData, patch) {
  return {
    ...currentData,
    ...definedFields(patch, receiptFields)
  };
}

export function applyResumeAiPatch(currentData, patch) {
  const personal = definedFields(
    patch?.personal,
    ['fullName', 'professionalTitle', 'phone', 'email', 'location']
  );
  const professionalSummary = definedFields(patch, ['professionalSummary']);

  return {
    ...currentData,
    ...professionalSummary,
    personal: {
      ...currentData.personal,
      ...personal,
      photo: currentData.personal.photo
    },
    education: mergeSimpleList(currentData.education, patch?.education, {
      createItem: createEducationItem,
      fields: ['course', 'institution', 'startDate', 'endDate'],
      identity: ['course', 'institution']
    }),
    courses: mergeSimpleList(currentData.courses, patch?.courses, {
      createItem: createCourseItem,
      fields: ['name', 'institution', 'completionDate'],
      identity: ['name']
    }),
    skills: mergeSimpleList(currentData.skills, patch?.skills, {
      createItem: createSkillItem,
      fields: ['name'],
      identity: ['name']
    }),
    experiences: mergeExperiences(currentData.experiences, patch?.experiences)
  };
}

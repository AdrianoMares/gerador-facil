import { validateRequiredFields } from '../../utils/validators.js';

let itemSequence = 0;

function createItemId(prefix) {
  itemSequence += 1;
  return `${prefix}-${itemSequence}`;
}

export const createEducationItem = () => ({
  id: createItemId('education'),
  course: '',
  institution: '',
  startDate: '',
  endDate: ''
});

export const createCourseItem = () => ({
  id: createItemId('course'),
  name: '',
  institution: '',
  completionDate: ''
});

export const createSkillItem = () => ({
  id: createItemId('skill'),
  name: ''
});

export const createActivityItem = () => ({
  id: createItemId('activity'),
  description: ''
});

export const createExperienceItem = () => ({
  id: createItemId('experience'),
  company: '',
  role: '',
  startDate: '',
  endDate: '',
  current: false,
  activities: [createActivityItem()]
});

export const createResumeData = () => ({
  personal: {
    fullName: '',
    professionalTitle: '',
    phone: '',
    email: '',
    location: '',
    photo: ''
  },
  professionalSummary: '',
  education: [],
  courses: [],
  skills: [],
  experiences: []
});

const resumeRequiredFields = [
  { path: 'personal.fullName', label: 'Nome completo' },
  { path: 'personal.professionalTitle', label: 'Título profissional' },
  { path: 'personal.phone', label: 'Telefone' },
  { path: 'personal.email', label: 'E-mail' },
  { path: 'personal.location', label: 'Cidade/UF' },
  { path: 'professionalSummary', label: 'Resumo profissional' }
];

export function validateResumeData(data) {
  const dynamicRules = [];

  data.experiences.forEach((experience, index) => {
    const number = index + 1;
    dynamicRules.push(
      { path: `experiences.${index}.company`, label: `Empresa da experiência ${number}` },
      { path: `experiences.${index}.role`, label: `Cargo da experiência ${number}` },
      { path: `experiences.${index}.startDate`, label: `Início da experiência ${number}` },
      {
        path: `experiences.${index}.endDate`,
        label: `Fim da experiência ${number} ou vínculo atual`,
        validate: (value) => experience.current || Boolean(value)
      },
      {
        path: `experiences.${index}.activities`,
        label: `Atividade da experiência ${number}`,
        validate: (activities) => activities.some((activity) => activity.description.trim())
      }
    );
  });

  data.education.forEach((education, index) => {
    const number = index + 1;
    dynamicRules.push(
      { path: `education.${index}.course`, label: `Formação ${number}` },
      { path: `education.${index}.institution`, label: `Instituição da formação ${number}` }
    );
  });

  data.courses.forEach((course, index) => {
    dynamicRules.push({ path: `courses.${index}.name`, label: `Curso complementar ${index + 1}` });
  });

  data.skills.forEach((skill, index) => {
    dynamicRules.push({ path: `skills.${index}.name`, label: `Habilidade ${index + 1}` });
  });

  return validateRequiredFields(data, [...resumeRequiredFields, ...dynamicRules]);
}

function updateItemSequence(data) {
  const ids = [
    ...data.education,
    ...data.courses,
    ...data.skills,
    ...data.experiences,
    ...data.experiences.flatMap((experience) => experience.activities)
  ].map((item) => item.id);

  ids.forEach((id) => {
    const sequence = Number(String(id).match(/-(\d+)$/)?.[1]);
    if (Number.isInteger(sequence)) itemSequence = Math.max(itemSequence, sequence);
  });
}

export function serializeResumeDraft(data) {
  const personal = { ...data.personal };
  delete personal.photo;

  return {
    ...data,
    personal
  };
}

export function hydrateResumeDraft(payload, currentData = createResumeData()) {
  const initialData = createResumeData();
  const savedData = payload && typeof payload === 'object' ? payload : {};
  const hydratedData = {
    ...initialData,
    ...savedData,
    personal: {
      ...initialData.personal,
      ...(savedData.personal && typeof savedData.personal === 'object' ? savedData.personal : {}),
      photo: currentData.personal?.photo || ''
    },
    education: Array.isArray(savedData.education) ? savedData.education : [],
    courses: Array.isArray(savedData.courses) ? savedData.courses : [],
    skills: Array.isArray(savedData.skills) ? savedData.skills : [],
    experiences: Array.isArray(savedData.experiences)
      ? savedData.experiences.map((experience) => ({
          ...experience,
          activities: Array.isArray(experience.activities) ? experience.activities : []
        }))
      : []
  };

  updateItemSequence(hydratedData);
  return hydratedData;
}

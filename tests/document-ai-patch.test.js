import assert from 'node:assert/strict';
import test from 'node:test';
import { createResumeData, createExperienceItem } from '../src/tools/resume/resumeSchema.js';
import { applyReceiptAiPatch, applyResumeAiPatch } from '../src/utils/documentAiPatch.js';

test('patch do recibo atualiza somente campos conhecidos sem apagar os demais', () => {
  const current = {
    payerName: 'Maria',
    payerDocument: '',
    recipientName: 'João',
    recipientDocument: '',
    amount: '',
    description: '',
    city: 'Aracruz',
    date: '2026-09-01'
  };

  const result = applyReceiptAiPatch(current, {
    amount: '450',
    description: 'Manutenção do computador',
    status: 'paid',
    city: ''
  });

  assert.equal(result.amount, '450');
  assert.equal(result.description, 'Manutenção do computador');
  assert.equal(result.city, 'Aracruz');
  assert.equal('status' in result, false);
});

test('patch do currículo preserva foto e IDs e não duplica experiência', () => {
  const experience = {
    ...createExperienceItem(),
    company: 'Contábil Sul',
    role: 'Contador',
    startDate: '2020-01'
  };
  const current = {
    ...createResumeData(),
    personal: {
      ...createResumeData().personal,
      fullName: 'Carlos Silva',
      photo: 'data:image/png;base64,local-only'
    },
    experiences: [experience]
  };

  const result = applyResumeAiPatch(current, {
    personal: { location: 'Aracruz/ES', photo: 'não permitido' },
    experiences: [{
      id: experience.id,
      company: 'Contábil Sul',
      role: 'Contador',
      activities: [{ description: 'Atuação com imposto de renda.' }]
    }]
  });

  assert.equal(result.personal.photo, 'data:image/png;base64,local-only');
  assert.equal(result.personal.location, 'Aracruz/ES');
  assert.equal(result.experiences.length, 1);
  assert.equal(result.experiences[0].id, experience.id);
  assert.equal(result.experiences[0].activities.length, 1);
  assert.equal(result.experiences[0].activities[0].description, 'Atuação com imposto de renda.');
});

test('novos itens do currículo recebem IDs internos e são deduplicados', () => {
  const current = createResumeData();
  const first = applyResumeAiPatch(current, {
    education: [{ course: 'Ciências Contábeis', institution: 'Universidade Alfa' }],
    skills: [{ name: 'Departamento fiscal' }]
  });
  const second = applyResumeAiPatch(first, {
    education: [{ course: 'Ciências Contábeis', institution: 'Universidade Alfa' }],
    skills: [{ name: 'Departamento fiscal' }]
  });

  assert.match(first.education[0].id, /^education-/);
  assert.match(first.skills[0].id, /^skill-/);
  assert.equal(second.education.length, 1);
  assert.equal(second.skills.length, 1);
});

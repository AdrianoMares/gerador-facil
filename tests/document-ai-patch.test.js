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

test('patch do recibo aplica fail-safe a valores inválidos sem alterar os atuais', () => {
  const current = {
    payerName: 'Maria',
    payerDocument: '',
    recipientName: 'João Atual',
    recipientDocument: '',
    amount: '100',
    description: 'Serviço anterior',
    city: 'Vitória',
    date: '2026-08-31'
  };

  const invalid = applyReceiptAiPatch(current, {
    payerName: 'Maria Silva',
    recipientName: '(vazio) - não foi possível inferir o recebedor',
    amount: 'R$ 450 porque foi pago hoje',
    description: 'manutenção de computador',
    city: `Aracruz ${'explicação '.repeat(20)}`,
    date: 'hoje'
  });

  assert.equal(invalid.payerName, 'Maria Silva');
  assert.equal(invalid.recipientName, 'João Atual');
  assert.equal(invalid.amount, '100');
  assert.equal(invalid.description, 'manutenção de computador');
  assert.equal(invalid.city, 'Vitória');
  assert.equal(invalid.date, '2026-08-31');

  const valid = applyReceiptAiPatch(invalid, {
    recipientName: 'João Neves',
    amount: '450',
    city: 'Aracruz',
    date: '2026-09-01'
  });

  assert.equal(valid.recipientName, 'João Neves');
  assert.equal(valid.amount, '450');
  assert.equal(valid.city, 'Aracruz');
  assert.equal(valid.date, '2026-09-01');
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

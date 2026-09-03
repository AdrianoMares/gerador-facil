import assert from 'node:assert/strict';
import test from 'node:test';
import { formatBrazilianPhone } from '../src/utils/formatters.js';

test('formata celulares e telefones fixos brasileiros para apresentação', () => {
  assert.equal(formatBrazilianPhone('27999999999'), '(27) 99999-9999');
  assert.equal(formatBrazilianPhone('2733334444'), '(27) 3333-4444');
  assert.equal(formatBrazilianPhone('+55 27 99999-9999'), '+55 (27) 99999-9999');
});

test('preserva número estrangeiro ou formato brasileiro inválido', () => {
  assert.equal(formatBrazilianPhone('+1 415 555 2671'), '+1 415 555 2671');
  assert.equal(formatBrazilianPhone('1033334444'), '1033334444');
  assert.equal(formatBrazilianPhone('2711112222'), '2711112222');
  assert.equal(formatBrazilianPhone('telefone indisponível'), 'telefone indisponível');
});

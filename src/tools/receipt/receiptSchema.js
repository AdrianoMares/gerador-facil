import { validateRequiredFields } from '../../utils/validators';

export const createReceiptData = () => {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);

  return {
    payerName: '',
    payerDocument: '',
    recipientName: '',
    recipientDocument: '',
    amount: '',
    description: '',
    city: '',
    date: localDate.toISOString().slice(0, 10)
  };
};

const receiptRequiredFields = [
  { path: 'payerName', label: 'Quem pagou' },
  { path: 'amount', label: 'Valor', validate: (value) => Number(value) > 0 },
  { path: 'description', label: 'Referente a' },
  { path: 'recipientName', label: 'Quem recebeu' },
  { path: 'city', label: 'Cidade' },
  { path: 'date', label: 'Data' }
];

export function validateReceiptData(data) {
  return validateRequiredFields(data, receiptRequiredFields);
}

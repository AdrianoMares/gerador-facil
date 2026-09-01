import { Input } from '../../components/Input';

const fields = [
  { name: 'payerName', label: 'Quem pagou', placeholder: 'Nome do pagador', required: true },
  { name: 'payerDocument', label: 'CPF/CNPJ do pagador', placeholder: 'Opcional' },
  { name: 'amount', label: 'Valor', placeholder: '0,00', type: 'number', min: '0', step: '0.01', required: true },
  { name: 'description', label: 'Referente a', placeholder: 'Descrição do pagamento', required: true },
  { name: 'recipientName', label: 'Quem recebeu', placeholder: 'Nome do recebedor', required: true },
  { name: 'recipientDocument', label: 'CPF/CNPJ do recebedor', placeholder: 'Opcional' },
  { name: 'city', label: 'Cidade', placeholder: 'Cidade onde o recibo foi emitido', required: true },
  { name: 'date', label: 'Data', type: 'date', required: true }
];

export function ReceiptForm({ data, onChange }) {
  function handleChange(event) {
    const { name, value } = event.target;
    onChange({ ...data, [name]: value });
  }

  return (
    <section className="card document-form-card" aria-labelledby="receipt-form-title">
      <h2>Dados do recibo</h2>
      <p id="receipt-form-title">Preencha os dados abaixo. Os documentos são opcionais.</p>
      <form className="form-grid form-grid-two" onSubmit={(event) => event.preventDefault()}>
        {fields.map((field) => (
          <label className="form-field" key={field.name}>
            <span>{field.label}{field.required && <span aria-hidden="true"> *</span>}</span>
            <Input
              {...field}
              aria-required={field.required || undefined}
              value={data[field.name]}
              onChange={handleChange}
            />
          </label>
        ))}
      </form>
    </section>
  );
}

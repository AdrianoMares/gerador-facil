import { Input } from '../../components/Input';
import { Button } from '../../components/Button';

export function ReceiptForm() {
  return (
    <div className="card">
      <h2>Dados do recibo</h2>
      <form className="form-grid">
        <Input placeholder="Nome de quem recebeu" />
        <Input placeholder="Nome de quem pagou" />
        <Input placeholder="Valor recebido" />
        <Input placeholder="Referente a" />
        <Input placeholder="Cidade" />
        <Input type="date" />
        <Button type="button">Gerar recibo</Button>
      </form>
    </div>
  );
}

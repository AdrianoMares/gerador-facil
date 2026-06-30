import { Input } from '../../components/Input';
import { Button } from '../../components/Button';

export function ResumeForm() {
  return (
    <div className="card">
      <h2>Dados do currículo</h2>
      <form className="form-grid">
        <Input placeholder="Nome completo" />
        <Input placeholder="Cargo desejado" />
        <Input placeholder="Telefone" />
        <Input placeholder="E-mail" />
        <textarea className="textarea" placeholder="Resumo profissional" rows="5" />
        <Button type="button">Gerar currículo</Button>
      </form>
    </div>
  );
}

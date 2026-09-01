export function ModeSelector() {
  return (
    <section className="mode-selector" aria-labelledby="mode-selector-title">
      <div>
        <span className="eyebrow">Como deseja começar?</span>
        <h2 id="mode-selector-title">Modo de preenchimento</h2>
      </div>
      <div className="mode-options" role="group" aria-label="Modo de preenchimento">
        <button className="mode-option mode-option-active" type="button" aria-pressed="true">
          <span>Preenchimento Manual</span>
          <small>Preencha e visualize agora</small>
        </button>
        <button className="mode-option" type="button" disabled>
          <span>Criar com IA</span>
          <small>Em breve</small>
        </button>
      </div>
    </section>
  );
}

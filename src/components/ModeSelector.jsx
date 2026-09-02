export function ModeSelector({ mode, onChange }) {
  return (
    <section className="mode-selector" aria-labelledby="mode-selector-title">
      <div>
        <span className="eyebrow">Como deseja começar?</span>
        <h2 id="mode-selector-title">Modo de preenchimento</h2>
      </div>
      <div className="mode-options" role="group" aria-label="Modo de preenchimento">
        <button
          className={`mode-option${mode === 'manual' ? ' mode-option-active' : ''}`}
          type="button"
          aria-pressed={mode === 'manual'}
          onClick={() => onChange('manual')}
        >
          <span>Preenchimento Manual</span>
          <small>Edite todos os campos diretamente</small>
        </button>
        <button
          className={`mode-option${mode === 'ai' ? ' mode-option-active' : ''}`}
          type="button"
          aria-pressed={mode === 'ai'}
          onClick={() => onChange('ai')}
        >
          <span>Criar com IA</span>
          <small>Conte os dados e receba ajuda</small>
        </button>
      </div>
    </section>
  );
}

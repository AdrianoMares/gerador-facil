import { formatResumePeriod } from './resumeUtils';
import { formatBrazilianPhone } from '../../utils/formatters';

function ResumeSection({ title, children, emptyMessage }) {
  return (
    <section className="resume-section">
      <h4>{title}</h4>
      {children || <p className="resume-placeholder">{emptyMessage}</p>}
    </section>
  );
}

export function ResumePreview({ data }) {
  const { personal } = data;

  return (
    <section className="preview-panel resume-preview-panel" aria-labelledby="resume-preview-title">
      <div className="preview-heading">
        <span className="eyebrow">Atualização em tempo real</span>
        <h2 id="resume-preview-title">Prévia do currículo</h2>
      </div>
      <div className="resume-paper-wrap">
        <article className="resume-paper">
          <aside className="resume-sidebar">
            <div className="resume-photo" aria-label={personal.photo ? 'Foto do currículo' : 'Espaço para foto'}>
              {personal.photo ? <img src={personal.photo} alt="" /> : <span>Foto</span>}
            </div>

            <ResumeSection title="Formação Acadêmica" emptyMessage="Adicione sua formação acadêmica.">
              {data.education.length > 0 && (
                <div className="resume-stack">
                  {data.education.map((education) => (
                    <div className="resume-list-item" key={education.id}>
                      <strong>{education.course || 'Formação'}</strong>
                      <span>{education.institution || 'Instituição'}</span>
                      <small>{formatResumePeriod(education.startDate, education.endDate)}</small>
                    </div>
                  ))}
                </div>
              )}
            </ResumeSection>

            <ResumeSection title="Cursos Complementares" emptyMessage="Adicione cursos relevantes.">
              {data.courses.length > 0 && (
                <div className="resume-stack">
                  {data.courses.map((course) => (
                    <div className="resume-list-item" key={course.id}>
                      <strong>{course.name || 'Curso'}</strong>
                      {course.institution && <span>{course.institution}</span>}
                      {course.completionDate && <small>{formatResumePeriod(course.completionDate, '', false).split(' — ')[0]}</small>}
                    </div>
                  ))}
                </div>
              )}
            </ResumeSection>

            <ResumeSection title="Habilidades" emptyMessage="Adicione suas principais habilidades.">
              {data.skills.length > 0 && (
                <ul className="resume-skills">
                  {data.skills.map((skill) => <li key={skill.id}>{skill.name || 'Habilidade'}</li>)}
                </ul>
              )}
            </ResumeSection>
          </aside>

          <div className="resume-main">
            <header className="resume-nameplate">
              <span className="resume-accent" aria-hidden="true" />
              <h3>{personal.fullName || 'Seu nome completo'}</h3>
              <p>{personal.professionalTitle || 'Título profissional'}</p>
            </header>

            <div className="resume-contacts">
              <span>{personal.phone ? formatBrazilianPhone(personal.phone) : 'Telefone'}</span>
              <span>{personal.email || 'E-mail'}</span>
              <span>{personal.location || 'Cidade/UF'}</span>
            </div>

            <ResumeSection title="Resumo Profissional" emptyMessage="Seu resumo profissional aparecerá aqui.">
              {data.professionalSummary && <p className="resume-summary">{data.professionalSummary}</p>}
            </ResumeSection>

            <ResumeSection title="Experiência Profissional" emptyMessage="Adicione suas experiências profissionais.">
              {data.experiences.length > 0 && (
                <div className="resume-experiences">
                  {data.experiences.map((experience) => (
                    <article className="resume-experience" key={experience.id}>
                      <div className="resume-experience-heading">
                        <div>
                          <h5>{experience.role || 'Cargo'}</h5>
                          <strong>{experience.company || 'Empresa'}</strong>
                        </div>
                        <span>{formatResumePeriod(experience.startDate, experience.endDate, experience.current)}</span>
                      </div>
                      {experience.activities.some((activity) => activity.description.trim()) && (
                        <ul>
                          {experience.activities
                            .filter((activity) => activity.description.trim())
                            .map((activity) => <li key={activity.id}>{activity.description}</li>)}
                        </ul>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </ResumeSection>
          </div>
        </article>
      </div>
    </section>
  );
}

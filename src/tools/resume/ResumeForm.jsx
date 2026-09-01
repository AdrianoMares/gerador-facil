import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import {
  createActivityItem,
  createCourseItem,
  createEducationItem,
  createExperienceItem,
  createSkillItem
} from './resumeSchema';

function RemoveButton({ onClick, label }) {
  return (
    <button className="text-button text-button-danger" type="button" onClick={onClick}>
      {label}
    </button>
  );
}

function Field({ label, children, className = '' }) {
  return (
    <label className={`form-field ${className}`.trim()}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function ResumeForm({ data, onChange }) {
  function updatePersonal(field, value) {
    onChange({
      ...data,
      personal: { ...data.personal, [field]: value }
    });
  }

  function updateListItem(listName, itemId, field, value) {
    onChange({
      ...data,
      [listName]: data[listName].map((item) => (
        item.id === itemId ? { ...item, [field]: value } : item
      ))
    });
  }

  function addListItem(listName, item) {
    onChange({ ...data, [listName]: [...data[listName], item] });
  }

  function removeListItem(listName, itemId) {
    onChange({ ...data, [listName]: data[listName].filter((item) => item.id !== itemId) });
  }

  function updateActivity(experienceId, activityId, description) {
    onChange({
      ...data,
      experiences: data.experiences.map((experience) => (
        experience.id === experienceId
          ? {
              ...experience,
              activities: experience.activities.map((activity) => (
                activity.id === activityId ? { ...activity, description } : activity
              ))
            }
          : experience
      ))
    });
  }

  function addActivity(experienceId) {
    onChange({
      ...data,
      experiences: data.experiences.map((experience) => (
        experience.id === experienceId
          ? { ...experience, activities: [...experience.activities, createActivityItem()] }
          : experience
      ))
    });
  }

  function removeActivity(experienceId, activityId) {
    onChange({
      ...data,
      experiences: data.experiences.map((experience) => (
        experience.id === experienceId
          ? { ...experience, activities: experience.activities.filter((activity) => activity.id !== activityId) }
          : experience
      ))
    });
  }

  function handlePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.addEventListener('load', () => updatePersonal('photo', reader.result));
    reader.readAsDataURL(file);
  }

  return (
    <section className="card document-form-card" aria-labelledby="resume-form-title">
      <h2 id="resume-form-title">Dados do currículo</h2>
      <p>Preencha as seções que fazem sentido para sua trajetória.</p>
      <form className="resume-form" onSubmit={(event) => event.preventDefault()}>
        <fieldset className="form-section">
          <legend>Informações pessoais</legend>
          <div className="form-grid form-grid-two">
            <Field label="Nome completo *">
              <Input value={data.personal.fullName} onChange={(event) => updatePersonal('fullName', event.target.value)} required />
            </Field>
            <Field label="Título profissional *">
              <Input value={data.personal.professionalTitle} onChange={(event) => updatePersonal('professionalTitle', event.target.value)} placeholder="Ex.: Assistente administrativo" required />
            </Field>
            <Field label="Telefone *">
              <Input type="tel" value={data.personal.phone} onChange={(event) => updatePersonal('phone', event.target.value)} required />
            </Field>
            <Field label="E-mail *">
              <Input type="email" value={data.personal.email} onChange={(event) => updatePersonal('email', event.target.value)} required />
            </Field>
            <Field label="Cidade/UF *">
              <Input value={data.personal.location} onChange={(event) => updatePersonal('location', event.target.value)} placeholder="Ex.: Recife/PE" required />
            </Field>
            <Field label="Foto opcional">
              <Input type="file" accept="image/*" onChange={handlePhoto} />
            </Field>
          </div>
          {data.personal.photo && (
            <button className="text-button text-button-danger" type="button" onClick={() => updatePersonal('photo', '')}>
              Remover foto
            </button>
          )}
        </fieldset>

        <fieldset className="form-section">
          <legend>Resumo profissional</legend>
          <Field label="Apresente seu perfil, objetivos e principais qualificações *">
            <textarea
              className="textarea"
              rows="6"
              value={data.professionalSummary}
              onChange={(event) => onChange({ ...data, professionalSummary: event.target.value })}
              required
            />
          </Field>
        </fieldset>

        <fieldset className="form-section">
          <legend>Experiências profissionais</legend>
          <div className="dynamic-list">
            {data.experiences.map((experience, index) => (
              <div className="dynamic-item" key={experience.id}>
                <div className="dynamic-item-heading">
                  <strong>Experiência {index + 1}</strong>
                  <RemoveButton onClick={() => removeListItem('experiences', experience.id)} label="Remover experiência" />
                </div>
                <div className="form-grid form-grid-two">
                  <Field label="Empresa *">
                    <Input value={experience.company} onChange={(event) => updateListItem('experiences', experience.id, 'company', event.target.value)} required />
                  </Field>
                  <Field label="Cargo *">
                    <Input value={experience.role} onChange={(event) => updateListItem('experiences', experience.id, 'role', event.target.value)} required />
                  </Field>
                  <Field label="Início *">
                    <Input type="month" value={experience.startDate} onChange={(event) => updateListItem('experiences', experience.id, 'startDate', event.target.value)} required />
                  </Field>
                  <Field label="Fim">
                    <Input type="month" value={experience.endDate} onChange={(event) => updateListItem('experiences', experience.id, 'endDate', event.target.value)} disabled={experience.current} />
                  </Field>
                </div>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={experience.current}
                    onChange={(event) => {
                      const current = event.target.checked;
                      onChange({
                        ...data,
                        experiences: data.experiences.map((item) => (
                          item.id === experience.id ? { ...item, current, endDate: current ? '' : item.endDate } : item
                        ))
                      });
                    }}
                  />
                  Trabalho atualmente aqui
                </label>
                <div className="activities-list">
                  <span className="field-group-label">Atividades</span>
                  {experience.activities.map((activity, activityIndex) => (
                    <div className="inline-field-row" key={activity.id}>
                      <Input
                        aria-label={`Atividade ${activityIndex + 1} da experiência ${index + 1}`}
                        value={activity.description}
                        onChange={(event) => updateActivity(experience.id, activity.id, event.target.value)}
                        placeholder="Descreva uma responsabilidade ou resultado"
                      />
                      <RemoveButton onClick={() => removeActivity(experience.id, activity.id)} label="Remover" />
                    </div>
                  ))}
                  <button className="text-button" type="button" onClick={() => addActivity(experience.id)}>+ Adicionar atividade</button>
                </div>
              </div>
            ))}
          </div>
          <Button type="button" onClick={() => addListItem('experiences', createExperienceItem())}>+ Adicionar experiência</Button>
        </fieldset>

        <fieldset className="form-section">
          <legend>Formação acadêmica</legend>
          <div className="dynamic-list">
            {data.education.map((education, index) => (
              <div className="dynamic-item" key={education.id}>
                <div className="dynamic-item-heading">
                  <strong>Formação {index + 1}</strong>
                  <RemoveButton onClick={() => removeListItem('education', education.id)} label="Remover formação" />
                </div>
                <div className="form-grid form-grid-two">
                  <Field label="Curso ou formação *">
                    <Input value={education.course} onChange={(event) => updateListItem('education', education.id, 'course', event.target.value)} required />
                  </Field>
                  <Field label="Instituição *">
                    <Input value={education.institution} onChange={(event) => updateListItem('education', education.id, 'institution', event.target.value)} required />
                  </Field>
                  <Field label="Início">
                    <Input type="month" value={education.startDate} onChange={(event) => updateListItem('education', education.id, 'startDate', event.target.value)} />
                  </Field>
                  <Field label="Conclusão">
                    <Input type="month" value={education.endDate} onChange={(event) => updateListItem('education', education.id, 'endDate', event.target.value)} />
                  </Field>
                </div>
              </div>
            ))}
          </div>
          <Button type="button" onClick={() => addListItem('education', createEducationItem())}>+ Adicionar formação</Button>
        </fieldset>

        <fieldset className="form-section">
          <legend>Cursos complementares</legend>
          <div className="dynamic-list">
            {data.courses.map((course, index) => (
              <div className="dynamic-item" key={course.id}>
                <div className="dynamic-item-heading">
                  <strong>Curso {index + 1}</strong>
                  <RemoveButton onClick={() => removeListItem('courses', course.id)} label="Remover curso" />
                </div>
                <div className="form-grid form-grid-two">
                  <Field label="Nome do curso *">
                    <Input value={course.name} onChange={(event) => updateListItem('courses', course.id, 'name', event.target.value)} required />
                  </Field>
                  <Field label="Instituição">
                    <Input value={course.institution} onChange={(event) => updateListItem('courses', course.id, 'institution', event.target.value)} />
                  </Field>
                  <Field label="Conclusão">
                    <Input type="month" value={course.completionDate} onChange={(event) => updateListItem('courses', course.id, 'completionDate', event.target.value)} />
                  </Field>
                </div>
              </div>
            ))}
          </div>
          <Button type="button" onClick={() => addListItem('courses', createCourseItem())}>+ Adicionar curso</Button>
        </fieldset>

        <fieldset className="form-section">
          <legend>Habilidades</legend>
          <div className="dynamic-list compact-list">
            {data.skills.map((skill, index) => (
              <div className="inline-field-row" key={skill.id}>
                <Input
                  aria-label={`Habilidade ${index + 1}`}
                  value={skill.name}
                  onChange={(event) => updateListItem('skills', skill.id, 'name', event.target.value)}
                  placeholder="Ex.: Comunicação"
                  required
                />
                <RemoveButton onClick={() => removeListItem('skills', skill.id)} label="Remover" />
              </div>
            ))}
          </div>
          <Button type="button" onClick={() => addListItem('skills', createSkillItem())}>+ Adicionar habilidade</Button>
        </fieldset>
      </form>
    </section>
  );
}

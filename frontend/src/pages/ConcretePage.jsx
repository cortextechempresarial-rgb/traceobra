import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

const emptyChecklist = {
  forms_clean: false,
  reinforcement_checked: false,
  cover_checked: false,
  slump_test_recorded: false,
  samples_taken: false,
  release_authorized: false,
};

const checklistItems = [
  ['forms_clean', 'Fôrmas limpas e conferidas'],
  ['reinforcement_checked', 'Armaduras conferidas'],
  ['cover_checked', 'Cobrimentos verificados'],
  ['slump_test_recorded', 'Ensaio de abatimento registrado'],
  ['samples_taken', 'Corpos de prova coletados'],
  ['release_authorized', 'Liberação para concretagem autorizada'],
];

const statusLabels = {
  planned: 'Planejada',
  pouring: 'Em concretagem',
  awaiting_inspection: 'Aguardando FVS',
  approved: 'Aprovada',
  rejected: 'Reprovada',
};

export default function ConcretePage() {
  const [projects, setProjects] = useState([]);
  const [layers, setLayers] = useState([]);
  const [pours, setPours] = useState([]);
  const [form, setForm] = useState({
    project_id: '',
    map_layer_id: '',
    element_name: '',
    element_guid: '',
    concrete_class: '',
    volume_m3: '',
    planned_at: '',
    responsible: '',
    notes: '',
  });
  const [review, setReview] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      const responses = await Promise.all([
        apiFetch('/projects'),
        apiFetch('/maps'),
        apiFetch('/concrete-pours'),
      ]);
      const results = await Promise.all(responses.map((response) => response.json()));
      const failed = responses.findIndex((response) => !response.ok);
      if (failed !== -1) throw new Error(results[failed].message || 'Falha ao carregar dados da obra.');

      const projectList = results[0].data || [];
      setProjects(projectList);
      setLayers(results[1].data || []);
      setPours(results[2].data || []);
      setForm((current) => ({ ...current, project_id: current.project_id || projectList[0]?.id || '' }));
    } catch (requestError) {
      setError(requestError.message || 'Não foi possível carregar concretagens.');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const request = async (path, options) => {
    const response = await apiFetch(path, options);
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Não foi possível salvar a operação.');
    return result.data;
  };

  const createPour = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      const created = await request('/concrete-pours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          map_layer_id: form.map_layer_id || null,
          volume_m3: Number(form.volume_m3),
          planned_at: form.planned_at ? new Date(form.planned_at).toISOString() : null,
        }),
      });
      setPours((current) => [created, ...current]);
      setForm((current) => ({
        ...current,
        map_layer_id: '',
        element_name: '',
        element_guid: '',
        concrete_class: '',
        volume_m3: '',
        planned_at: '',
        responsible: '',
        notes: '',
      }));
      setMessage('Concretagem planejada.');
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const updatePour = async (pour, status, inspection = null) => {
    setError('');
    setMessage('');
    try {
      const updated = await request(`/concrete-pours/${pour.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inspection ? {
          status,
          inspector: inspection.inspector,
          inspection_checklist: inspection.checklist,
          notes: inspection.notes,
        } : { status }),
      });
      setPours((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setMessage(`Registro atualizado: ${statusLabels[updated.status]}.`);
      if (status === 'approved' || status === 'rejected') setReview(null);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const beginReview = (pour) => {
    setReview({
      pour,
      inspector: pour.inspector || '',
      notes: pour.notes || '',
      checklist: { ...emptyChecklist, ...(pour.inspection_checklist || {}) },
    });
  };

  const projectLayers = layers.filter((layer) => layer.project_id === form.project_id);

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Concretagem e FVS</h1>
          <p className="muted">Planejamento, execução e liberação de peças estruturais</p>
        </div>
      </header>

      {message && <div className="form-message">{message}</div>}
      {error && <div className="form-message error">{error}</div>}

      <section className="card">
        <h2>Planejar concretagem</h2>
        <form className="form-grid" onSubmit={createPour}>
          <div className="field">
            <label>Obra</label>
            <select required value={form.project_id} onChange={(event) => setForm({ ...form, project_id: event.target.value, map_layer_id: '' })}>
              <option value="">Selecione a obra</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Camada do mapa</label>
            <select value={form.map_layer_id} onChange={(event) => setForm({ ...form, map_layer_id: event.target.value })}>
              <option value="">Sem camada vinculada</option>
              {projectLayers.map((layer) => <option key={layer.id} value={layer.id}>{layer.layer_name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Peça / elemento</label>
            <input required value={form.element_name} onChange={(event) => setForm({ ...form, element_name: event.target.value })} placeholder="Ex.: Pilar P-12, laje L2" />
          </div>
          <div className="field">
            <label>GUID BIM (opcional)</label>
            <input value={form.element_guid} onChange={(event) => setForm({ ...form, element_guid: event.target.value })} />
          </div>
          <div className="field">
            <label>Classe do concreto</label>
            <input value={form.concrete_class} onChange={(event) => setForm({ ...form, concrete_class: event.target.value })} placeholder="Ex.: C30" />
          </div>
          <div className="field">
            <label>Volume (m³)</label>
            <input required min="0.001" step="0.001" type="number" value={form.volume_m3} onChange={(event) => setForm({ ...form, volume_m3: event.target.value })} />
          </div>
          <div className="field">
            <label>Previsão</label>
            <input type="datetime-local" value={form.planned_at} onChange={(event) => setForm({ ...form, planned_at: event.target.value })} />
          </div>
          <div className="field">
            <label>Responsável pela execução</label>
            <input value={form.responsible} onChange={(event) => setForm({ ...form, responsible: event.target.value })} />
          </div>
          <div className="field full-width">
            <label>Observações</label>
            <textarea rows="3" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </div>
          <div className="field full-width">
            <button className="primary-btn" type="submit" disabled={!projects.length}>Registrar planejamento</button>
          </div>
        </form>
      </section>

      {review && (
        <section className="card form-card">
          <h2>Ficha de verificação · {review.pour.element_name}</h2>
          <div className="inspection-checklist">
            {checklistItems.map(([key, label]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={review.checklist[key] === true}
                  onChange={(event) => setReview((current) => ({
                    ...current,
                    checklist: { ...current.checklist, [key]: event.target.checked },
                  }))}
                />
                {label}
              </label>
            ))}
          </div>
          <div className="form-grid" style={{ marginTop: 18 }}>
            <div className="field">
              <label>Inspetor</label>
              <input value={review.inspector} onChange={(event) => setReview({ ...review, inspector: event.target.value })} />
            </div>
            <div className="field">
              <label>Observação / motivo</label>
              <input value={review.notes} onChange={(event) => setReview({ ...review, notes: event.target.value })} />
            </div>
          </div>
          <div className="form-actions">
            <button className="secondary-btn" type="button" onClick={() => updatePour(review.pour, 'awaiting_inspection', review)}>Salvar checklist</button>
            <button className="secondary-btn" type="button" onClick={() => updatePour(review.pour, 'rejected', review)}>Reprovar</button>
            <button className="primary-btn" type="button" onClick={() => updatePour(review.pour, 'approved', review)}>Aprovar FVS</button>
          </div>
        </section>
      )}

      <section className="table-wrap form-card">
        <table>
          <thead>
            <tr><th>Elemento</th><th>Obra / camada</th><th>Volume</th><th>Previsão</th><th>Status</th><th>Ação</th></tr>
          </thead>
          <tbody>
            {pours.map((pour) => (
              <tr key={pour.id}>
                <td>{pour.element_name}<small className="table-subtext">{pour.concrete_class || 'Classe não informada'}{pour.element_guid ? ` · ${pour.element_guid}` : ''}</small></td>
                <td>{pour.project_name}<small className="table-subtext">{pour.layer_name || 'Sem camada vinculada'}</small></td>
                <td>{Number(pour.volume_m3).toLocaleString('pt-BR')} m³</td>
                <td>{pour.planned_at ? new Date(pour.planned_at).toLocaleString('pt-BR') : 'Sem previsão'}</td>
                <td><span className={`badge ${pour.status === 'approved' ? 'success' : pour.status === 'rejected' ? 'danger' : 'warning'}`}>{statusLabels[pour.status] || pour.status}</span></td>
                <td>
                  {pour.status === 'planned' && <button className="secondary-btn" onClick={() => updatePour(pour, 'pouring')}>Iniciar</button>}
                  {pour.status === 'pouring' && <button className="secondary-btn" onClick={() => updatePour(pour, 'awaiting_inspection')}>Enviar à FVS</button>}
                  {pour.status === 'awaiting_inspection' && <button className="secondary-btn" onClick={() => beginReview(pour)}>Inspecionar</button>}
                  {pour.status === 'approved' && <span>Concluída</span>}
                </td>
              </tr>
            ))}
            {!pours.length && <tr><td colSpan="6">Nenhuma concretagem registrada.</td></tr>}
          </tbody>
        </table>
      </section>
    </>
  );
}
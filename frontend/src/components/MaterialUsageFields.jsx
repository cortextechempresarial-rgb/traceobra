import { Plus, Trash2 } from 'lucide-react';

const newLine = () => ({ material_id: '', quantity: '1' });

export default function MaterialUsageFields({ materials, value, onChange }) {
  const updateLine = (index, field, nextValue) => {
    onChange(value.map((line, lineIndex) => (
      lineIndex === index ? { ...line, [field]: nextValue } : line
    )));
  };

  return (
    <fieldset className="material-usage-fields">
      <legend>Materiais utilizados</legend>
      {value.map((line, index) => (
        <div className="material-usage-row" key={index}>
          <label>
            Material
            <select
              required
              value={line.material_id}
              onChange={(event) => updateLine(index, 'material_id', event.target.value)}
            >
              <option value="">Selecione do estoque</option>
              {materials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.name} (estoque: {Number(material.stock).toLocaleString('pt-BR')} {material.unit || 'un.'})
                </option>
              ))}
            </select>
          </label>
          <label>
            Quantidade
            <input
              required
              type="number"
              min="0.001"
              step="0.001"
              value={line.quantity}
              onChange={(event) => updateLine(index, 'quantity', event.target.value)}
            />
          </label>
          <button
            className="ghost-btn"
            type="button"
            aria-label={`Remover material ${index + 1}`}
            disabled={value.length === 1}
            onClick={() => onChange(value.filter((_, lineIndex) => lineIndex !== index))}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <button className="secondary-btn" type="button" onClick={() => onChange([...value, newLine()])}>
        <Plus size={16} /> Adicionar material
      </button>
      {!materials.length && <p className="form-message error">Cadastre materiais e quantidades no módulo Materiais antes de continuar.</p>}
    </fieldset>
  );
}

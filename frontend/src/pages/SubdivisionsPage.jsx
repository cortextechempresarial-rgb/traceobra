import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, readApiResponse } from '../api';
import { normalizeCoordinates } from '../mapGeometry';

const emptyForm = {
  name: '',
  cep: '',
  street: '',
  neighborhood: '',
  city: '',
  state: '',
  latitude: '',
  longitude: '',
};

async function lookupAddressCoordinates(address) {
  const query = [address.street, address.neighborhood, address.city, address.state, 'Brasil']
    .filter(Boolean).join(', ');
  if (!query || query === 'Brasil') return null;
  const params = new URLSearchParams({ format: 'jsonv2', limit: '1', q: query });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
  if (!response.ok) throw new Error('O serviço de localização do OpenStreetMap não respondeu.');
  const [match] = await response.json();
  return match ? normalizeCoordinates(match.lat, match.lon) : null;
}

export default function SubdivisionsPage() {
  const [subdivisions, setSubdivisions] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [planFile, setPlanFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [lookupMessage, setLookupMessage] = useState('');

  useEffect(() => {
    apiFetch('/subdivisions')
      .then((response) => readApiResponse(response, 'Não foi possível carregar os loteamentos.'))
      .then((result) => setSubdivisions(result.data || []))
      .catch((requestError) => setError(requestError.message));
  }, []);

  const updateAddress = (field, value) => {
    setForm((current) => ({ ...current, [field]: value, latitude: '', longitude: '' }));
    setLookupMessage('');
  };

  const lookupCep = async () => {
    const cep = form.cep.replace(/\D/g, '');
    if (cep.length !== 8) {
      setLookupMessage('Informe um CEP com 8 dígitos.');
      return;
    }
    setLocating(true);
    setError('');
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      if (!response.ok) throw new Error('O serviço ViaCEP não respondeu.');
      const address = await response.json();
      if (address.erro) throw new Error('CEP não encontrado.');
      setForm((current) => ({
        ...current,
        cep,
        street: address.logradouro || '',
        neighborhood: address.bairro || '',
        city: address.localidade || '',
        state: address.uf || '',
      }));
      setLookupMessage('Endereço preenchido. Localize o ponto no mapa para salvar as coordenadas.');
    } catch (requestError) {
      setError(requestError.message || 'Não foi possível consultar o CEP.');
    } finally {
      setLocating(false);
    }
  };

  const locateAddress = async () => {
    setLocating(true);
    setError('');
    setLookupMessage('');
    try {
      const coordinates = await lookupAddressCoordinates(form);
      if (!coordinates) throw new Error('Endereço não localizado. Confira os dados ou informe as coordenadas.');
      setForm((current) => ({ ...current, latitude: String(coordinates[0]), longitude: String(coordinates[1]) }));
      setLookupMessage('Ponto localizado. Confira o endereço e as coordenadas antes de cadastrar.');
    } catch (requestError) {
      setError(requestError.message || 'Não foi possível localizar o endereço.');
    } finally {
      setLocating(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    const coordinates = normalizeCoordinates(form.latitude, form.longitude);
    if (!coordinates) {
      setError('Localize o endereço ou informe latitude e longitude válidas.');
      return;
    }
    if (!planFile) {
      setError('Anexe a planta oficial em PDF.');
      return;
    }

    setLoading(true);
    const body = new FormData();
    body.append('plant', planFile);
    Object.entries({ ...form, latitude: coordinates[0], longitude: coordinates[1] })
      .forEach(([key, value]) => body.append(key, value));
    try {
      const response = await apiFetch('/subdivisions', { method: 'POST', body });
      const result = await readApiResponse(response, 'Não foi possível cadastrar o loteamento.');
      setSubdivisions((current) => [result.data, ...current]);
      setForm(emptyForm);
      setPlanFile(null);
      event.target.reset();
      setSuccess('Loteamento cadastrado e posicionado no mapa. Agora cadastre uma obra dentro dele.');
    } catch (requestError) {
      setError(requestError.message || 'Não foi possível cadastrar o loteamento.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Loteamentos</h1>
          <p>Cadastre o local e a planta do loteamento. As obras são registradas separadamente dentro dele.</p>
        </div>
        <Link className="secondary-btn" to="/mapa">Ver mapa</Link>
      </header>

      <div className="card">
        <h2>Cadastrar loteamento</h2>
        <form className="subdivision-form page-form" onSubmit={submit}>
          <label>Nome do loteamento
            <input required maxLength={255} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Jardim das Palmeiras" />
          </label>
          <div className="cep-field">
            <label htmlFor="subdivision-cep">CEP</label>
            <div>
              <input id="subdivision-cep" inputMode="numeric" maxLength={9} value={form.cep} onChange={(event) => updateAddress('cep', event.target.value)} placeholder="00000-000" />
              <button className="secondary-btn" type="button" disabled={locating} onClick={lookupCep}>Consultar ViaCEP</button>
            </div>
          </div>
          <div className="subdivision-address-grid">
            <label>Logradouro<input value={form.street} onChange={(event) => updateAddress('street', event.target.value)} /></label>
            <label>Bairro<input value={form.neighborhood} onChange={(event) => updateAddress('neighborhood', event.target.value)} /></label>
            <label>Cidade<input value={form.city} onChange={(event) => updateAddress('city', event.target.value)} /></label>
            <label>UF<input maxLength={2} value={form.state} onChange={(event) => updateAddress('state', event.target.value.toUpperCase())} /></label>
          </div>
          <button className="secondary-btn" type="button" disabled={locating} onClick={locateAddress}>
            {locating ? 'Localizando...' : 'Localizar endereço no mapa'}
          </button>
          {lookupMessage && <p className="cep-message success">{lookupMessage}</p>}
          <details className="coordinate-fallback" open>
            <summary>Coordenadas do loteamento</summary>
            <div>
              <label>Latitude<input type="number" step="any" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} /></label>
              <label>Longitude<input type="number" step="any" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} /></label>
            </div>
            <span>A localização automática pode ser aproximada. Confira o ponto ou informe as coordenadas precisas.</span>
          </details>
          <label className="plant-file-field">Planta oficial (PDF, até 20 MB)
            <input required type="file" accept="application/pdf,.pdf" onChange={(event) => setPlanFile(event.target.files?.[0] || null)} />
          </label>
          {planFile && <span>{planFile.name}</span>}
          <button className="primary-btn" type="submit" disabled={loading || locating || !normalizeCoordinates(form.latitude, form.longitude)}>
            {loading ? 'Salvando...' : 'Cadastrar loteamento'}
          </button>
        </form>
        {error && <div className="form-message error" role="alert">{error}</div>}
        {success && <div className="form-message" role="status">{success}</div>}
      </div>

      <div className="table-wrap" style={{ marginTop: 20 }}>
        <table>
          <thead><tr><th>Loteamento</th><th>Endereço</th><th>Latitude</th><th>Longitude</th></tr></thead>
          <tbody>
            {subdivisions.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{[item.address?.street, item.address?.neighborhood, item.address?.city, item.address?.state].filter(Boolean).join(', ') || '—'}</td>
                <td>{item.latitude ?? '—'}</td>
                <td>{item.longitude ?? '—'}</td>
              </tr>
            ))}
            {!subdivisions.length && <tr><td colSpan="4">Nenhum loteamento cadastrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

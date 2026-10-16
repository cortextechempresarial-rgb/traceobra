import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Move, RotateCw, Save, Scaling, Trash2 } from 'lucide-react';
import { apiFetch, readApiResponse } from '../api';
import Map3DEditor, { geometryByKind } from '../components/Map3DEditor';
import { normalizeCoordinates, normalizeGeometry, toFeatureCollection } from '../mapGeometry';

const buildDraft = (layer = {}) => ({
  id: layer.id || '',
  layer_name: layer.layer_name || 'Mapa da obra',
  map_type: layer.map_type || '2d',
  latitude: layer.latitude ?? '',
  longitude: layer.longitude ?? '',
  zoom: layer.zoom ?? 16,
  altitude: layer.altitude ?? 0,
  rotation: layer.rotation ?? 0,
  polygon: layer.polygon || [],
  model3d: layer.metadata?.model3d_elements || [],
  status: layer.metadata?.status || 'em execução',
  phase: layer.metadata?.phase || 'implantação',
  responsible: layer.metadata?.responsible || 'Engenharia',
  standard: layer.metadata?.standard || 'NBR 5410 / ABNT',
  discipline: layer.metadata?.discipline || 'Civil',
  layer_group: layer.metadata?.layer_group || 'terreno',
  source: layer.metadata?.source || 'GeoJSON / CAD',
  area_m2: layer.metadata?.area_m2 || 0,
  notes: layer.metadata?.notes || '',
});

function statusColor(status = '') {
  const category = getStatusCategory(status);
  if (category === 'available') return '#ffffff';
  if (category === 'reserved') return '#eab308';
  if (category === 'sold') return '#16a34a';
  const normalized = status.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/reprov|embarg|bloque/.test(normalized)) return '#dc2626';
  if (/obra|execu|concret/.test(normalized)) return '#d97706';
  return '#2563eb';
}

function getLayerFeatures(layer) {
  const geometry = normalizeGeometry(layer.polygon);
  if (!geometry) return [];
  return geometry.type === 'FeatureCollection' ? geometry.features : [geometry];
}

function getStatusCategory(status = '') {
  const normalized = status.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/vendid|sold|conclu|aprovad/.test(normalized)) return 'sold';
  if (/reserv/.test(normalized)) return 'reserved';
  if (/dispon|livre|available/.test(normalized)) return 'available';
  return 'other';
}

function getFeatureLabel(feature, index) {
  const properties = feature.properties || {};
  return properties.lot || properties.lot_number || properties.numero || properties.name || `Feição ${index + 1}`;
}

function getBillingCategory(status = '') {
  const normalized = status.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/atras|vencid|overdue/.test(normalized)) return 'overdue';
  if (/pago|quitad|paid/.test(normalized)) return 'paid';
  if (/pendente|aberto|due/.test(normalized)) return 'due';
  return 'unknown';
}

function billingColor(status = '') {
  const category = getBillingCategory(status);
  if (category === 'paid') return '#16a34a';
  if (category === 'due') return '#eab308';
  if (category === 'overdue') return '#dc2626';
  return '#94a3b8';
}

function formatArea(value) {
  return value == null || value === '' ? '—' : Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

function formatMoney(value) {
  return value == null || value === ''
    ? '—'
    : Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function createLayerPopup(layer, metadata) {
  const content = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = layer.layer_name;
  content.append(title, document.createElement('br'));
  content.append(document.createTextNode(`${metadata.status || 'Sem status'} · ${metadata.phase || 'Sem fase'}`));
  return content;
}

function deduplicateLayers(layers) {
  const seen = new Set();
  return layers.filter((layer) => {
    const signature = JSON.stringify([
      layer.company_id,
      layer.project_id,
      layer.layer_name,
      layer.map_type,
      layer.latitude,
      layer.longitude,
      layer.zoom,
      layer.altitude,
      layer.rotation,
      layer.polygon,
      layer.metadata,
    ]);
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

export default function MapsPage() {
  const navigate = useNavigate();
  const mapElementRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layerGroupRef = useRef(null);
  const geocodeAttemptedRef = useRef(new Set());
  const [view, setView] = useState('2d');
  const [contentView, setContentView] = useState('map');
  const [mapMode, setMapMode] = useState('situation');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedSubdivisionId, setSelectedSubdivisionId] = useState('');
  const [lotSearch, setLotSearch] = useState('');
  const [lotStatusFilter, setLotStatusFilter] = useState('all');
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [selectedModelId, setSelectedModelId] = useState(null);
  const [transformMode, setTransformMode] = useState('translate');
  const [newElementKind, setNewElementKind] = useState('pillar');
  const [projects, setProjects] = useState([]);
  const [subdivisions, setSubdivisions] = useState([]);
  const [draft, setDraft] = useState(buildDraft());
  const [message, setMessage] = useState('');
  const [activeLayers, setActiveLayers] = useState({
    terreno: true,
    infraestrutura: true,
    estrutura: true,
    concretagem: true,
    vistoria: true,
  });

  const selectedSubdivision = subdivisions.find((item) => item.id === selectedSubdivisionId) || null;
  const subdivisionProjects = projects.filter((project) => project.subdivision_id === selectedSubdivisionId);
  const projectLayers = items.filter((item) => subdivisionProjects.some((project) => project.id === item.project_id)
    && (!selectedProjectId || item.project_id === selectedProjectId));
  const activeItems = projectLayers.filter((item) => item.map_type === view);
  const mapItems = view === '2d'
    ? [
      ...(selectedSubdivision ? [{
        ...selectedSubdivision,
        layer_name: selectedSubdivision.name,
        map_type: '2d',
        isSubdivision: true,
        metadata: { status: 'loteamento', layer_group: 'terreno' },
      }] : []),
      ...activeItems,
    ]
    : activeItems;

  useEffect(() => {
    if (!mapElementRef.current || mapInstanceRef.current) return undefined;

    const map = L.map(mapElementRef.current).setView([0, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 20,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    mapInstanceRef.current = map;
    layerGroupRef.current = L.featureGroup().addTo(map);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const featureGroup = layerGroupRef.current;
    if (!map || !featureGroup || view !== '2d') return;

    featureGroup.clearLayers();
    mapItems.forEach((item) => {
      const metadata = item.metadata || {};
      const group = metadata.layer_group || 'terreno';
      if (activeLayers[group] === false && !item.isSubdivision) return;

      const color = statusColor(metadata.status);
      const geometry = normalizeGeometry(item.polygon);
      if (geometry) {
        L.geoJSON(geometry, {
          style: (feature) => {
            const properties = feature?.properties || {};
            const featureStatus = properties.status || metadata.status;
            const featureColor = mapMode === 'billing'
              ? billingColor(properties.payment_status || properties.cobranca_status)
              : statusColor(featureStatus);
            return { color: featureColor, weight: 2, fillColor: featureColor, fillOpacity: 0.3 };
          },
          onEachFeature: (feature, featureLayer) => featureLayer.bindPopup(
            createLayerPopup(item, { ...metadata, ...(feature.properties || {}) })
          ),
        }).addTo(featureGroup);
      }

      const coordinates = normalizeCoordinates(item.latitude, item.longitude);
      if (coordinates) {
        const markerColor = mapMode === 'billing'
          ? billingColor(metadata.payment_status || metadata.cobranca_status)
          : color;
        L.circleMarker(coordinates, {
          radius: 7,
          color: '#fff',
          weight: 2,
          fillColor: markerColor,
          fillOpacity: 1,
        }).bindPopup(createLayerPopup(item, metadata)).addTo(featureGroup);
      }
    });

    const bounds = featureGroup.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 17 });
    } else {
      const selected = selectedSubdivision || activeItems.find((item) => item.id === selectedId) || activeItems[0];
      const coordinates = normalizeCoordinates(selected?.latitude, selected?.longitude);
      if (coordinates) {
        map.setView(coordinates, Number(selected.zoom) || 16);
      }
    }
    map.invalidateSize();
  }, [items, projects, subdivisions, activeLayers, selectedId, selectedProjectId, selectedSubdivisionId, view, mapMode]);

  useEffect(() => {
    apiFetch('/maps')
      .then((response) => readApiResponse(response, 'Não foi possível carregar as camadas do mapa.'))
      .then((result) => setItems(deduplicateLayers(result.data || [])))
      .catch((error) => setMessage(error.message || 'Não foi possível carregar as camadas do mapa.'));
  }, []);

  useEffect(() => {
    apiFetch('/subdivisions')
      .then((response) => readApiResponse(response, 'Não foi possível carregar os loteamentos.'))
      .then((result) => {
        const subdivisionList = result.data || [];
        setSubdivisions(subdivisionList);
        setSelectedSubdivisionId((current) => current || subdivisionList[0]?.id || '');
      })
      .catch((error) => setMessage(error.message || 'Não foi possível carregar os loteamentos.'));
  }, []);

  useEffect(() => {
    apiFetch('/projects')
      .then((response) => readApiResponse(response, 'Não foi possível carregar as obras.'))
      .then((result) => setProjects(result.data || []))
      .catch((error) => setMessage(error.message || 'Não foi possível carregar as obras.'));
  }, []);

  useEffect(() => {
    if (!selectedSubdivision || normalizeCoordinates(selectedSubdivision.latitude, selectedSubdivision.longitude)) return;
    if (geocodeAttemptedRef.current.has(selectedSubdivision.id)) return;

    const address = selectedSubdivision.address || selectedSubdivision.metadata?.address || {};
    if (![address.street, address.neighborhood, address.city, address.state].some(Boolean)) return;
    geocodeAttemptedRef.current.add(selectedSubdivision.id);

    geocodeSubdivisionAddress(address)
      .then((coordinates) => {
        if (!coordinates) throw new Error('O endereço cadastrado não foi localizado automaticamente.');
        return apiFetch(`/subdivisions/${selectedSubdivision.id}/location`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            latitude: coordinates[0],
            longitude: coordinates[1],
            zoom: selectedSubdivision.zoom || 16,
          }),
        });
      })
      .then((response) => readApiResponse(response, 'Não foi possível salvar a localização encontrada.'))
      .then((result) => {
        setSubdivisions((current) => current.map((item) => (item.id === result.data.id ? result.data : item)));
        setMessage('A localização do loteamento foi recuperada pelo endereço cadastrado.');
      })
      .catch((error) => setMessage(error.message || 'Não foi possível localizar o loteamento pelo endereço cadastrado.'));
  }, [selectedSubdivisionId, subdivisions]);

  const selectedModelElement = draft.model3d.find((element) => element.id === selectedModelId) || null;
  const featureRows = activeItems.flatMap((layer) => getLayerFeatures(layer).map((feature, index) => ({
    id: `${layer.id}-${index}`,
    label: getFeatureLabel(feature, index),
    layerName: layer.layer_name,
    status: feature.properties?.status || layer.metadata?.status || 'Sem situação',
    category: getStatusCategory(feature.properties?.status || layer.metadata?.status),
    paymentStatus: feature.properties?.payment_status || feature.properties?.cobranca_status || 'Sem cobrança',
    billingCategory: getBillingCategory(feature.properties?.payment_status || feature.properties?.cobranca_status),
    phase: feature.properties?.phase || layer.metadata?.phase || 'Sem fase',
    block: feature.properties?.block || feature.properties?.quadra || feature.properties?.block_number || '—',
    lot: feature.properties?.lot || feature.properties?.lot_number || feature.properties?.numero || getFeatureLabel(feature, index),
    area: feature.properties?.area_m2 ?? feature.properties?.area ?? layer.metadata?.area_m2 ?? null,
    frontage: feature.properties?.frontage_m ?? feature.properties?.frontage ?? feature.properties?.frente_m ?? null,
    depth: feature.properties?.depth_m ?? feature.properties?.depth ?? feature.properties?.profundidade_m ?? null,
    price: feature.properties?.price ?? feature.properties?.preco ?? null,
    feature,
  })));
  const situationCounts = featureRows.reduce((counts, row) => {
    counts[row.category] += 1;
    return counts;
  }, { available: 0, reserved: 0, sold: 0, other: 0 });
  const filteredFeatureRows = featureRows.filter((row) => {
    const search = lotSearch.trim().toLocaleLowerCase('pt-BR');
    const matchesSearch = !search || `${row.block} ${row.lot} ${row.label} ${row.layerName} ${row.status}`
      .toLocaleLowerCase('pt-BR').includes(search);
    const matchesStatus = lotStatusFilter === 'all'
      || (mapMode === 'situation' ? row.category === lotStatusFilter : row.billingCategory === lotStatusFilter);
    return matchesSearch && matchesStatus;
  });

  const handleSelect = (layer) => {
    setSelectedId(layer.id);
    setSelectedProjectId(layer.project_id || '');
    setDraft(buildDraft(layer));
    setSelectedModelId(layer.metadata?.model3d_elements?.[0]?.id || null);
    setView(layer.map_type || '2d');
  };

  const updateDraft = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const addModelElement = () => {
    const geometry = geometryByKind[newElementKind];
    if (!geometry) return;

    const element = {
      id: crypto.randomUUID(),
      kind: newElementKind,
      name: `${geometry.label} ${draft.model3d.length + 1}`,
      dimensions: geometry.dimensions,
      position: [0, geometry.dimensions[1] / 2, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: geometry.color,
    };
    setDraft((current) => ({ ...current, model3d: [...current.model3d, element] }));
    setSelectedModelId(element.id);
  };

  const updateModelElement = (id, values) => {
    setDraft((current) => ({
      ...current,
      model3d: current.model3d.map((element) => (element.id === id ? { ...element, ...values } : element)),
    }));
  };

  const removeSelectedModelElement = () => {
    if (!selectedModelId) return;
    setDraft((current) => ({
      ...current,
      model3d: current.model3d.filter((element) => element.id !== selectedModelId),
    }));
    setSelectedModelId(null);
  };

  const handleGeoJsonImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const featureCollection = toFeatureCollection(JSON.parse(await file.text()));
      setDraft((current) => ({ ...current, polygon: featureCollection, source: 'GeoJSON + drone' }));
      setItems((current) => current.map((item) => (
        item.id === selectedId ? { ...item, polygon: featureCollection } : item
      )));
      setMessage(`${featureCollection.features.length} feição(ões) importada(s). Salve a camada para persistir no banco.`);
    } catch (error) {
      setMessage(error.message || 'Não foi possível ler o arquivo GeoJSON.');
    }
  };

  const handleSave = async () => {
    if (!selectedId) {
      setMessage('Selecione uma camada de uma obra para editar.');
      return;
    }
    const coordinates = normalizeCoordinates(draft.latitude, draft.longitude);
    if ((draft.latitude !== '' || draft.longitude !== '') && !coordinates) {
      setMessage('Informe uma latitude entre -90 e 90 e uma longitude entre -180 e 180.');
      return;
    }

    const payload = {
      layer_name: draft.layer_name,
      map_type: draft.map_type,
      latitude: coordinates?.[0] ?? null,
      longitude: coordinates?.[1] ?? null,
      zoom: Number(draft.zoom),
      altitude: Number(draft.altitude),
      rotation: Number(draft.rotation),
      polygon: draft.polygon,
      metadata: {
        status: draft.status,
        phase: draft.phase,
        responsible: draft.responsible,
        standard: draft.standard,
        discipline: draft.discipline,
        layer_group: draft.layer_group,
        source: draft.source,
        model3d_elements: draft.model3d,
        area_m2: Number(draft.area_m2),
        notes: draft.notes,
      },
    };

    try {
      const response = await apiFetch(`/maps/${selectedId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await readApiResponse(response, 'Não foi possível atualizar o mapa.');

      const updated = result.data;
      const nextItems = items.map((item) => (item.id === updated.id ? updated : item));
      setItems(nextItems);
      setDraft(buildDraft(updated));
      setSelectedModelId(updated.metadata?.model3d_elements?.[0]?.id || null);
      setMessage('Mapa atualizado com sucesso. Camada técnica ajustada para a obra e aos padrões da engenharia.');
    } catch (error) {
      setMessage(error.message || 'Não foi possível atualizar o mapa.');
    }
  };

  const handleCreateLayer = async () => {
    if (!selectedProjectId) {
      setMessage('Selecione uma obra do loteamento antes de criar uma camada.');
      return;
    }

    try {
      const response = await apiFetch('/maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: selectedProjectId,
          layer_name: 'Nova camada',
          map_type: view,
          metadata: { layer_group: 'terreno', status: 'planejado' },
        }),
      });
      const result = await readApiResponse(response, 'Não foi possível criar a camada.');

      setItems((current) => [result.data, ...current]);
      setSelectedId(result.data.id);
      setDraft(buildDraft(result.data));
      setSelectedModelId(null);
      setMessage('Camada criada. Configure geometria e dados técnicos e salve os ajustes.');
    } catch (error) {
      setMessage(error.message || 'Não foi possível criar a camada.');
    }
  };

  const geocodeSubdivisionAddress = async (addressFields) => {
    const query = [
      addressFields.street,
      addressFields.neighborhood,
      addressFields.city,
      addressFields.state,
      'Brasil',
    ].filter(Boolean).join(', ');
    if (!query || query === 'Brasil') return null;

    const params = new URLSearchParams({ format: 'jsonv2', limit: '1', q: query });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
    if (!response.ok) throw new Error('O serviço de localização do OpenStreetMap não respondeu.');
    const results = await response.json();
    const match = results[0];
    return match ? normalizeCoordinates(match.lat, match.lon) : null;
  };

  const handleExport = () => {
    const features = activeItems.flatMap((item) => {
      const geometry = normalizeGeometry(item.polygon);
      if (!geometry) return [];
      const sourceFeatures = geometry.type === 'FeatureCollection' ? geometry.features : [geometry];
      return sourceFeatures.map((feature) => ({
        type: 'Feature',
        geometry: feature.geometry,
        properties: {
          ...feature.properties,
          layer_id: item.id,
          layer_name: item.layer_name,
          ...item.metadata,
        },
      }));
    });

    if (!features.length) {
      setMessage('Não há geometrias nesta visualização para exportar.');
      return;
    }

    const file = new Blob([JSON.stringify({ type: 'FeatureCollection', features }, null, 2)], {
      type: 'application/geo+json',
    });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = `traceobra-${view}.geojson`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage(`${features.length} feição(ões) exportada(s) em GeoJSON.`);
  };

  const toggleLayer = (key) => {
    setActiveLayers((current) => ({ ...current, [key]: !current[key] }));
  };

  const layerLegend = [
    { key: 'terreno', label: 'Terreno', color: '#16a34a' },
    { key: 'infraestrutura', label: 'Infra', color: '#3b82f6' },
    { key: 'estrutura', label: 'Estrutura', color: '#f59e0b' },
    { key: 'concretagem', label: 'Concretagem', color: '#ef4444' },
    { key: 'vistoria', label: 'Vistoria', color: '#7c3aed' },
  ];

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Mapas de loteamentos e obras</h1>
        </div>
        <div className="header-actions">
          <button className="secondary-btn" type="button" onClick={handleExport}>Exportar GeoJSON</button>
          <button className="secondary-btn" type="button" onClick={() => navigate('/loteamentos')}>Cadastrar loteamento</button>
          <button className="primary-btn" type="button" onClick={handleCreateLayer} disabled={!selectedProjectId}>Nova camada da obra</button>
        </div>
      </header>

      <div className="card">
        <div className="map-project-tabs" role="tablist" aria-label="Loteamentos">
          {subdivisions.map((subdivision) => (
            <button
              key={subdivision.id}
              type="button"
              role="tab"
              aria-selected={selectedSubdivisionId === subdivision.id}
              className={selectedSubdivisionId === subdivision.id ? 'active' : ''}
              onClick={() => {
                setSelectedSubdivisionId(subdivision.id);
                setSelectedProjectId('');
                setSelectedId('');
                setView('2d');
              }}
            >
              {subdivision.name}
            </button>
          ))}
          {!subdivisions.length && <span>Cadastre um loteamento para posicioná-lo no mapa.</span>}
        </div>

        <div className="map-work-filter">
          <label>
            Obra dentro do loteamento
            <select
              value={selectedProjectId}
              disabled={!subdivisionProjects.length}
              onChange={(event) => {
                const projectId = event.target.value;
                const layer = items.find((item) => item.project_id === projectId && item.map_type === view);
                if (layer) handleSelect(layer);
                else {
                  setSelectedProjectId(projectId);
                  setSelectedId('');
                }
              }}
            >
              <option value="">Visão geral do loteamento</option>
              {subdivisionProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </label>
          {!subdivisionProjects.length && selectedSubdivision && (
            <span>Este loteamento ainda não possui obras vinculadas. Cadastre uma obra no módulo Obras.</span>
          )}
        </div>

        <div className="map-toolbar">
          <div className="map-toolbar-controls">
            <div className="view-toggle" aria-label="Dimensão da planta">
              <button className={view === '2d' ? 'active' : ''} onClick={() => setView('2d')}>2D</button>
              <button className={view === '3d' ? 'active' : ''} onClick={() => setView('3d')}>3D</button>
            </div>
            <div className="view-toggle" aria-label="Conteúdo do mapa">
              <button className={contentView === 'map' ? 'active' : ''} onClick={() => setContentView('map')}>Mapa</button>
              <button className={contentView === 'table' ? 'active' : ''} onClick={() => setContentView('table')}>Tabela</button>
            </div>
          </div>
          <span className="badge success">Norma interna de obra e engenharia</span>
        </div>

        <div className="map-situation-summary" aria-label="Resumo das feições por situação">
          <span>{featureRows.length} feições</span>
          <span className="situation-count available">{situationCounts.available} disponíveis</span>
          <span className="situation-count reserved">{situationCounts.reserved} reservadas</span>
          <span className="situation-count sold">{situationCounts.sold} concluídas/vendidas</span>
          {situationCounts.other > 0 && <span>{situationCounts.other} outras situações</span>}
        </div>

        {contentView === 'map' ? (
          <>
          <div className="map-stage">
          <div className="map-badge">{view === '2d' ? '2D · OpenStreetMap' : '3D · Pré-visualização'}</div>

          {view === '2d' && (
            <div className="map-mode-toggle" aria-label="Modo do mapa">
              <button type="button" className={mapMode === 'situation' ? 'active' : ''} onClick={() => setMapMode('situation')}>Situação</button>
              <button type="button" className={mapMode === 'billing' ? 'active' : ''} onClick={() => setMapMode('billing')}>Cobrança do mês</button>
            </div>
          )}

          <div className="map-layer-toggle">
            {layerLegend.map(({ key, label, color }) => (
              <button
                key={key}
                type="button"
                className={activeLayers[key] ? 'active' : ''}
                onClick={() => toggleLayer(key)}
                title={`${label} ${activeLayers[key] ? 'ativado' : 'desativado'}`}
              >
                <span style={{ background: color }} />
                {label}
              </button>
            ))}
          </div>

          <div
            ref={mapElementRef}
            className={`map-view map-2d ${view === '2d' ? '' : 'is-hidden'}`}
            role="application"
            aria-label="Mapa geográfico da obra"
            aria-hidden={view !== '2d'}
          />
          <div className={`map-view map-3d ${view === '3d' ? '' : 'is-hidden'}`} aria-hidden={view !== '3d'}>
            <Map3DEditor
              elements={draft.model3d}
              selectedId={selectedModelId}
              mode={transformMode}
              onSelect={setSelectedModelId}
              onTransform={updateModelElement}
            />
          </div>

          <div className="map-legend">
            {view === '2d' && mapMode === 'situation' ? (
              <>
                <div className="legend-item"><span className="dot" style={{ background: '#fff', border: '1px solid #94a3b8' }} />Disponível</div>
                <div className="legend-item"><span className="dot" style={{ background: '#eab308' }} />Reservado</div>
                <div className="legend-item"><span className="dot" style={{ background: '#16a34a' }} />Vendido</div>
                <div className="legend-item"><span className="dot" style={{ background: '#cbd5e1' }} />Rua / circulação</div>
                <div className="legend-item"><span className="dot" style={{ background: '#e9e5d8' }} />Fora do loteamento</div>
              </>
            ) : view === '2d' ? (
              <>
                <div className="legend-item"><span className="dot" style={{ background: '#16a34a' }} />Pago</div>
                <div className="legend-item"><span className="dot" style={{ background: '#eab308' }} />Em aberto</div>
                <div className="legend-item"><span className="dot" style={{ background: '#dc2626' }} />Em atraso</div>
                <div className="legend-item"><span className="dot" style={{ background: '#94a3b8' }} />Sem cobrança</div>
              </>
            ) : layerLegend.map(({ key, label, color }) => (
              <div key={key} className="legend-item"><span className="dot" style={{ background: color }} /><span>{label}</span></div>
            ))}
          </div>
        </div>

        <div className="map-list">
          {activeItems.length ? activeItems.map((item) => (
            <div
              key={`${item.id || item.layer_name}-${item.map_type}`}
              className={`map-card ${selectedId === item.id ? 'selected' : ''}`}
              onClick={() => handleSelect(item)}
            >
              <h4>{item.layer_name}</h4>
              <div className="map-meta">
                <span>{item.map_type.toUpperCase()}</span>
                <span>{item.metadata?.status || 'ativo'}</span>
              </div>
              <div className="map-meta">
                <span>{item.metadata?.phase || 'implantação'}</span>
                <span>{item.metadata?.discipline || 'Civil'}</span>
              </div>
              <div className="map-meta">
                <span>{item.metadata?.standard || 'NBR 5410 / ABNT'}</span>
                <span>{item.metadata?.responsible || 'Engenharia'}</span>
              </div>
            </div>
          )) : <div className="map-card"><h4>Sem camadas no modo selecionado</h4></div>}
        </div>
          {view === '3d' && (
            <section className="model-editor-panel" aria-label="Editor de elementos 3D">
              <div className="model-editor-toolbar">
                <label>
                  Componente
                  <select value={newElementKind} onChange={(event) => setNewElementKind(event.target.value)}>
                    {Object.entries(geometryByKind).map(([kind, geometry]) => (
                      <option key={kind} value={kind}>{geometry.label}</option>
                    ))}
                  </select>
                </label>
                <button className="secondary-btn" type="button" onClick={addModelElement}>Adicionar elemento</button>
                <div className="transform-toggle" aria-label="Ferramenta de transformação">
                  <button className={transformMode === 'translate' ? 'active' : ''} type="button" title="Mover" aria-label="Mover" onClick={() => setTransformMode('translate')}><Move size={17} /></button>
                  <button className={transformMode === 'rotate' ? 'active' : ''} type="button" title="Girar" aria-label="Girar" onClick={() => setTransformMode('rotate')}><RotateCw size={17} /></button>
                  <button className={transformMode === 'scale' ? 'active' : ''} type="button" title="Escalar" aria-label="Escalar" onClick={() => setTransformMode('scale')}><Scaling size={17} /></button>
                </div>
                <button className="ghost-btn" type="button" title="Excluir elemento selecionado" aria-label="Excluir elemento selecionado" disabled={!selectedModelId} onClick={removeSelectedModelElement}><Trash2 size={17} /></button>
                <button className="primary-btn" type="button" onClick={handleSave}><Save size={16} /> Salvar cena</button>
              </div>
              {selectedModelElement ? (
                <div className="model-properties">
                  <label>
                    Nome
                    <input value={selectedModelElement.name} onChange={(event) => updateModelElement(selectedModelId, { name: event.target.value })} />
                  </label>
                  {['X', 'Y', 'Z'].map((axis, index) => (
                    <label key={axis}>
                      {axis} (m)
                      <input
                        type="number"
                        step="0.1"
                        value={Number(selectedModelElement.position[index]).toFixed(2)}
                        onChange={(event) => {
                          const position = [...selectedModelElement.position];
                          position[index] = Number(event.target.value);
                          updateModelElement(selectedModelId, { position });
                        }}
                      />
                    </label>
                  ))}
                  <span className="model-selection-label">Selecionado: {selectedModelElement.name}</span>
                </div>
              ) : <p className="model-editor-note">Selecione um elemento na cena para mover, girar ou escalar. As medidas são esquemáticas até carregar um modelo técnico.</p>}
            </section>
          )}
          </>
        ) : (
          <div className="map-data-table">
            <div className="lot-table-controls">
              <input
                type="search"
                value={lotSearch}
                onChange={(event) => setLotSearch(event.target.value)}
                placeholder="Buscar por lote ou número..."
                aria-label="Buscar por lote ou número"
              />
              <div className="lot-status-filter" aria-label={mapMode === 'situation' ? 'Filtrar por situação' : 'Filtrar por cobrança'}>
                {(mapMode === 'situation'
                  ? [['all', 'Todos'], ['available', 'Disponível'], ['reserved', 'Reservado'], ['sold', 'Vendido']]
                  : [['all', 'Todos'], ['paid', 'Pago'], ['due', 'Em aberto'], ['overdue', 'Em atraso']]
                ).map(([filter, label]) => (
                  <button
                    key={filter}
                    type="button"
                    className={lotStatusFilter === filter ? 'active' : ''}
                    onClick={() => setLotStatusFilter(filter)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span>{filteredFeatureRows.length} de {featureRows.length} lotes/feições</span>
            </div>
            <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Quadra</th><th>Lote</th><th>Área (m²)</th><th>Frente (m)</th><th>Prof. (m)</th><th>Preço</th><th>Status</th></tr>
              </thead>
              <tbody>
                {filteredFeatureRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.block}</td>
                    <td>{row.lot}</td>
                    <td>{formatArea(row.area)}</td>
                    <td>{formatArea(row.frontage)}</td>
                    <td>{formatArea(row.depth)}</td>
                    <td>{formatMoney(row.price)}</td>
                    <td><span className={`badge ${row.category === 'sold' || row.billingCategory === 'paid' ? 'success' : row.category === 'reserved' || row.billingCategory === 'due' ? 'warning' : row.billingCategory === 'overdue' ? 'danger' : ''}`}>{mapMode === 'situation' ? row.status : row.paymentStatus}</span></td>
                  </tr>
                ))}
                {!featureRows.length && <tr><td colSpan="7">Nenhuma feição GeoJSON nesta visualização.</td></tr>}
                {featureRows.length > 0 && !filteredFeatureRows.length && <tr><td colSpan="7">Nenhuma feição corresponde ao filtro.</td></tr>}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>

      {selectedId && <div className="card form-card">
        <h3>Atualização manual do mapa</h3>
        <div className="map-form-grid">
          <label>
            Nome da camada
            <input value={draft.layer_name} onChange={(e) => updateDraft('layer_name', e.target.value)} />
          </label>
          <label>
            Grupo da camada
            <select value={draft.layer_group} onChange={(e) => updateDraft('layer_group', e.target.value)}>
              <option value="terreno">Terreno</option>
              <option value="infraestrutura">Infraestrutura</option>
              <option value="estrutura">Estrutura</option>
              <option value="concretagem">Concretagem</option>
              <option value="vistoria">Vistoria</option>
            </select>
          </label>
          <label>
            Tipo
            <select value={draft.map_type} onChange={(e) => updateDraft('map_type', e.target.value)}>
              <option value="2d">2D</option>
              <option value="3d">3D</option>
            </select>
          </label>
          <label>
            Status
            <select value={draft.status} onChange={(e) => updateDraft('status', e.target.value)}>
              <option value="em execução">Em execução</option>
              <option value="em revisão">Em revisão</option>
              <option value="concluído">Concluído</option>
              <option value="pendente">Pendente</option>
            </select>
          </label>
          <label>
            Fase
            <select value={draft.phase} onChange={(e) => updateDraft('phase', e.target.value)}>
              <option value="implantação">Implantação</option>
              <option value="estrutura">Estrutura</option>
              <option value="acabamento">Acabamento</option>
              <option value="comissionamento">Comissionamento</option>
            </select>
          </label>
          <label>
            Latitude
            <input type="number" value={draft.latitude} onChange={(e) => updateDraft('latitude', e.target.value)} />
          </label>
          <label>
            Longitude
            <input type="number" value={draft.longitude} onChange={(e) => updateDraft('longitude', e.target.value)} />
          </label>
          <label>
            Zoom
            <input type="number" value={draft.zoom} onChange={(e) => updateDraft('zoom', e.target.value)} />
          </label>
          <label>
            Altitude (m)
            <input type="number" value={draft.altitude} onChange={(e) => updateDraft('altitude', e.target.value)} />
          </label>
          <label>
            Rotação
            <input type="number" value={draft.rotation} onChange={(e) => updateDraft('rotation', e.target.value)} />
          </label>
          <label>
            Área (m²)
            <input type="number" value={draft.area_m2} onChange={(e) => updateDraft('area_m2', e.target.value)} />
          </label>
          <label>
            Norma / padrão
            <select value={draft.standard} onChange={(e) => updateDraft('standard', e.target.value)}>
              <option value="SIRGAS 2000 / NBR 16820">SIRGAS 2000 / NBR 16820</option>
              <option value="NBR 6118 / ABNT">NBR 6118 / ABNT</option>
              <option value="NBR 13855 / ABNT">NBR 13855 / ABNT</option>
              <option value="NBR 5410 / ABNT">NBR 5410 / ABNT</option>
              <option value="NBR 15270 / ABNT">NBR 15270 / ABNT</option>
              <option value="ISO 19650">ISO 19650</option>
            </select>
          </label>
          <label>
            Disciplina
            <select value={draft.discipline} onChange={(e) => updateDraft('discipline', e.target.value)}>
              <option value="Civil">Civil</option>
              <option value="Estruturas">Estruturas</option>
              <option value="Elétrica">Elétrica</option>
              <option value="Hidráulica">Hidráulica</option>
              <option value="Arquitetura">Arquitetura</option>
            </select>
          </label>
          <label>
            Responsável
            <input value={draft.responsible} onChange={(e) => updateDraft('responsible', e.target.value)} />
          </label>
          <label>
            Origem da fonte
            <select value={draft.source} onChange={(e) => updateDraft('source', e.target.value)}>
              <option value="GeoJSON + drone">GeoJSON + drone</option>
              <option value="IFC + BIM">IFC + BIM</option>
              <option value="CAD / DWG">CAD / DWG</option>
              <option value="Topografia">Topografia</option>
            </select>
          </label>
          <label className="full-width">
            Importar geometria GeoJSON
            <input type="file" accept=".geojson,.json,application/geo+json,application/json" onChange={handleGeoJsonImport} />
          </label>
          <label className="full-width">
            Observações técnicas
            <textarea value={draft.notes} onChange={(e) => updateDraft('notes', e.target.value)} rows={4} />
          </label>
        </div>

        <div className="form-actions">
          <button className="primary-btn" onClick={handleSave}>Salvar ajustes</button>
        </div>
        {message && <div className="form-message">{message}</div>}
      </div>}

    </>
  );
}

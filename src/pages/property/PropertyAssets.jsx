import { useState, useMemo } from 'react';
import { useProperty } from '../../store/hooks';
import Icon from '../../components/Icon';
import Portal from '../../components/Portal';
import { EmptyState, Card } from '../../components/ui';
import {
  createPropertyAsset,
  ASSET_TYPES, ASSET_CONDITIONS, CONDITION_PILL,
} from '../../models/PropertyAsset';
import { getAssetDependents, cascadeDeleteAsset, assetDeleteMessage } from '../../utils/cascade';
import { validate, propertyAssetSchema } from '../../utils/validation';

function today() { return new Date().toISOString().slice(0, 10); }

const CONDITIONS      = ASSET_CONDITIONS;
const CONDITION_DPILL = CONDITION_PILL;

function warrantyStatus(warrantyExpiry) {
  if (!warrantyExpiry) return null;
  const days = Math.round((new Date(warrantyExpiry) - new Date(today())) / 86400000);
  if (days < 0)    return { label: 'Warranty expired', pill: 'red', days };
  if (days <= 30)  return { label: `Warranty expires in ${days}d`, pill: 'red', days };
  if (days <= 90)  return { label: `Warranty expires in ${days}d`, pill: 'amber', days };
  return null;
}

function lifespanAlert(dateInstalled, expectedLifespan) {
  if (!dateInstalled || !expectedLifespan) return null;
  const yearsLeft = (new Date(dateInstalled).getFullYear() + parseInt(expectedLifespan, 10)) - new Date().getFullYear();
  if (yearsLeft < 0)  return { label: 'Past expected lifespan', pill: 'red' };
  if (yearsLeft <= 2) return { label: `${yearsLeft}yr left of expected life`, pill: 'amber' };
  return null;
}

const EMPTY_ASSET = createPropertyAsset();

function AssetRow({ asset, area, maintenanceRecords, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const warranty  = warrantyStatus(asset.warrantyExpiry);
  const lifespan  = lifespanAlert(asset.dateInstalled, asset.expectedLifespan);
  const hasAlerts = warranty || lifespan || asset.condition === 'Poor' || asset.condition === 'Critical';
  const history   = maintenanceRecords
    .filter(m => m.assetId === asset.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="fn-row">
      <div className="fn-main" style={{ cursor: history.length > 0 ? 'pointer' : 'default' }} onClick={() => history.length > 0 && setExpanded(e => !e)}>
        <div className="fn-left">
          <div className="fn-dates">
            <div className="fn-label" style={{ fontSize: 13, fontWeight: 500 }}>{asset.name}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              <span className="tag">{asset.type}</span>
              {area && <span className="tag teal">{area.name}</span>}
              <span className={`dpill ${CONDITION_DPILL[asset.condition] || ''}`}>{asset.condition}</span>
              {warranty && <span className={`dpill ${warranty.pill}`}>{warranty.label}</span>}
              {lifespan && <span className={`dpill ${lifespan.pill}`}>{lifespan.label}</span>}
              {asset.brand && <span className="tag">{asset.brand}{asset.model ? ` ${asset.model}` : ''}</span>}
            </div>
            {asset.notes && (
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, lineHeight: 1.5 }}>{asset.notes}</div>
            )}
          </div>
        </div>
        <div className="fn-right" style={{ alignItems: 'flex-end', gap: 6 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
            {asset.dateInstalled && (
              <span className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>Installed {asset.dateInstalled}</span>
            )}
            {history.length > 0 && (
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>{history.length} maint. record{history.length !== 1 ? 's' : ''}</span>
            )}
          </div>
          <div className="exp-actions">
            <button className="btn-icon small" onClick={e => { e.stopPropagation(); onEdit(asset); }}><Icon name="pencil" size={12} /></button>
            <button className="btn-icon small danger" onClick={e => { e.stopPropagation(); onDelete(asset.id); }}><Icon name="trash" size={12} /></button>
          </div>
        </div>
      </div>

      {expanded && history.length > 0 && (
        <div className="exp-detail" style={{ paddingBottom: 12 }}>
          <div className="form-section-label" style={{ marginBottom: 6 }}>Maintenance History</div>
          <div className="change-history">
            {history.slice(0, 5).map(m => (
              <div key={m.id} className="ch-row">
                <span className="ch-date mono">{m.date}</span>
                <span className="ch-text" style={{ flex: 1 }}>{m.title}</span>
                {m.performedBy && m.performedBy !== 'Self' && (
                  <span className="tag" style={{ fontSize: 10 }}>{m.performedBy}</span>
                )}
              </div>
            ))}
            {history.length > 5 && (
              <div style={{ fontSize: 11, color: 'var(--text3)', padding: '4px 0' }}>+{history.length - 5} more records</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PropertyAssets() {
  const { properties, propertyAssets, propertyMaintenance, selectedPropertyId, setProperty, mergeProperty } = useProperty();

  const selProp = properties.find(p => p.id === selectedPropertyId) || null;

  const [showModal,  setShowModal]  = useState(false);
  const [form,       setForm]       = useState(EMPTY_ASSET);
  const [editingId,  setEditingId]  = useState(null);
  const [errors,     setErrors]     = useState({});
  const [filterType, setFilterType] = useState('All');
  const [filterCond, setFilterCond] = useState('All');
  const [propScope,  setPropScope]  = useState('current');

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const visibleAssets = useMemo(() => {
    let list = propertyAssets;
    if (propScope === 'current' && selectedPropertyId) {
      list = list.filter(a => a.propertyId === selectedPropertyId);
    }
    if (filterType !== 'All') list = list.filter(a => a.type === filterType);
    if (filterCond !== 'All') list = list.filter(a => a.condition === filterCond);
    const condOrder = { Critical: 0, Poor: 1, Fair: 2, Good: 3, Excellent: 4 };
    return [...list].sort((a, b) => (condOrder[a.condition] ?? 5) - (condOrder[b.condition] ?? 5));
  }, [propertyAssets, propScope, selectedPropertyId, filterType, filterCond]);

  const alertCount = useMemo(() => visibleAssets.filter(a => {
    if (a.condition === 'Poor' || a.condition === 'Critical') return true;
    return !!warrantyStatus(a.warrantyExpiry) || !!lifespanAlert(a.dateInstalled, a.expectedLifespan);
  }).length, [visibleAssets]);

  const openNew = () => {
    setForm({ ...EMPTY_ASSET, id: crypto.randomUUID(), propertyId: selectedPropertyId || '', createdAt: today() });
    setErrors({}); setEditingId('new'); setShowModal(true);
  };

  const openEdit = (asset) => {
    setForm({ ...EMPTY_ASSET, ...asset });
    setErrors({}); setEditingId(asset.id); setShowModal(true);
  };

  const close = () => { setShowModal(false); setForm(EMPTY_ASSET); setEditingId(null); setErrors({}); };

  const save = () => {
    const { ok, errors: errs } = validate(propertyAssetSchema, form);
    if (!ok) { setErrors(errs); return; }
    setErrors({});
    if (editingId === 'new') setProperty('propertyAssets', [...propertyAssets, form]);
    else setProperty('propertyAssets', propertyAssets.map(a => a.id === form.id ? form : a));
    close();
  };

  const deleteAsset = (id) => {
    const asset = propertyAssets.find(a => a.id === id);
    if (!asset) return;
    const deps = getAssetDependents({ propertyMaintenance }, id);
    if (!confirm(assetDeleteMessage(asset.name, deps))) return;
    mergeProperty(cascadeDeleteAsset({ propertyAssets, propertyMaintenance }, id));
  };

  if (!selProp && propScope === 'current') {
    return (
      <div className="page-content">
        <EmptyState
          icon={<Icon name="wrench" size={38} />}
          title="Select a property from the Overview or Properties tab first."
        />
      </div>
    );
  }

  return (
    <div className="page-content">
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }}>
        {properties.length > 1 && (
          <div className="exp-type-sel">
            <button className={`ets-btn ${propScope === 'current' ? 'active' : ''}`} onClick={() => setPropScope('current')}>This property</button>
            <button className={`ets-btn ${propScope === 'all' ? 'active' : ''}`} onClick={() => setPropScope('all')}>All</button>
          </div>
        )}
        <button className="btn-primary" onClick={openNew} disabled={!selProp}>
          <Icon name="plus" size={14} /> Add Asset
        </button>
      </div>

      {/* Filters */}
      <Card variant="section" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="form-section-label" style={{ minWidth: 70 }}>Type</span>
            <div className="filter-tabs">
              {['All', ...ASSET_TYPES].map(t => (
                <button key={t} className={`filter-tab ${filterType === t ? 'active' : ''}`} onClick={() => setFilterType(t)}>{t}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="form-section-label" style={{ minWidth: 70 }}>Condition</span>
            <div className="filter-tabs">
              {['All', ...CONDITIONS].map(c => (
                <button key={c} className={`filter-tab ${filterCond === c ? 'active' : ''}`} onClick={() => setFilterCond(c)}>{c}</button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {visibleAssets.length === 0 ? (
        <EmptyState
          icon={<Icon name="wrench" size={38} />}
          title={propertyAssets.length === 0
            ? 'No assets registered yet. Track your appliances, systems, and fixtures here.'
            : 'No assets match the current filters.'}
          action={selProp && <button className="btn-primary" onClick={openNew}><Icon name="plus" size={14} /> Add Asset</button>}
        />
      ) : (
        <div className="fn-list">
          {visibleAssets.map(asset => {
            const prop = properties.find(p => p.id === asset.propertyId);
            const area = (prop?.areas || []).find(a => a.id === asset.areaId);
            const maintRecords = propertyMaintenance.filter(m => m.propertyId === asset.propertyId);
            return (
              <AssetRow
                key={asset.id}
                asset={asset}
                area={area}
                maintenanceRecords={maintRecords}
                onEdit={openEdit}
                onDelete={deleteAsset}
              />
            );
          })}
        </div>
      )}

      {/* ── Modal ──────────────────────────────────────────────────────────── */}
      {showModal && (
        <Portal>
        <div className="modal-overlay" onClick={close}>
          <div className="modal wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId === 'new' ? 'Add Asset / Appliance' : 'Edit Asset'}</h3>
              <button className="btn-icon" onClick={close}><Icon name="close" size={14} /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group full">
                  <label>Name *</label>
                  <input className={`input${errors.name ? ' input-error' : ''}`} placeholder='e.g. "Lounge Heat Pump", "Hot Water Cylinder"' value={form.name} onChange={e => setField('name', e.target.value)} autoFocus />
                  {errors.name && <span className="field-error">{errors.name}</span>}
                </div>
                <div className="form-group">
                  <label>Type</label>
                  <select className="input" value={form.type} onChange={e => setField('type', e.target.value)}>
                    {ASSET_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Condition</label>
                  <select className="input" value={form.condition} onChange={e => setField('condition', e.target.value)}>
                    {CONDITIONS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Property</label>
                  <select className={`input${errors.propertyId ? ' input-error' : ''}`} value={form.propertyId} onChange={e => setField('propertyId', e.target.value)}>
                    <option value="">— Select —</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  {errors.propertyId && <span className="field-error">{errors.propertyId}</span>}
                </div>
                <div className="form-group">
                  <label>Area</label>
                  <select className="input" value={form.areaId} onChange={e => setField('areaId', e.target.value)}>
                    <option value="">— None —</option>
                    {(properties.find(p => p.id === form.propertyId)?.areas || []).map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Brand</label>
                  <input className="input" placeholder="e.g. Mitsubishi" value={form.brand} onChange={e => setField('brand', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Model</label>
                  <input className="input" placeholder="e.g. MSZ-AP25VG" value={form.model} onChange={e => setField('model', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Date Installed</label>
                  <input className="input" type="date" value={form.dateInstalled} onChange={e => setField('dateInstalled', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Warranty Expiry</label>
                  <input className="input" type="date" value={form.warrantyExpiry} onChange={e => setField('warrantyExpiry', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Expected Lifespan (years)</label>
                  <input className={`input${errors.expectedLifespan ? ' input-error' : ''}`} type="number" min="1" placeholder="e.g. 15" value={form.expectedLifespan} onChange={e => setField('expectedLifespan', e.target.value)} />
                  {errors.expectedLifespan && <span className="field-error">{errors.expectedLifespan}</span>}
                </div>
                <div className="form-group full">
                  <label>Notes (serial number, supplier, etc.)</label>
                  <textarea className="input" rows={3} style={{ resize: 'vertical' }} value={form.notes} onChange={e => setField('notes', e.target.value)} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={close}>Cancel</button>
              <button className="btn-primary" onClick={save}>
                {editingId === 'new' ? 'Add Asset' : 'Save'}
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
}

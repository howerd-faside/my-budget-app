import { useState } from 'react';
import { useApp } from '../../store';
import Icon from '../../components/Icon';
import {
  createProperty, createPropertyArea,
  PROPERTY_TYPES, CONSTRUCTION_TYPES, ROOF_TYPES, CLADDING_TYPES,
  HEATING_TYPES, WATER_SUPPLY_OPTIONS, WASTEWATER_OPTIONS, INSULATION_OPTIONS, AREA_GROUPS,
} from '../../models/Property';
import {
  getPropertyDependents, cascadeDeleteProperty, propertyDeleteMessage,
  getAreaDependents, cascadeDeleteArea, areaDeleteMessage,
} from '../../utils/cascade';

function uid() { return Math.random().toString(36).slice(2, 9); }
function fmtMoney(n) { return n ? `$${Number(n).toLocaleString('en-NZ')}` : null; }

// Local aliases for enum names that were standardised in the Property model.
const WATER_SUPPLY    = WATER_SUPPLY_OPTIONS;
const WASTEWATER      = WASTEWATER_OPTIONS;
const INSULATION_OPTS = INSULATION_OPTIONS;

const EMPTY_PROP = createProperty();
const EMPTY_AREA = createPropertyArea();

const TYPE_COLOR = {
  'Primary Home': 'teal', 'Rental': 'amber', 'Bach/Holiday': 'green',
  'Investment': 'purple', 'Land/Section': '', 'Other': '',
};

// ── PropDetail ────────────────────────────────────────────────────────────────
function PropDetail({ prop, openTasks, overdueTasks, maintenanceCount, onEdit, onAddArea, onDeleteArea }) {
  const [areaForm,    setAreaForm]    = useState(EMPTY_AREA);
  const [addingArea,  setAddingArea]  = useState(false);

  const submitArea = () => {
    if (!areaForm.name.trim()) return;
    onAddArea({ ...areaForm, id: uid() });
    setAreaForm(EMPTY_AREA); setAddingArea(false);
  };

  const grouped = AREA_GROUPS.filter(g => (prop.areas || []).some(a => a.group === g));
  const val = prop.valuation;

  const buildingRows = [
    ['Year Built',    prop.yearBuilt],
    ['Construction',  prop.constructionType],
    ['Roof',          prop.roofType],
    ['Cladding',      prop.cladding],
    ['Heating',       prop.heating],
    ['Water Supply',  prop.waterSupply],
    ['Wastewater',    prop.wastewater],
  ].filter(([, v]) => v);

  const insulationRows = ['ceiling', 'underfloor', 'walls']
    .map(z => [z.charAt(0).toUpperCase() + z.slice(1), prop.insulation?.[z] || 'unknown'])
    .filter(([, v]) => v !== 'unknown');

  return (
    <>
      {/* ── Header card ─────────────────────────────────────────────────── */}
      <div className="dash-section" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.4px', lineHeight: 1.2 }}>{prop.name}</div>
            {prop.address && (
              <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 3 }}>{prop.address}</div>
            )}
            <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span className={`tag ${TYPE_COLOR[prop.type] || ''}`}>{prop.type}</span>
              {(prop.areas || []).length > 0 && (
                <span className="tag">{(prop.areas || []).length} area{(prop.areas || []).length !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button className="btn-ghost small" onClick={onEdit}>
              <Icon name="pencil" size={12} /> Edit
            </button>
          </div>
        </div>

        {/* Key stats */}
        <div className="fn-summary" style={{ marginBottom: 0 }}>
          {prop.bedrooms  && <div className="fns-item"><span>Bedrooms</span><div className="fns-val-row"><span className="mono">{prop.bedrooms}</span></div></div>}
          {prop.bathrooms && <div className="fns-item"><span>Bathrooms</span><div className="fns-val-row"><span className="mono">{prop.bathrooms}</span></div></div>}
          {prop.floorArea && <div className="fns-item"><span>Floor Area</span><div className="fns-val-row"><span className="mono">{prop.floorArea} m²</span></div></div>}
          {prop.landArea  && <div className="fns-item"><span>Land Area</span><div className="fns-val-row"><span className="mono">{prop.landArea} m²</span></div></div>}
          <div className="fns-item"><span>Open Tasks</span><div className="fns-val-row"><span className={`mono ${openTasks > 0 ? '' : 'text3'}`}>{openTasks}</span>{overdueTasks > 0 && <span className="dpill red">{overdueTasks} overdue</span>}</div></div>
          <div className="fns-item"><span>Maintenance</span><div className="fns-val-row"><span className={`mono ${maintenanceCount > 0 ? '' : 'text3'}`}>{maintenanceCount}</span></div></div>
        </div>
      </div>

      {/* ── Valuation (stored) ───────────────────────────────────────────── */}
      {val && (
        <div className="dash-section">
          <div className="section-header">
            <h3>Valuation</h3>
            {val.fetchedAt && <span style={{ fontSize: 11, color: 'var(--text3)' }}>Updated {val.fetchedAt}</span>}
          </div>
          <div className="fn-summary" style={{ marginBottom: 0 }}>
            {val.rv             && <div className="fns-item"><span>RV / CV</span><div className="fns-val-row"><span className="mono">{fmtMoney(val.rv)}</span></div></div>}
            {val.estimatedValue && <div className="fns-item"><span>Estimate</span><div className="fns-val-row"><span className="mono">{fmtMoney(val.estimatedValue)}</span></div></div>}
            {val.landValue      && <div className="fns-item"><span>Land Value</span><div className="fns-val-row"><span className="mono">{fmtMoney(val.landValue)}</span></div></div>}
            {val.improvementsValue && <div className="fns-item"><span>Improvements</span><div className="fns-val-row"><span className="mono">{fmtMoney(val.improvementsValue)}</span></div></div>}
          </div>
          {val.valuationDate && (
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text3)' }}>Valuation date: {val.valuationDate}</div>
          )}
        </div>
      )}

      {/* ── Building details ─────────────────────────────────────────────── */}
      {(buildingRows.length > 0 || insulationRows.length > 0 || prop.notes) && (
        <div className="dash-section">
          <div className="section-header">
            <h3>Building Details</h3>
            <button className="btn-ghost small" onClick={onEdit}><Icon name="pencil" size={12} /> Edit</button>
          </div>
          {buildingRows.length > 0 && (
            <div className="person-numbers" style={{ marginBottom: insulationRows.length > 0 ? 14 : 0 }}>
              {buildingRows.map(([label, value]) => (
                <div key={label} className="pn-item">
                  <span>{label}</span>
                  <span className="mono">{value}</span>
                </div>
              ))}
            </div>
          )}
          {insulationRows.length > 0 && (
            <>
              <div className="form-section-label" style={{ marginBottom: 6 }}>Insulation</div>
              <div className="person-numbers">
                {insulationRows.map(([label, value]) => (
                  <div key={label} className="pn-item">
                    <span>{label}</span>
                    <span className={`mono ${value === 'yes' ? 'green' : value === 'no' ? 'red' : 'text3'}`}>{value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {prop.notes && (
            <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--card2)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
              {prop.notes}
            </div>
          )}
        </div>
      )}

      {/* ── Areas ───────────────────────────────────────────────────────── */}
      <div className="dash-section">
        <div className="section-header">
          <h3>Areas &amp; Zones</h3>
          <button className="btn-icon" onClick={() => setAddingArea(true)} title="Add area">
            <Icon name="plus" size={13} />
          </button>
        </div>

        {addingArea && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
            <input
              className="input small"
              style={{ flex: '1 1 180px' }}
              placeholder="Area name (e.g. Kitchen, Deck, Garage)"
              value={areaForm.name}
              onChange={e => setAreaForm(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') submitArea(); if (e.key === 'Escape') setAddingArea(false); }}
              autoFocus
            />
            <select className="input small" style={{ flex: '0 0 130px' }} value={areaForm.group} onChange={e => setAreaForm(f => ({ ...f, group: e.target.value }))}>
              {AREA_GROUPS.map(g => <option key={g}>{g}</option>)}
            </select>
            <button className="btn-primary small" onClick={submitArea}>Add</button>
            <button className="btn-ghost small" onClick={() => { setAddingArea(false); setAreaForm(EMPTY_AREA); }}>Cancel</button>
          </div>
        )}

        {(prop.areas || []).length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text3)' }}>No areas defined. Add areas to tag tasks, maintenance, and assets.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {grouped.map(group => (
              <div key={group}>
                <div className="form-section-label" style={{ marginBottom: 6 }}>{group}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(prop.areas || []).filter(a => a.group === group).map(area => (
                    <span key={area.id} className="prop-area-chip">
                      {area.name}
                      <button className="btn-icon small danger" style={{ marginLeft: 2 }} onClick={() => onDeleteArea(area.id)}>
                        <Icon name="close" size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PropertyRegister() {
  const { state, set, cascadeDelete } = useApp();
  const { properties = [], propertyTasks = [], propertyMaintenance = [], selectedPropertyId } = state;

  const [showModal,    setShowModal]    = useState(false);
  const [form,         setForm]         = useState(EMPTY_PROP);
  const [editingId,    setEditingId]    = useState(null);
  const [modalTab,     setModalTab]     = useState('profile');
  const [areaForm,     setAreaForm]     = useState(EMPTY_AREA);

  const selProp = properties.find(p => p.id === selectedPropertyId) || null;

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setInsul = (k, v) => setForm(f => ({ ...f, insulation: { ...f.insulation, [k]: v } }));

  const openNew = () => {
    setForm({ ...EMPTY_PROP, id: uid(), areas: [] });
    setEditingId('new'); setModalTab('profile');
    setShowModal(true);
  };

  const openEdit = (prop) => {
    setForm({ ...EMPTY_PROP, ...prop, insulation: { ...EMPTY_PROP.insulation, ...prop.insulation }, areas: prop.areas || [] });
    setEditingId(prop.id); setModalTab('profile');
    setShowModal(true);
  };

  const close = () => { setShowModal(false); setForm(EMPTY_PROP); setEditingId(null); };

  const save = () => {
    if (!form.name.trim()) return;
    if (editingId === 'new') {
      set('properties', [...properties, form]);
      if (!selectedPropertyId) set('selectedPropertyId', form.id);
    } else {
      set('properties', properties.map(p => p.id === form.id ? form : p));
    }
    close();
  };

  const deleteProp = (id) => {
    const prop = properties.find(p => p.id === id);
    if (!prop) return;
    const deps = getPropertyDependents(state, id);
    if (!confirm(propertyDeleteMessage(prop.name, deps))) return;
    cascadeDelete(cascadeDeleteProperty(state, id));
  };

  const addAreaToSelected = (area) => {
    set('properties', properties.map(p =>
      p.id === selProp.id ? { ...p, areas: [...(p.areas || []), area] } : p
    ));
  };

  const deleteAreaFromSelected = (areaId) => {
    const area = (selProp.areas || []).find(a => a.id === areaId);
    if (!area) return;
    const deps = getAreaDependents(state, selProp.id, areaId);
    if (!confirm(areaDeleteMessage(area.name, deps))) return;
    cascadeDelete(cascadeDeleteArea(state, selProp.id, areaId));
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <div className="page-title">Properties</div>
          <div className="page-sub">{properties.length} {properties.length === 1 ? 'property' : 'properties'} registered</div>
        </div>
        <button className="btn-primary" onClick={openNew}>
          <Icon name="plus" size={14} /> Add Property
        </button>
      </div>

      {properties.length === 0 ? (
        <div className="empty-state">
          <div className="es-icon"><Icon name="building" size={38} /></div>
          <div className="es-text">Add your first property to begin tracking maintenance, tasks, and improvements.</div>
          <button className="btn-primary" onClick={openNew}><Icon name="plus" size={14} /> Add Property</button>
        </div>
      ) : (
        <div className="prop-register-layout">
          {/* ── Left: property list ─────────────────────────────────────── */}
          <div>
            <div className="dash-section">
              <div className="section-header"><h3>Your Properties</h3></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {properties.map(prop => {
                  const isSelected = prop.id === selectedPropertyId;
                  const tasks   = propertyTasks.filter(t => t.propertyId === prop.id && t.status !== 'Done' && t.status !== 'Cancelled');
                  const overdue = tasks.filter(t => t.dueDate && t.dueDate < today);
                  const hasStats = prop.bedrooms || prop.bathrooms || prop.floorArea;
                  return (
                    <div
                      key={prop.id}
                      className="income-card"
                      style={{
                        cursor: 'pointer', marginBottom: 0,
                        border: isSelected ? '1px solid var(--teal)' : '1px solid transparent',
                        background: isSelected ? 'rgba(0,113,227,0.04)' : undefined,
                      }}
                      onClick={() => set('selectedPropertyId', prop.id)}
                    >
                      <div className="ic-header">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="ic-name">{prop.name}</div>
                          {prop.address && <div className="ic-employer-line">{prop.address}</div>}
                        </div>
                        <div className="ic-tags">
                          <span className={`tag ${TYPE_COLOR[prop.type] || ''}`}>{prop.type}</span>
                        </div>
                      </div>

                      {hasStats && (
                        <div className="ic-stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginTop: 8 }}>
                          {prop.bedrooms  && <div className="ic-stat"><span className="ic-stat-label">Bed</span><span className="mono ic-stat-val">{prop.bedrooms}</span></div>}
                          {prop.bathrooms && <div className="ic-stat"><span className="ic-stat-label">Bath</span><span className="mono ic-stat-val">{prop.bathrooms}</span></div>}
                          {prop.floorArea && <div className="ic-stat"><span className="ic-stat-label">Floor</span><span className="mono ic-stat-val">{prop.floorArea}m²</span></div>}
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {prop.valuation?.rv && (
                            <span className="tag" style={{ color: 'var(--teal)' }}>RV {fmtMoney(prop.valuation.rv)}</span>
                          )}
                          {tasks.length  > 0 && <span className="tag">{tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>}
                          {overdue.length > 0 && <span className="dpill red">{overdue.length} overdue</span>}
                        </div>
                        <div className="person-actions" onClick={e => e.stopPropagation()}>
                          <button className="btn-icon small" onClick={() => openEdit(prop)}><Icon name="pencil" size={12} /></button>
                          <button className="btn-icon small danger" onClick={() => deleteProp(prop.id)}><Icon name="trash" size={12} /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Right: detail ───────────────────────────────────────────── */}
          {selProp ? (
            <PropDetail
              prop={selProp}
              openTasks={propertyTasks.filter(t => t.propertyId === selProp.id && t.status !== 'Done' && t.status !== 'Cancelled').length}
              overdueTasks={propertyTasks.filter(t => t.propertyId === selProp.id && t.status !== 'Done' && t.status !== 'Cancelled' && t.dueDate && t.dueDate < today).length}
              maintenanceCount={propertyMaintenance.filter(m => m.propertyId === selProp.id).length}
              onEdit={() => openEdit(selProp)}
              onAddArea={addAreaToSelected}
              onDeleteArea={deleteAreaFromSelected}
            />
          ) : (
            <div className="dash-section">
              <p style={{ fontSize: 13, color: 'var(--text3)' }}>Select a property to view details.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Modal ─────────────────────────────────────────────────────────── */}
      {showModal && (
        <div className="modal-overlay" onClick={close}>
          <div className="modal wide" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId === 'new' ? 'Add Property' : `Edit — ${form.name || 'Property'}`}</h3>
              <button className="btn-icon" onClick={close}><Icon name="close" size={14} /></button>
            </div>

            <div className="prop-modal-tabs">
              {[['profile', 'Profile'], ['details', 'Building Details'], ['areas', 'Areas']].map(([id, label]) => (
                <button key={id} className={`pmt-btn ${modalTab === id ? 'active' : ''}`} onClick={() => setModalTab(id)}>{label}</button>
              ))}
            </div>

            <div className="modal-body">
              {modalTab === 'profile' && (
                <div className="form-grid">
                  <div className="form-group full">
                    <label>Property Name *</label>
                    <input className="input" placeholder='e.g. "Our Place", "Taupo Bach"' value={form.name} onChange={e => setField('name', e.target.value)} autoFocus />
                  </div>
                  <div className="form-group">
                    <label>Type</label>
                    <select className="input" value={form.type} onChange={e => setField('type', e.target.value)}>
                      {PROPERTY_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group full">
                    <label>Address</label>
                    <input className="input" placeholder="Street address" value={form.address} onChange={e => setField('address', e.target.value)} />
                  </div>

                  <div className="form-group">
                    <label>Bedrooms</label>
                    <input className="input" type="number" min="0" value={form.bedrooms} onChange={e => setField('bedrooms', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Bathrooms</label>
                    <input className="input" type="number" min="0" step="0.5" value={form.bathrooms} onChange={e => setField('bathrooms', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Land Area (m²)</label>
                    <input className="input" type="number" min="0" value={form.landArea} onChange={e => setField('landArea', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Floor Area (m²)</label>
                    <input className="input" type="number" min="0" value={form.floorArea} onChange={e => setField('floorArea', e.target.value)} />
                  </div>
                  <div className="form-group full">
                    <label>Notes</label>
                    <textarea className="input" rows={3} style={{ resize: 'vertical' }} value={form.notes} onChange={e => setField('notes', e.target.value)} />
                  </div>
                </div>
              )}

              {modalTab === 'details' && (
                <div className="form-grid">
                  <div className="form-group">
                    <label>Year Built</label>
                    <input className="input" placeholder="e.g. 1985" value={form.yearBuilt} onChange={e => setField('yearBuilt', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Construction Type</label>
                    <select className="input" value={form.constructionType} onChange={e => setField('constructionType', e.target.value)}>
                      {CONSTRUCTION_TYPES.map(t => <option key={t} value={t}>{t || '— Select —'}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Roof Type</label>
                    <select className="input" value={form.roofType} onChange={e => setField('roofType', e.target.value)}>
                      {ROOF_TYPES.map(t => <option key={t} value={t}>{t || '— Select —'}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Cladding</label>
                    <select className="input" value={form.cladding} onChange={e => setField('cladding', e.target.value)}>
                      {CLADDING_TYPES.map(t => <option key={t} value={t}>{t || '— Select —'}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Heating</label>
                    <select className="input" value={form.heating} onChange={e => setField('heating', e.target.value)}>
                      {HEATING_TYPES.map(t => <option key={t} value={t}>{t || '— Select —'}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Water Supply</label>
                    <select className="input" value={form.waterSupply} onChange={e => setField('waterSupply', e.target.value)}>
                      {WATER_SUPPLY.map(t => <option key={t} value={t}>{t || '— Select —'}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Wastewater</label>
                    <select className="input" value={form.wastewater} onChange={e => setField('wastewater', e.target.value)}>
                      {WASTEWATER.map(t => <option key={t} value={t}>{t || '— Select —'}</option>)}
                    </select>
                  </div>
                  <div className="form-group full">
                    <label>Insulation</label>
                    <div className="prop-insul-grid">
                      {['ceiling', 'underfloor', 'walls'].map(zone => (
                        <div key={zone} className="prop-insul-item">
                          <span className="prop-insul-label">{zone.charAt(0).toUpperCase() + zone.slice(1)}</span>
                          <div className="prop-insul-opts">
                            {INSULATION_OPTS.map(opt => (
                              <button key={opt} className={`prop-insul-btn ${form.insulation[zone] === opt ? 'active' : ''}`} onClick={() => setInsul(zone, opt)}>{opt}</button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {modalTab === 'areas' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <p style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
                    Define areas to tag tasks, maintenance records, and assets.
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                      className="input small"
                      style={{ flex: '1 1 180px' }}
                      placeholder="Area name (e.g. Kitchen, Deck)"
                      value={areaForm.name}
                      onChange={e => setAreaForm(f => ({ ...f, name: e.target.value }))}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && areaForm.name.trim()) {
                          setForm(f => ({ ...f, areas: [...f.areas, { ...areaForm, id: uid() }] }));
                          setAreaForm(EMPTY_AREA);
                        }
                      }}
                    />
                    <select className="input small" style={{ flex: '0 0 120px' }} value={areaForm.group} onChange={e => setAreaForm(f => ({ ...f, group: e.target.value }))}>
                      {AREA_GROUPS.map(g => <option key={g}>{g}</option>)}
                    </select>
                    <button className="btn-ghost small" onClick={() => {
                      if (!areaForm.name.trim()) return;
                      setForm(f => ({ ...f, areas: [...f.areas, { ...areaForm, id: uid() }] }));
                      setAreaForm(EMPTY_AREA);
                    }}>Add</button>
                  </div>
                  {form.areas.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {form.areas.map(a => (
                        <span key={a.id} className="prop-area-chip">
                          {a.name}
                          <span className="text3" style={{ fontSize: 10, marginLeft: 4 }}>({a.group})</span>
                          <button className="btn-icon small danger" style={{ marginLeft: 2 }} onClick={() => setForm(f => ({ ...f, areas: f.areas.filter(x => x.id !== a.id) }))}>
                            <Icon name="close" size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-ghost" onClick={close}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={!form.name.trim()}>
                {editingId === 'new' ? 'Add Property' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useMemo, Fragment } from 'react';
import { useProperty } from '../../store/hooks';
import Icon from '../../components/Icon';
import Portal from '../../components/Portal';
import { Card, SectionHeader, StatTile, EmptyState } from '../../components/ui';
import {
  createProperty, createPropertyArea,
  PROPERTY_TYPES, CONSTRUCTION_TYPES, ROOF_TYPES, CLADDING_TYPES,
  HEATING_TYPES, WATER_SUPPLY_OPTIONS, WASTEWATER_OPTIONS, INSULATION_OPTIONS, AREA_GROUPS,
} from '../../models/Property';
import {
  getPropertyDependents, cascadeDeleteProperty, propertyDeleteMessage,
  getAreaDependents, cascadeDeleteArea, areaDeleteMessage,
} from '../../utils/cascade';

function fmtMoney(n) { return n ? `$${Number(n).toLocaleString('en-NZ')}` : null; }

const WATER_SUPPLY    = WATER_SUPPLY_OPTIONS;
const WASTEWATER      = WASTEWATER_OPTIONS;
const INSULATION_OPTS = INSULATION_OPTIONS;

const EMPTY_PROP = createProperty();
const EMPTY_AREA = createPropertyArea();

const TYPE_COLOR = {
  'Primary Home': 'teal', 'Rental': 'amber', 'Bach/Holiday': 'green',
  'Investment': 'purple', 'Land/Section': '', 'Other': '',
};

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PropertyRegister({ onSelectTab = () => {} }) {
  const {
    properties, propertyTasks, propertyMaintenance, propertyProjects, propertyAssets,
    selectedPropertyId, setProperty, mergeProperty,
  } = useProperty();

  const [showModal,      setShowModal]      = useState(false);
  const [form,           setForm]           = useState(EMPTY_PROP);
  const [editingId,      setEditingId]      = useState(null);
  const [modalTab,       setModalTab]       = useState('profile');
  const [areaForm,       setAreaForm]       = useState(EMPTY_AREA);   // modal areas tab
  const [addingArea,     setAddingArea]     = useState(false);         // inline add area
  const [detailAreaForm, setDetailAreaForm] = useState(EMPTY_AREA);   // inline add area form

  const selProp = properties.find(p => p.id === selectedPropertyId) || null;
  const today   = new Date().toISOString().slice(0, 10);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setInsul = (k, v) => setForm(f => ({ ...f, insulation: { ...f.insulation, [k]: v } }));

  const openNew = () => {
    setForm({ ...EMPTY_PROP, id: crypto.randomUUID(), areas: [] });
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
      setProperty('properties', [...properties, form]);
      if (!selectedPropertyId) setProperty('selectedPropertyId', form.id);
    } else {
      setProperty('properties', properties.map(p => p.id === form.id ? form : p));
    }
    close();
  };

  const deleteProp = (id) => {
    const prop = properties.find(p => p.id === id);
    if (!prop) return;
    const propState = { properties, propertyTasks, propertyMaintenance, propertyProjects, propertyAssets, selectedPropertyId };
    const deps = getPropertyDependents(propState, id);
    if (!confirm(propertyDeleteMessage(prop.name, deps))) return;
    mergeProperty(cascadeDeleteProperty(propState, id));
  };

  const submitDetailArea = () => {
    if (!detailAreaForm.name.trim() || !selProp) return;
    setProperty('properties', properties.map(p =>
      p.id === selProp.id ? { ...p, areas: [...(p.areas || []), { ...detailAreaForm, id: crypto.randomUUID() }] } : p
    ));
    setDetailAreaForm(EMPTY_AREA);
    setAddingArea(false);
  };

  const deleteAreaFromSelected = (areaId) => {
    const area = (selProp.areas || []).find(a => a.id === areaId);
    if (!area) return;
    const areaState = { propertyTasks, propertyMaintenance, propertyAssets, properties };
    const deps = getAreaDependents(areaState, selProp.id, areaId);
    if (!confirm(areaDeleteMessage(area.name, deps))) return;
    mergeProperty(cascadeDeleteArea(areaState, selProp.id, areaId));
  };

  // ── Derived stats for selected property ──────────────────────────────────
  const detail = useMemo(() => {
    if (!selProp) return null;
    const id       = selProp.id;
    const open     = propertyTasks.filter(t => t.propertyId === id && t.status !== 'Done' && t.status !== 'Cancelled');
    const overdue  = open.filter(t => t.dueDate && t.dueDate < today);
    const maint    = propertyMaintenance.filter(m => m.propertyId === id).length;
    const projects = propertyProjects.filter(p => p.propertyId === id && p.status !== 'Completed' && p.status !== 'Cancelled').length;
    const alerts   = propertyAssets.filter(a => {
      if (a.propertyId !== id) return false;
      if (a.condition === 'Poor' || a.condition === 'Critical') return true;
      const w = a.warrantyExpiry ? Math.round((new Date(a.warrantyExpiry) - new Date(today)) / 86400000) : null;
      return w !== null && w >= 0 && w <= 90;
    }).length;
    return { openTasks: open.length, overdue: overdue.length, maint, projects, alerts };
  }, [selProp, propertyTasks, propertyMaintenance, propertyProjects, propertyAssets, today]);

  // ── Building detail groups for selected property ──────────────────────────
  const buildingGroups = selProp ? [
    {
      label: 'Core Structure',
      rows: [
        ['Year Built',   selProp.yearBuilt],
        ['Construction', selProp.constructionType],
        ['Roof',         selProp.roofType],
        ['Cladding',     selProp.cladding],
      ].filter(([, v]) => v),
    },
    {
      label: 'Utilities',
      rows: [
        ['Heating',      selProp.heating],
        ['Water Supply', selProp.waterSupply],
        ['Wastewater',   selProp.wastewater],
      ].filter(([, v]) => v),
    },
    {
      label: 'Insulation',
      isInsulation: true,
      rows: ['Ceiling', 'Underfloor', 'Walls']
        .map(z => [z, selProp.insulation?.[z.toLowerCase()] || 'unknown'])
        .filter(([, v]) => v !== 'unknown'),
    },
  ].filter(g => g.rows.length > 0) : [];

  const areaGroups = selProp
    ? AREA_GROUPS.filter(g => (selProp.areas || []).some(a => a.group === g))
    : [];

  // ── Modal ─────────────────────────────────────────────────────────────────
  function renderModal() {
    return (
      <Portal>
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
                          setForm(f => ({ ...f, areas: [...f.areas, { ...areaForm, id: crypto.randomUUID() }] }));
                          setAreaForm(EMPTY_AREA);
                        }
                      }}
                    />
                    <select className="input small" style={{ flex: '0 0 120px' }} value={areaForm.group} onChange={e => setAreaForm(f => ({ ...f, group: e.target.value }))}>
                      {AREA_GROUPS.map(g => <option key={g}>{g}</option>)}
                    </select>
                    <button className="btn-ghost small" onClick={() => {
                      if (!areaForm.name.trim()) return;
                      setForm(f => ({ ...f, areas: [...f.areas, { ...areaForm, id: crypto.randomUUID() }] }));
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
      </Portal>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (properties.length === 0) {
    return (
      <div className="page-content">
        <EmptyState
          icon={<Icon name="building" size={38} />}
          title="Add your first property to begin tracking maintenance, tasks, and improvements."
          action={
            <button className="btn-primary" onClick={openNew}>
              <Icon name="plus" size={14} /> Add Property
            </button>
          }
        />
        {showModal && renderModal()}
      </div>
    );
  }

  return (
    <div className="page-content">

      {/* ── Tier 1: Property Selector ────────────────────────────────────── */}
      <Card variant="section">
        <SectionHeader
          title={<><Icon name="building" size={15} /> Properties</>}
          subtitle={`${properties.length} ${properties.length === 1 ? 'property' : 'properties'} · click to select`}
          actions={
            <button className="btn-ghost small" onClick={openNew}>
              <Icon name="plus" size={12} /> Add Property
            </button>
          }
        />
        <div className="prop-selector">
          {properties.map(prop => {
            const isSelected = prop.id === selectedPropertyId;
            const overdue = propertyTasks.filter(t =>
              t.propertyId === prop.id && t.status !== 'Done' && t.status !== 'Cancelled' && t.dueDate && t.dueDate < today
            ).length;
            return (
              <div
                key={prop.id}
                className={`prop-sel-item${isSelected ? ' selected' : ''}`}
                onClick={() => setProperty('selectedPropertyId', prop.id)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                  <span className="prop-sel-name">{prop.name}</span>
                  <button
                    className="btn-icon small danger prop-sel-del"
                    onClick={e => { e.stopPropagation(); deleteProp(prop.id); }}
                    title="Delete property"
                  >
                    <Icon name="trash" size={11} />
                  </button>
                </div>
                {prop.address && <span className="prop-sel-addr">{prop.address}</span>}
                <div className="prop-sel-meta">
                  <span className={`tag ${TYPE_COLOR[prop.type] || ''}`}>{prop.type}</span>
                  {prop.bedrooms  && <span className="tag">{prop.bedrooms}bd</span>}
                  {prop.bathrooms && <span className="tag">{prop.bathrooms}ba</span>}
                  {overdue > 0    && <span className="dpill red">{overdue} due</span>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── Tier 2 + 3: Selected property detail ─────────────────────────── */}
      {selProp && detail && (
        <>
          {/* ── Tier 2: Snapshot stat row ───────────────────────────────── */}
          <Card variant="section">
            <SectionHeader
              title={<><Icon name="building" size={15} /> Property Snapshot</>}
              subtitle={selProp.address ? `${selProp.name} · ${selProp.address}` : selProp.name}
              actions={
                <button className="btn-ghost small" onClick={() => openEdit(selProp)}>
                  <Icon name="pencil" size={12} /> Edit
                </button>
              }
            />
            <div className="fn-summary">
              {selProp.bedrooms  && <StatTile label="Bedrooms"   value={selProp.bedrooms} />}
              {selProp.bathrooms && <StatTile label="Bathrooms"  value={selProp.bathrooms} />}
              {selProp.floorArea && <StatTile label="Floor Area" value={`${selProp.floorArea} m²`} />}
              {selProp.landArea  && <StatTile label="Land Area"  value={`${selProp.landArea} m²`} />}
              <StatTile
                label="Open Tasks"
                value={detail.openTasks}
                valueClassName={detail.openTasks > 0 ? '' : 'text3'}
                meta={detail.overdue > 0 ? <span className="dpill red">{detail.overdue} overdue</span> : null}
              />
              <StatTile label="Maintenance" value={detail.maint} valueClassName={detail.maint > 0 ? '' : 'text3'} />
            </div>
          </Card>

          {/* ── Tier 3: Two-column detail grid ──────────────────────────── */}
          <div className="dash-grid">

            {/* Left — Building Details + Areas */}
            <div className="dash-col-8" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {(buildingGroups.length > 0 || selProp.notes) && (
                <Card variant="section">
                  <SectionHeader
                    title="Building Details"
                    actions={
                      <button className="btn-ghost small" onClick={() => openEdit(selProp)}>
                        <Icon name="pencil" size={12} /> Edit
                      </button>
                    }
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, alignItems: 'start' }}>
                    {buildingGroups.map((group, gi) => {
                      const rightCol  = gi % 2 === 1;
                      const newRow    = gi >= 2;
                      const lastAlone = newRow && gi % 2 === 0 && gi === buildingGroups.length - 1;
                      return (
                        <div
                          key={group.label}
                          style={{
                            paddingLeft:   rightCol  ? 24 : 0,
                            paddingRight: !rightCol  ? 24 : 0,
                            paddingTop:   newRow     ? 16 : 0,
                            paddingBottom: !newRow   ? 16 : 0,
                            borderLeft:   rightCol   ? '1px solid var(--sep)' : undefined,
                            borderTop:    newRow     ? '1px solid var(--sep)' : undefined,
                            gridColumn:   lastAlone  ? '1 / -1' : undefined,
                          }}
                        >
                          <div className="prop-areas-glabel" style={{ marginBottom: 7, color: 'var(--text2)' }}>{group.label}</div>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: lastAlone
                              ? `repeat(${group.rows.length}, max-content auto)`
                              : 'max-content 1fr',
                            gap: '5px 16px',
                            alignItems: 'baseline',
                          }}>
                            {group.rows.map(([label, value]) => (
                              <Fragment key={label}>
                                <span className="edg-label" style={{ marginBottom: 0 }}>{label}</span>
                                <span className="edg-val" style={group.isInsulation ? {
                                  color: value === 'yes' ? 'var(--green)' : value === 'no' ? 'var(--red)' : 'var(--text3)',
                                  marginRight: 24,
                                } : undefined}>{value}</span>
                              </Fragment>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {selProp.notes && (
                    <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--card2)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
                      {selProp.notes}
                    </div>
                  )}
                </Card>
              )}

              <Card variant="section">
                <SectionHeader
                  title="Areas & Zones"
                  actions={
                    <button className="btn-icon" onClick={() => setAddingArea(true)} title="Add area">
                      <Icon name="plus" size={13} />
                    </button>
                  }
                />

                {addingArea && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
                    <input
                      className="input small"
                      style={{ flex: '1 1 180px' }}
                      placeholder="Area name (e.g. Kitchen, Deck, Garage)"
                      value={detailAreaForm.name}
                      onChange={e => setDetailAreaForm(f => ({ ...f, name: e.target.value }))}
                      onKeyDown={e => {
                        if (e.key === 'Enter') submitDetailArea();
                        if (e.key === 'Escape') { setAddingArea(false); setDetailAreaForm(EMPTY_AREA); }
                      }}
                      autoFocus
                    />
                    <select className="input small" style={{ flex: '0 0 130px' }} value={detailAreaForm.group} onChange={e => setDetailAreaForm(f => ({ ...f, group: e.target.value }))}>
                      {AREA_GROUPS.map(g => <option key={g}>{g}</option>)}
                    </select>
                    <button className="btn-primary small" onClick={submitDetailArea}>Add</button>
                    <button className="btn-ghost small" onClick={() => { setAddingArea(false); setDetailAreaForm(EMPTY_AREA); }}>Cancel</button>
                  </div>
                )}

                {(selProp.areas || []).length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text3)' }}>No areas defined. Add areas to tag tasks, maintenance, and assets.</p>
                ) : (
                  <>
                    {areaGroups.map(group => {
                      const groupAreas = (selProp.areas || []).filter(a => a.group === group);
                      return (
                        <div key={group} className="prop-areas-group">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className="prop-areas-glabel">{group}</span>
                            <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{groupAreas.length}</span>
                          </div>
                          <div className="prop-areas-chips">
                            {groupAreas.map(area => (
                              <span key={area.id} className="prop-area-chip mini">
                                {area.name}
                                <button className="btn-icon small danger" onClick={() => deleteAreaFromSelected(area.id)}>
                                  <Icon name="close" size={10} />
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </Card>
            </div>

            {/* Right — Status + Quick Actions + Valuation */}
            <div className="dash-col-4" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              <Card variant="section">
                <SectionHeader title="Status" />
                <div className="fn-list">
                  {[
                    { label: 'Open Tasks',      value: detail.openTasks, cls: detail.openTasks > 0 ? '' : 'text3', badge: detail.overdue > 0 && <span className="dpill red">{detail.overdue} overdue</span> },
                    { label: 'Asset Alerts',     value: detail.alerts,    cls: detail.alerts > 0 ? 'amber' : 'text3' },
                    { label: 'Active Projects',  value: detail.projects,  cls: detail.projects > 0 ? '' : 'text3' },
                    { label: 'Maintenance Logs', value: detail.maint,     cls: detail.maint > 0 ? '' : 'text3' },
                  ].map(({ label, value, cls, badge }) => (
                    <div key={label} className="fn-row">
                      <div className="fn-main" style={{ cursor: 'default' }}>
                        <div className="fn-left">
                          <div className="fn-label">{label}</div>
                        </div>
                        <div className="fn-right">
                          {badge}
                          <span className={`mono ${cls}`} style={{ fontSize: 13 }}>{value}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card variant="section">
                <SectionHeader title="Quick Actions" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button className="btn-ghost small" onClick={() => onSelectTab('prop-tasks')}>
                    <Icon name="clipboard" size={12} /> Add Task
                  </button>
                  <button className="btn-ghost small" onClick={() => onSelectTab('prop-maint')}>
                    <Icon name="wrench" size={12} /> Add Maintenance
                  </button>
                  <button className="btn-ghost small" onClick={() => onSelectTab('prop-assets')}>
                    <Icon name="tag" size={12} /> Add Asset
                  </button>
                  <button className="btn-ghost small" onClick={() => openEdit(selProp)}>
                    <Icon name="pencil" size={12} /> Edit Property
                  </button>
                </div>
              </Card>

              {selProp.valuation && (
                <Card variant="section">
                  <SectionHeader
                    title="Valuation"
                    subtitle={selProp.valuation.fetchedAt ? `Updated ${selProp.valuation.fetchedAt}` : undefined}
                  />
                  <div className="exp-detail-grid">
                    {[
                      ['RV / CV',      selProp.valuation.rv],
                      ['Estimate',     selProp.valuation.estimatedValue],
                      ['Land Value',   selProp.valuation.landValue],
                      ['Improvements', selProp.valuation.improvementsValue],
                    ].filter(([, v]) => v).map(([label, value]) => (
                      <div key={label} className="edg-item">
                        <span className="edg-label">{label}</span>
                        <span className="edg-val mono">{fmtMoney(value)}</span>
                      </div>
                    ))}
                  </div>
                  {selProp.valuation.valuationDate && (
                    <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text3)' }}>Valuation date: {selProp.valuation.valuationDate}</div>
                  )}
                </Card>
              )}
            </div>
          </div>
        </>
      )}

      {showModal && renderModal()}
    </div>
  );
}

import { useState, useMemo } from 'react';
import { useProperty } from '../../store/hooks';
import Icon from '../../components/Icon';
import Portal from '../../components/Portal';
import { EmptyState, Card } from '../../components/ui';
import {
  createPropertyMaintenance,
  MAINTENANCE_CATEGORIES, PERFORMED_BY_OPTIONS,
} from '../../models/PropertyMaintenance';

function today() { return new Date().toISOString().slice(0, 10); }

const CATEGORIES   = MAINTENANCE_CATEGORIES;
const PERFORMED_BY = PERFORMED_BY_OPTIONS;

const EMPTY_RECORD = createPropertyMaintenance();

function groupByMonth(records) {
  const groups = {};
  for (const r of records) {
    const month = r.date ? r.date.slice(0, 7) : 'Unknown';
    if (!groups[month]) groups[month] = [];
    groups[month].push(r);
  }
  return Object.entries(groups)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, items]) => ({ month, items }));
}

function fmtMonth(ym) {
  if (!ym || ym === 'Unknown') return 'Unknown';
  const [y, m] = ym.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString('en-NZ', { month: 'long', year: 'numeric' });
}

export default function PropertyMaintenance() {
  const { properties, propertyMaintenance, propertyTasks, propertyAssets, selectedPropertyId, setProperty } = useProperty();

  const selProp  = properties.find(p => p.id === selectedPropertyId) || null;
  const areas    = selProp?.areas || [];

  const [showModal,  setShowModal]  = useState(false);
  const [form,       setForm]       = useState(EMPTY_RECORD);
  const [editingId,  setEditingId]  = useState(null);
  const [filterCat,  setFilterCat]  = useState('All');
  const [filterArea, setFilterArea] = useState('All');
  const [search,     setSearch]     = useState('');
  const [propScope,  setPropScope]  = useState('current');

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const records = useMemo(() => {
    let list = propertyMaintenance;
    if (propScope === 'current' && selectedPropertyId) list = list.filter(r => r.propertyId === selectedPropertyId);
    if (filterCat  !== 'All') list = list.filter(r => r.category === filterCat);
    if (filterArea !== 'All') list = list.filter(r => r.areaId   === filterArea);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r => r.title.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q));
    }
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [propertyMaintenance, propScope, selectedPropertyId, filterCat, filterArea, search]);

  const groups = useMemo(() => groupByMonth(records), [records]);

  const propTasks  = selProp ? propertyTasks.filter(t => t.propertyId === selProp.id && t.status !== 'Cancelled') : [];
  const propAssets = selProp ? propertyAssets.filter(a => a.propertyId === selProp.id) : [];

  const openNew = () => {
    setForm({ ...EMPTY_RECORD, id: crypto.randomUUID(), propertyId: selectedPropertyId || '', date: today(), createdAt: today() });
    setEditingId('new'); setShowModal(true);
  };

  const openEdit = (rec) => {
    setForm({ ...EMPTY_RECORD, ...rec });
    setEditingId(rec.id); setShowModal(true);
  };

  const close = () => { setShowModal(false); setForm(EMPTY_RECORD); setEditingId(null); };

  const save = () => {
    if (!form.title.trim() || !form.date) return;
    if (editingId === 'new') setProperty('propertyMaintenance', [...propertyMaintenance, form]);
    else setProperty('propertyMaintenance', propertyMaintenance.map(r => r.id === form.id ? form : r));
    close();
  };

  const deleteRecord = (id) => {
    if (!confirm('Delete this maintenance record?')) return;
    setProperty('propertyMaintenance', propertyMaintenance.filter(r => r.id !== id));
  };

  if (!selProp && propScope === 'current') {
    return (
      <div className="page-content">
        <EmptyState
          icon={<Icon name="tool" size={38} />}
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
          <Icon name="plus" size={14} /> Log Work
        </button>
      </div>

      {/* Filters */}
      <Card variant="section" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="form-section-label" style={{ minWidth: 70 }}>Category</span>
            <div className="filter-tabs">
              {['All', ...CATEGORIES].map(c => (
                <button key={c} className={`filter-tab ${filterCat === c ? 'active' : ''}`} onClick={() => setFilterCat(c)}>{c}</button>
              ))}
            </div>
          </div>
          {areas.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="form-section-label" style={{ minWidth: 70 }}>Area</span>
              <div className="filter-tabs">
                {[{ id: 'All', name: 'All' }, ...areas].map(a => (
                  <button key={a.id} className={`filter-tab ${filterArea === a.id ? 'active' : ''}`} onClick={() => setFilterArea(a.id)}>{a.name}</button>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="form-section-label" style={{ minWidth: 70 }}>Search</span>
            <input
              className="input small"
              style={{ width: 240 }}
              placeholder="Search title or description…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {records.length === 0 ? (
        <EmptyState
          icon={<Icon name="tool" size={38} />}
          title={propertyMaintenance.length === 0
            ? 'No maintenance records yet. Log your first piece of work to start building a history.'
            : 'No records match the current filters.'}
          action={selProp && <button className="btn-primary" onClick={openNew}><Icon name="plus" size={14} /> Log Work</button>}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {groups.map(({ month, items }) => (
            <div key={month}>
              <div className="section-subheader" style={{ marginBottom: 8 }}>
                <span>{fmtMonth(month)}</span>
              </div>
              <div className="fn-list">
                {items.map(rec => {
                  const propAreas = (properties.find(p => p.id === rec.propertyId)?.areas || []);
                  const area      = propAreas.find(a => a.id === rec.areaId);
                  const asset     = propertyAssets.find(a => a.id === rec.assetId);
                  const property  = properties.find(p => p.id === rec.propertyId);
                  const byLabel   = rec.performedBy === 'Other' ? (rec.performedByCustom || 'Other') : rec.performedBy;
                  return (
                    <div key={rec.id} className="fn-row">
                      <div className="fn-main" style={{ cursor: 'default' }}>
                        <div className="fn-left">
                          <div className="fn-dates">
                            <div className="fn-label" style={{ fontSize: 13, fontWeight: 500 }}>{rec.title}</div>
                            <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                              <span className="tag">{rec.category}</span>
                              {area  && <span className="tag teal">{area.name}</span>}
                              {asset && <span className="tag amber">{asset.name}</span>}
                              {propScope === 'all' && property && <span className="tag">{property.name}</span>}
                              {byLabel && byLabel !== 'Self' && <span className="tag">{byLabel}</span>}
                            </div>
                            {rec.description && (
                              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, lineHeight: 1.5 }}>{rec.description}</div>
                            )}
                          </div>
                        </div>
                        <div className="fn-right" style={{ alignItems: 'flex-end', gap: 6 }}>
                          <span className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>{rec.date}</span>
                          <div className="exp-actions">
                            <button className="btn-icon small" onClick={() => openEdit(rec)}><Icon name="pencil" size={12} /></button>
                            <button className="btn-icon small danger" onClick={() => deleteRecord(rec.id)}><Icon name="trash" size={12} /></button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal ─────────────────────────────────────────────────────────── */}
      {showModal && (
        <Portal>
        <div className="modal-overlay" onClick={close}>
          <div className="modal wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId === 'new' ? 'Log Maintenance Work' : 'Edit Record'}</h3>
              <button className="btn-icon" onClick={close}><Icon name="close" size={14} /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group full">
                  <label>Title / Summary *</label>
                  <input className="input" placeholder="What was done?" value={form.title} onChange={e => setField('title', e.target.value)} autoFocus />
                </div>
                <div className="form-group">
                  <label>Date *</label>
                  <input className="input" type="date" value={form.date} onChange={e => setField('date', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select className="input" value={form.category} onChange={e => setField('category', e.target.value)}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Property</label>
                  <select className="input" value={form.propertyId} onChange={e => setField('propertyId', e.target.value)}>
                    <option value="">— Select —</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
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
                  <label>Who Performed Work</label>
                  <select className="input" value={form.performedBy} onChange={e => setField('performedBy', e.target.value)}>
                    {PERFORMED_BY.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                {form.performedBy === 'Other' && (
                  <div className="form-group">
                    <label>Specify</label>
                    <input className="input" placeholder="e.g. John Smith Plumbing" value={form.performedByCustom} onChange={e => setField('performedByCustom', e.target.value)} />
                  </div>
                )}
                {propAssets.length > 0 && (
                  <div className="form-group">
                    <label>Asset / Appliance</label>
                    <select className="input" value={form.assetId} onChange={e => setField('assetId', e.target.value)}>
                      <option value="">— None —</option>
                      {propAssets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                )}
                {propTasks.length > 0 && (
                  <div className="form-group">
                    <label>Linked Task</label>
                    <select className="input" value={form.linkedTaskId} onChange={e => setField('linkedTaskId', e.target.value)}>
                      <option value="">— None —</option>
                      {propTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                    </select>
                  </div>
                )}
                <div className="form-group full">
                  <label>Description</label>
                  <textarea className="input" rows={3} style={{ resize: 'vertical' }} placeholder="What was found, what was done, any observations…" value={form.description} onChange={e => setField('description', e.target.value)} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={close}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={!form.title.trim() || !form.date}>
                {editingId === 'new' ? 'Log Record' : 'Save'}
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
}

import { useState, useMemo } from 'react';
import { useApp } from '../../store';
import Icon from '../../components/Icon';
import Portal from '../../components/Portal';

function uid() { return Math.random().toString(36).slice(2, 9); }
function today() { return new Date().toISOString().slice(0, 10); }

const PROJECT_STATUSES = ['Idea', 'Planning', 'In Progress', 'On Hold', 'Completed', 'Cancelled'];
const PRIORITIES       = ['Urgent', 'High', 'Medium', 'Low'];

const STATUS_DPILL = {
  'Idea':        '',
  'Planning':    'teal',
  'In Progress': 'amber',
  'On Hold':     'purple',
  'Completed':   'green',
  'Cancelled':   '',
};

const PRIORITY_DPILL = { Urgent: 'red', High: 'amber', Medium: 'teal', Low: '' };
const PRIORITY_COLOR = { Urgent: 'var(--red)', High: 'var(--amber)', Medium: 'var(--teal)', Low: 'var(--text3)' };

const STATUS_ORDER = ['In Progress', 'Planning', 'Idea', 'On Hold', 'Completed', 'Cancelled'];

const EMPTY_PROJ = {
  id: '', propertyId: '', title: '', description: '',
  status: 'Planning', priority: 'Medium',
  targetStart: '', targetEnd: '', actualCompletion: '',
  areas: [], taskIds: [],
  notes: [],
  createdAt: '',
};

function ProjectRow({ proj, property, propertyTasks, onEdit, onDelete, onStatusChange }) {
  const [expanded, setExpanded] = useState(false);
  const [noteText, setNoteText] = useState('');
  const { set, state } = useApp();
  const { propertyProjects = [] } = state;

  const linkedTasks = propertyTasks.filter(t => proj.taskIds.includes(t.id));
  const projAreas   = (property?.areas || []).filter(a => proj.areas.includes(a.id));

  const addNote = () => {
    if (!noteText.trim()) return;
    const updated = {
      ...proj,
      notes: [...(proj.notes || []), { id: uid(), date: today(), text: noteText.trim() }],
    };
    set('propertyProjects', propertyProjects.map(p => p.id === proj.id ? updated : p));
    setNoteText('');
  };

  return (
    <div className="fn-row">
      <div className="fn-main" style={{ cursor: 'default' }} onClick={() => setExpanded(e => !e)}>
        <div className="fn-left">
          <div className="fn-dates">
            <div className="fn-label" style={{ fontSize: 13, fontWeight: 500 }}>{proj.title}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              <span className={`dpill ${STATUS_DPILL[proj.status] || ''}`}
                style={!STATUS_DPILL[proj.status] ? { color: 'var(--text3)', background: 'var(--card2)' } : {}}
              >{proj.status}</span>
              <span className={`dpill ${PRIORITY_DPILL[proj.priority] || ''}`}
                style={!PRIORITY_DPILL[proj.priority] ? { color: 'var(--text3)' } : {}}
              >{proj.priority}</span>
              {projAreas.map(a => <span key={a.id} className="tag teal">{a.name}</span>)}
              {linkedTasks.length > 0 && (
                <span className="tag">{linkedTasks.length} task{linkedTasks.length !== 1 ? 's' : ''}</span>
              )}
              {proj.notes?.length > 0 && (
                <span className="tag">{proj.notes.length} note{proj.notes.length !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>
        </div>
        <div className="fn-right" style={{ alignItems: 'flex-end', gap: 6 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
            {proj.targetEnd && (
              <span className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>Target {proj.targetEnd}</span>
            )}
            {proj.actualCompletion && (
              <span className="mono" style={{ fontSize: 11, color: 'var(--green)' }}>Done {proj.actualCompletion}</span>
            )}
          </div>
          <div className="exp-actions">
            <button className="btn-icon small" title="Advance status" onClick={e => { e.stopPropagation(); onStatusChange(proj); }}>
              <Icon name="chevronD" size={12} />
            </button>
            <button className="btn-icon small" onClick={e => { e.stopPropagation(); onEdit(proj); }}>
              <Icon name="pencil" size={12} />
            </button>
            <button className="btn-icon small danger" onClick={e => { e.stopPropagation(); onDelete(proj.id); }}>
              <Icon name="trash" size={12} />
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="exp-detail" style={{ paddingBottom: 12 }}>
          {proj.description && (
            <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.55, marginBottom: 12 }}>{proj.description}</p>
          )}

          {linkedTasks.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div className="form-section-label" style={{ marginBottom: 6 }}>Linked Tasks</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {linkedTasks.map(t => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text2)' }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: t.status === 'Done' ? 'var(--green)' : PRIORITY_COLOR[t.priority] || 'var(--text3)',
                    }} />
                    <span style={{ textDecoration: t.status === 'Done' ? 'line-through' : 'none', flex: 1 }}>{t.title}</span>
                    <span className="tag" style={{ fontSize: 10 }}>{t.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes log */}
          {(proj.notes?.length > 0 || true) && (
            <div>
              <div className="form-section-label" style={{ marginBottom: 6 }}>Notes</div>
              {proj.notes?.length > 0 && (
                <div className="change-history" style={{ marginBottom: 8 }}>
                  {[...(proj.notes || [])].reverse().map(n => (
                    <div key={n.id} className="ch-row">
                      <span className="ch-date mono">{n.date}</span>
                      <span className="ch-text">{n.text}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input small"
                  style={{ flex: 1 }}
                  placeholder="Add a planning note or decision…"
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addNote(); }}
                  onClick={e => e.stopPropagation()}
                />
                <button className="btn-ghost small" onClick={e => { e.stopPropagation(); addNote(); }} disabled={!noteText.trim()}>Add</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PropertyProjects() {
  const { state, set } = useApp();
  const {
    properties = [],
    propertyProjects = [],
    propertyTasks = [],
    selectedPropertyId,
  } = state;

  const selProp = properties.find(p => p.id === selectedPropertyId) || null;

  const [showModal,    setShowModal]    = useState(false);
  const [form,         setForm]         = useState(EMPTY_PROJ);
  const [editingId,    setEditingId]    = useState(null);
  const [filterStatus, setFilterStatus] = useState('All');
  const [propScope,    setPropScope]    = useState('current');
  const [activeTab,    setActiveTab]    = useState('info');
  const [noteText,     setNoteText]     = useState('');

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const visibleProjs = useMemo(() => {
    let list = propertyProjects;
    if (propScope === 'current' && selectedPropertyId) {
      list = list.filter(p => p.propertyId === selectedPropertyId);
    }
    if (filterStatus !== 'All') list = list.filter(p => p.status === filterStatus);
    return [...list].sort((a, b) =>
      STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
    );
  }, [propertyProjects, propScope, selectedPropertyId, filterStatus]);

  const groupedByStatus = useMemo(() => {
    const groups = {};
    for (const proj of visibleProjs) {
      if (!groups[proj.status]) groups[proj.status] = [];
      groups[proj.status].push(proj);
    }
    return STATUS_ORDER.filter(s => groups[s]?.length > 0).map(s => ({ status: s, items: groups[s] }));
  }, [visibleProjs]);

  const propTasks = selProp ? propertyTasks.filter(t => t.propertyId === selProp.id) : [];

  const openNew = () => {
    setForm({ ...EMPTY_PROJ, id: uid(), propertyId: selectedPropertyId || '', createdAt: today() });
    setEditingId('new'); setActiveTab('info'); setNoteText(''); setShowModal(true);
  };

  const openEdit = (proj) => {
    setForm({ ...EMPTY_PROJ, ...proj, notes: proj.notes || [], taskIds: proj.taskIds || [], areas: proj.areas || [] });
    setEditingId(proj.id); setActiveTab('info'); setNoteText(''); setShowModal(true);
  };

  const close = () => { setShowModal(false); setForm(EMPTY_PROJ); setEditingId(null); setNoteText(''); };

  const addNoteToForm = () => {
    if (!noteText.trim()) return;
    setForm(f => ({ ...f, notes: [...(f.notes || []), { id: uid(), date: today(), text: noteText.trim() }] }));
    setNoteText('');
  };

  const save = () => {
    if (!form.title.trim()) return;
    const proj = { ...form };
    if (proj.status === 'Completed' && !proj.actualCompletion) proj.actualCompletion = today();
    if (editingId === 'new') set('propertyProjects', [...propertyProjects, proj]);
    else set('propertyProjects', propertyProjects.map(p => p.id === proj.id ? proj : p));
    close();
  };

  const deleteProject = (id) => {
    if (!confirm('Delete this project?')) return;
    set('propertyProjects', propertyProjects.filter(p => p.id !== id));
  };

  const cycleStatus = (proj) => {
    const active = ['Idea', 'Planning', 'In Progress', 'On Hold', 'Completed'];
    const next = active[(active.indexOf(proj.status) + 1) % active.length];
    const updates = { status: next };
    if (next === 'Completed') updates.actualCompletion = today();
    set('propertyProjects', propertyProjects.map(p => p.id === proj.id ? { ...p, ...updates } : p));
  };

  const toggleTaskLink = (taskId) => {
    setForm(f => ({
      ...f,
      taskIds: f.taskIds.includes(taskId) ? f.taskIds.filter(id => id !== taskId) : [...f.taskIds, taskId],
    }));
  };

  const toggleAreaLink = (areaId) => {
    setForm(f => ({
      ...f,
      areas: f.areas.includes(areaId) ? f.areas.filter(id => id !== areaId) : [...f.areas, areaId],
    }));
  };

  if (!selProp && propScope === 'current') {
    return (
      <div className="page-content">
        <div className="page-header"><div className="page-title">Projects</div></div>
        <div className="empty-state">
          <div className="es-icon"><Icon name="layers" size={38} /></div>
          <div className="es-text">Select a property from the Overview or Properties tab first.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <div className="page-title">Improvement Projects</div>
          <div className="page-sub">
            {selProp ? selProp.name : 'All properties'} · {visibleProjs.length} project{visibleProjs.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {properties.length > 1 && (
            <div className="exp-type-sel">
              <button className={`ets-btn ${propScope === 'current' ? 'active' : ''}`} onClick={() => setPropScope('current')}>This property</button>
              <button className={`ets-btn ${propScope === 'all' ? 'active' : ''}`} onClick={() => setPropScope('all')}>All</button>
            </div>
          )}
          <button className="btn-primary" onClick={openNew} disabled={!selProp}>
            <Icon name="plus" size={14} /> Add Project
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="dash-section" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="form-section-label" style={{ minWidth: 70 }}>Status</span>
          <div className="filter-tabs">
            {['All', ...PROJECT_STATUSES].map(s => (
              <button key={s} className={`filter-tab ${filterStatus === s ? 'active' : ''}`} onClick={() => setFilterStatus(s)}>{s}</button>
            ))}
          </div>
        </div>
      </div>

      {visibleProjs.length === 0 ? (
        <div className="empty-state">
          <div className="es-icon"><Icon name="layers" size={38} /></div>
          <div className="es-text">
            {propertyProjects.length === 0
              ? 'No projects yet. Plan your first improvement project.'
              : 'No projects match the current filters.'}
          </div>
          {selProp && <button className="btn-primary" onClick={openNew}><Icon name="plus" size={14} /> Add Project</button>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {groupedByStatus.map(({ status, items }) => (
            <div key={status}>
              <div className="section-subheader" style={{ marginBottom: 8 }}>
                <span className={`dpill ${STATUS_DPILL[status] || ''}`}
                  style={!STATUS_DPILL[status] ? { color: 'var(--text3)', background: 'var(--card2)' } : {}}
                >{status}</span>
                <span style={{ color: 'var(--text3)', fontSize: 11 }}>{items.length} project{items.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="fn-list">
                {items.map(proj => {
                  const property = properties.find(p => p.id === proj.propertyId);
                  return (
                    <ProjectRow
                      key={proj.id}
                      proj={proj}
                      property={property}
                      propertyTasks={propertyTasks.filter(t => t.propertyId === proj.propertyId)}
                      onEdit={openEdit}
                      onDelete={deleteProject}
                      onStatusChange={cycleStatus}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal ──────────────────────────────────────────────────────────── */}
      {showModal && (
        <Portal>
        <div className="modal-overlay" onClick={close}>
          <div className="modal wide" style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId === 'new' ? 'Add Project' : 'Edit Project'}</h3>
              <button className="btn-icon" onClick={close}><Icon name="close" size={14} /></button>
            </div>

            <div className="prop-modal-tabs">
              {['info', 'tasks', 'notes'].map(t => (
                <button key={t} className={`pmt-btn ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                  {t === 'notes' && form.notes?.length > 0 && ` (${form.notes.length})`}
                  {t === 'tasks' && form.taskIds?.length > 0 && ` (${form.taskIds.length})`}
                </button>
              ))}
            </div>

            <div className="modal-body">
              {activeTab === 'info' && (
                <div className="form-grid">
                  <div className="form-group full">
                    <label>Title *</label>
                    <input className="input" placeholder="e.g. Bathroom Renovation" value={form.title} onChange={e => setField('title', e.target.value)} autoFocus />
                  </div>
                  <div className="form-group">
                    <label>Property</label>
                    <select className="input" value={form.propertyId} onChange={e => setField('propertyId', e.target.value)}>
                      <option value="">— Select —</option>
                      {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select className="input" value={form.status} onChange={e => setField('status', e.target.value)}>
                      {PROJECT_STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Priority</label>
                    <select className="input" value={form.priority} onChange={e => setField('priority', e.target.value)}>
                      {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Target Start</label>
                    <input className="input" type="date" value={form.targetStart} onChange={e => setField('targetStart', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Target Completion</label>
                    <input className="input" type="date" value={form.targetEnd} onChange={e => setField('targetEnd', e.target.value)} />
                  </div>
                  {form.status === 'Completed' && (
                    <div className="form-group">
                      <label>Actual Completion</label>
                      <input className="input" type="date" value={form.actualCompletion} onChange={e => setField('actualCompletion', e.target.value)} />
                    </div>
                  )}
                  <div className="form-group full">
                    <label>Description</label>
                    <textarea className="input" rows={3} style={{ resize: 'vertical' }} value={form.description} onChange={e => setField('description', e.target.value)} />
                  </div>
                  {(properties.find(p => p.id === form.propertyId)?.areas || []).length > 0 && (
                    <div className="form-group full">
                      <label>Areas</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {(properties.find(p => p.id === form.propertyId)?.areas || []).map(a => (
                          <button
                            key={a.id}
                            className={`filter-tab ${form.areas.includes(a.id) ? 'active' : ''}`}
                            onClick={() => toggleAreaLink(a.id)}
                          >
                            {a.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'tasks' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
                    Link existing tasks from this property to this project.
                  </p>
                  {propTasks.filter(t => t.status !== 'Cancelled').length === 0 ? (
                    <p style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>No tasks available to link.</p>
                  ) : (
                    propTasks.filter(t => t.status !== 'Cancelled').map(t => (
                      <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                        <input
                          type="checkbox"
                          checked={form.taskIds.includes(t.id)}
                          onChange={() => toggleTaskLink(t.id)}
                        />
                        <span style={{ flex: 1, textDecoration: t.status === 'Done' ? 'line-through' : 'none', color: t.status === 'Done' ? 'var(--text3)' : 'inherit' }}>{t.title}</span>
                        <span className="tag" style={{ fontSize: 10 }}>{t.status}</span>
                      </label>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'notes' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      className="input"
                      style={{ flex: 1 }}
                      placeholder="Add a planning note, decision, or update…"
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') addNoteToForm(); }}
                    />
                    <button className="btn-ghost small" onClick={addNoteToForm} disabled={!noteText.trim()}>Add</button>
                  </div>
                  {(form.notes || []).length === 0 ? (
                    <p style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>No notes yet.</p>
                  ) : (
                    <div className="change-history">
                      {[...(form.notes || [])].reverse().map(n => (
                        <div key={n.id} className="ch-row">
                          <span className="ch-date mono">{n.date}</span>
                          <span className="ch-text" style={{ flex: 1 }}>{n.text}</span>
                          <button className="btn-icon small danger" onClick={() => setForm(f => ({ ...f, notes: f.notes.filter(x => x.id !== n.id) }))}>
                            <Icon name="close" size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-ghost" onClick={close}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={!form.title.trim()}>
                {editingId === 'new' ? 'Add Project' : 'Save'}
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
}

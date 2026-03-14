import { useState, useEffect, useMemo, useCallback, memo, Fragment } from 'react';
import { useProperty } from '../../store/hooks';
import Icon from '../../components/Icon';
import { EmptyState, Card, SectionHeader, StatTile, Modal, ExpandableRow, ActiveChip, ConfirmDialog } from '../../components/ui';
import {
  createPropertyProject,
  PROJECT_STATUSES, PROJECT_PRIORITIES, STATUS_DPILL,
} from '../../models/PropertyProject';
import { PRIORITY_DPILL, PRIORITY_BAR, PRIORITY_COLOR } from '../../utils/colors';
import { today } from '../../utils/finance/dates';

const STATUS_ORDER = ['In Progress', 'Planning', 'Idea', 'On Hold', 'Completed', 'Cancelled'];

const EMPTY_PROJ = createPropertyProject();

const PRIORITY_ORDER = { Urgent: 0, High: 1, Medium: 2, Low: 3 };

const SORT_FN = {
  priority:  (a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9),
  title:     (a, b) => a.title.localeCompare(b.title),
  targetEnd: (a, b) => {
    if (a.targetEnd && b.targetEnd) return a.targetEnd.localeCompare(b.targetEnd);
    return a.targetEnd ? -1 : 1;
  },
};

// ── ProjectRow ────────────────────────────────────────────────────────────────

const ProjectRow = memo(function ProjectRow({ proj, property, propertyTasks, onEdit, onDelete, onStatusChange, onAddNote }) {
  const [noteText, setNoteText] = useState('');

  const linkedTasks = propertyTasks.filter(t => proj.taskIds.includes(t.id));
  const projAreas   = (property?.areas || []).filter(a => proj.areas.includes(a.id));

  const hasDetail = !!(proj.description || linkedTasks.length > 0 || proj.notes?.length > 0);

  const submitNote = () => {
    if (!noteText.trim()) return;
    onAddNote(proj.id, noteText.trim());
    setNoteText('');
  };

  // Target date label: show actual completion for done projects, target end otherwise
  const dateLabel = proj.status === 'Completed' && proj.actualCompletion
    ? proj.actualCompletion
    : proj.targetEnd || null;
  const dateColor = proj.status === 'Completed' ? 'var(--green)' : 'var(--text3)';

  return (
    <ExpandableRow
      className="expense-row"
      summary={(expanded) => (
        <>
          <div className="exp-cat-bar" style={{ background: PRIORITY_BAR[proj.priority] || 'var(--sep2)' }} />
          <div className="exp-main">
            <div className="exp-top">
              <div className="exp-info">
                <span className="exp-name">{proj.title}</span>
                {projAreas.length > 0 && (
                  <span className="exp-tags">
                    {projAreas.map(a => <span key={a.id} className="tag teal">{a.name}</span>)}
                  </span>
                )}
                {!expanded && proj.description && (
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {proj.description}
                  </span>
                )}
              </div>
              <div className="exp-right">
                <div className="exp-amounts">
                  {dateLabel && (
                    <span className="exp-amount" style={{ fontSize: 12, color: dateColor }}>{dateLabel}</span>
                  )}
                  <span
                    className={`dpill ${PRIORITY_DPILL[proj.priority] || ''}`}
                    style={!PRIORITY_DPILL[proj.priority] ? { color: 'var(--text3)' } : {}}
                  >{proj.priority}</span>
                </div>
                <div className="exp-actions" onClick={e => e.stopPropagation()}>
                  <button className="btn-icon" title="Advance status" aria-label="Advance status" onClick={() => onStatusChange(proj)}>
                    <Icon name="chevronD" size={13} />
                  </button>
                  <button className="btn-icon" onClick={() => onEdit(proj)} aria-label="Edit project">
                    <Icon name="pencil" />
                  </button>
                  <button className="btn-icon danger" onClick={() => onDelete(proj.id)} aria-label="Delete project">
                    <Icon name="trash" />
                  </button>
                </div>
              </div>
            </div>

            {expanded && hasDetail && (
              <div className="exp-detail" onClick={e => e.stopPropagation()}>
                {proj.description && (
                  <div className="exp-detail-notes" style={{ marginBottom: 'var(--space-3)' }}>{proj.description}</div>
                )}

                {linkedTasks.length > 0 && (
                  <div style={{ marginBottom: 'var(--space-3)' }}>
                    <div className="ch-label">Linked Tasks</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
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

                {proj.notes?.length > 0 && (
                  <div className="change-history" style={{ marginBottom: 'var(--space-2)' }}>
                    <div className="ch-label">Notes</div>
                    {[...(proj.notes || [])].reverse().map(n => (
                      <div key={n.id} className="ch-row">
                        <span className="ch-date">{n.date}</span>
                        <span style={{ color: 'var(--text2)' }}>{n.text}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-2)' }}>
                  <input
                    className="input small"
                    style={{ flex: 1 }}
                    placeholder="Add a planning note or decision…"
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') submitNote(); }}
                  />
                  <button className="btn-ghost small" onClick={submitNote} disabled={!noteText.trim()}>Add</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    />
  );
});

// ── Main component ────────────────────────────────────────────────────────────

export default function PropertyProjects() {
  const { properties, propertyProjects, propertyTasks, selectedPropertyId, setProperty } = useProperty();

  // ── Filters ────────────────────────────────────────────────────────────────
  const [filterSearch, setFilterSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterArea,   setFilterArea]   = useState('All');
  const [sortBy,       setSortBy]       = useState('priority');

  // ── Modal ──────────────────────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [form,      setForm]      = useState(EMPTY_PROJ);
  const [editingId, setEditingId] = useState(null);
  const [activeTab, setActiveTab] = useState('info');
  const [noteText,  setNoteText]  = useState('');
  const [confirmTarget, setConfirmTarget] = useState(null);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const selProp    = properties.find(p => p.id === selectedPropertyId) || null;
  const areas      = selProp?.areas || [];
  const scopeLabel = selectedPropertyId === null ? 'All properties' : (selProp?.name ?? 'No property selected');

  // Reset area filter when property changes
  useEffect(() => { setFilterArea('All'); }, [selectedPropertyId]);

  // ── Snapshot ───────────────────────────────────────────────────────────────
  const snap = useMemo(() => {
    const scoped = selectedPropertyId === null
      ? propertyProjects
      : propertyProjects.filter(p => p.propertyId === selectedPropertyId);
    return {
      total:      scoped.length,
      active:     scoped.filter(p => !['Completed', 'Cancelled'].includes(p.status)).length,
      inProgress: scoped.filter(p => p.status === 'In Progress').length,
      onHold:     scoped.filter(p => p.status === 'On Hold').length,
      completed:  scoped.filter(p => p.status === 'Completed').length,
    };
  }, [propertyProjects, selectedPropertyId]);

  // ── Filtered + grouped ─────────────────────────────────────────────────────
  const visible = useMemo(() => {
    let list = propertyProjects;
    if (selectedPropertyId) list = list.filter(p => p.propertyId === selectedPropertyId);
    if (filterSearch)            list = list.filter(p => p.title.toLowerCase().includes(filterSearch.toLowerCase()));
    if (filterStatus !== 'All') list = list.filter(p => p.status === filterStatus);
    if (filterArea   !== 'All') list = list.filter(p => p.areas.includes(filterArea));
    return list;
  }, [propertyProjects, selectedPropertyId, filterSearch, filterStatus, filterArea]);

  const grouped = useMemo(() => {
    const groups = {};
    for (const proj of visible) {
      if (!groups[proj.status]) groups[proj.status] = [];
      groups[proj.status].push(proj);
    }
    const sortFn = SORT_FN[sortBy] ?? SORT_FN.priority;
    return STATUS_ORDER
      .filter(s => groups[s]?.length > 0)
      .map(s => ({ status: s, items: [...groups[s]].sort(sortFn) }));
  }, [visible, sortBy]);

  const isFiltered = !!(filterSearch || filterStatus !== 'All' || filterArea !== 'All');

  const clearAllFilters = () => {
    setFilterSearch(''); setFilterStatus('All'); setFilterArea('All');
  };

  // ── Modal helpers ──────────────────────────────────────────────────────────
  const propTasks = selProp ? propertyTasks.filter(t => t.propertyId === selProp.id) : [];

  const openNew = () => {
    setForm({ ...EMPTY_PROJ, id: crypto.randomUUID(), propertyId: selectedPropertyId || '', createdAt: today() });
    setEditingId('new'); setActiveTab('info'); setNoteText(''); setShowModal(true);
  };

  const openEdit = useCallback((proj) => {
    setForm({ ...EMPTY_PROJ, ...proj, notes: proj.notes || [], taskIds: proj.taskIds || [], areas: proj.areas || [] });
    setEditingId(proj.id); setActiveTab('info'); setNoteText(''); setShowModal(true);
  }, []);

  const close = () => { setShowModal(false); setForm(EMPTY_PROJ); setEditingId(null); setNoteText(''); };

  const addNoteToForm = () => {
    if (!noteText.trim()) return;
    setForm(f => ({ ...f, notes: [...(f.notes || []), { id: crypto.randomUUID(), date: today(), text: noteText.trim() }] }));
    setNoteText('');
  };

  const save = () => {
    if (!form.title.trim()) return;
    const proj = { ...form };
    if (proj.status === 'Completed' && !proj.actualCompletion) proj.actualCompletion = today();
    if (editingId === 'new') setProperty('propertyProjects', [...propertyProjects, proj]);
    else setProperty('propertyProjects', propertyProjects.map(p => p.id === proj.id ? proj : p));
    close();
  };

  const deleteProject = useCallback((id) => setConfirmTarget(id), []);
  const executeDeleteProject = () => {
    setProperty('propertyProjects', propertyProjects.filter(p => p.id !== confirmTarget));
    setConfirmTarget(null);
  };

  const cycleStatus = useCallback((proj) => {
    const active = ['Idea', 'Planning', 'In Progress', 'On Hold', 'Completed'];
    const next = active[(active.indexOf(proj.status) + 1) % active.length];
    const updates = { status: next };
    if (next === 'Completed') updates.actualCompletion = today();
    setProperty('propertyProjects', propertyProjects.map(p => p.id === proj.id ? { ...p, ...updates } : p));
  }, [propertyProjects, setProperty]);

  const addNote = useCallback((projId, text) => {
    setProperty('propertyProjects', propertyProjects.map(p =>
      p.id === projId
        ? { ...p, notes: [...(p.notes || []), { id: crypto.randomUUID(), date: today(), text }] }
        : p
    ));
  }, [propertyProjects, setProperty]);

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

  // ── Render ─────────────────────────────────────────────────────────────────
  if (properties.length === 0) {
    return (
      <div className="page-content">
        <EmptyState
          icon={<Icon name="layers" size={38} />}
          title="No properties yet. Add a property first to start tracking projects."
        />
      </div>
    );
  }

  return (
    <div className="page-content">

      {/* ── 1. Project snapshot ──────────────────────────────────────────── */}
      <Card variant="section">
        <SectionHeader
          title={<><Icon name="layers" size={15} /> Project Snapshot</>}
          subtitle={scopeLabel}
        />
        <div className="fn-summary">
          <StatTile label="Total"       value={snap.total}      valueClassName={snap.total > 0 ? '' : 'text3'} />
          <StatTile label="Active"      value={snap.active}     valueClassName={snap.active > 0 ? '' : 'text3'} meta="not completed" />
          <StatTile label="In Progress" value={snap.inProgress} valueClassName={snap.inProgress > 0 ? 'amber' : 'text3'} />
          <StatTile label="On Hold"     value={snap.onHold}     valueClassName={snap.onHold > 0 ? 'purple' : 'text3'} />
          <StatTile label="Completed"   value={snap.completed}  valueClassName={snap.completed > 0 ? 'green' : 'text3'} />
        </div>
      </Card>

      {/* ── 3. Filters ───────────────────────────────────────────────────── */}
      <Card variant="section">
        <SectionHeader title={<><Icon name="filter" size={15} /> Filters</>} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="input small"
            style={{ flex: '1 1 160px', minWidth: 140 }}
            placeholder="Search projects…"
            value={filterSearch}
            onChange={e => setFilterSearch(e.target.value)}
          />
          <select className="input small" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="All">All statuses</option>
            {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {selectedPropertyId !== null && areas.length > 0 && (
            <select className="input small" value={filterArea} onChange={e => setFilterArea(e.target.value)}>
              <option value="All">All areas</option>
              {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          <select className="input small" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="priority">Sort: Priority</option>
            <option value="title">Sort: Title</option>
            <option value="targetEnd">Sort: Target date</option>
          </select>
        </div>
        {isFiltered && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 'var(--space-3)' }}>
            <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>Active:</span>
            {filterSearch            && <ActiveChip label={`"${filterSearch}"`}                                       onClear={() => setFilterSearch('')} />}
            {filterStatus !== 'All'  && <ActiveChip label={filterStatus}                                              onClear={() => setFilterStatus('All')} />}
            {filterArea   !== 'All'  && <ActiveChip label={areas.find(a => a.id === filterArea)?.name ?? filterArea}  onClear={() => setFilterArea('All')} />}
            <button className="btn-ghost small" onClick={clearAllFilters} style={{ fontSize: 11, padding: '2px 8px' }}>Clear all</button>
          </div>
        )}
      </Card>

      {/* ── 4. Project list ──────────────────────────────────────────────── */}
      <Card variant="section">
        <SectionHeader
          title={<><Icon name="layers" size={15} /> Projects</>}
          subtitle={`${visible.length} project${visible.length !== 1 ? 's' : ''}${isFiltered ? ' (filtered)' : ''}`}
          actions={
            <button className="btn-ghost small" onClick={openNew} disabled={!selProp && selectedPropertyId !== null}>
              <Icon name="plus" size={14} /> Add Project
            </button>
          }
        />
        {grouped.length === 0 ? (
          <EmptyState
            icon={<Icon name="layers" size={38} />}
            title={
              !selProp && selectedPropertyId !== null
                ? 'Select a property above to view its projects.'
                : propertyProjects.length === 0
                ? 'No projects yet. Plan your first improvement project.'
                : 'No projects match the current filters.'
            }
            action={selProp && <button className="btn-ghost" onClick={openNew}><Icon name="plus" size={14} /> Add Project</button>}
          />
        ) : (
          grouped.map(({ status, items }, gi) => (
            <Fragment key={status}>
              <div className="section-subheader" style={{ marginTop: gi === 0 ? 4 : undefined }}>
                <span
                  className={`dpill ${STATUS_DPILL[status] || ''}`}
                  style={!STATUS_DPILL[status] ? { color: 'var(--text3)', background: 'var(--card2)' } : {}}
                >{status}</span>
                <span style={{ color: 'var(--text3)', fontSize: 11 }}>{items.length} project{items.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="expense-list">
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
                      onAddNote={addNote}
                    />
                  );
                })}
              </div>
            </Fragment>
          ))
        )}
      </Card>

      {/* ── Modal ─────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={showModal}
        onClose={close}
        title={editingId === 'new' ? 'Add Project' : 'Edit Project'}
        wide
        footer={
          <>
            <button className="btn-ghost" onClick={close}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={!form.title.trim()}>
              {editingId === 'new' ? 'Add Project' : 'Save'}
            </button>
          </>
        }
      >
        <div className="filter-tabs" style={{ marginBottom: 'var(--space-3)' }}>
          {['info', 'tasks', 'notes'].map(t => (
            <button key={t} className={`filter-tab ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
              {t === 'notes' && form.notes?.length > 0 && ` (${form.notes.length})`}
              {t === 'tasks' && form.taskIds?.length > 0 && ` (${form.taskIds.length})`}
            </button>
          ))}
        </div>

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
                {PROJECT_PRIORITIES.map(p => <option key={p}>{p}</option>)}
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
            {(() => {
              const formPropAreas = properties.find(p => p.id === form.propertyId)?.areas || [];
              return formPropAreas.length > 0 && (
                <div className="form-group full">
                  <label>Areas</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {formPropAreas.map(a => (
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
              );
            })()}
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
                    <span className="ch-date">{n.date}</span>
                    <span className="ch-text" style={{ flex: 1 }}>{n.text}</span>
                    <button className="btn-icon small danger" onClick={() => setForm(f => ({ ...f, notes: f.notes.filter(x => x.id !== n.id) }))} aria-label="Delete note">
                      <Icon name="close" size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmTarget}
        title="Delete project"
        message="Delete this project?"
        onConfirm={executeDeleteProject}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}

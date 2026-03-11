import { useState, useMemo } from 'react';
import { useApp } from '../../store';
import Icon from '../../components/Icon';
import {
  createPropertyTask,
  TASK_CATEGORIES, TASK_PRIORITIES, TASK_STATUSES, TASK_EFFORTS, RECUR_UNITS,
  PRIORITY_PILL, STATUS_NEXT,
} from '../../models/PropertyTask';
import { getTaskDependents, cascadeDeleteTask, taskDeleteMessage } from '../../utils/cascade';
import { validate, propertyTaskSchema } from '../../utils/validation';

function uid() { return Math.random().toString(36).slice(2, 9); }
function today() { return new Date().toISOString().slice(0, 10); }

const CATEGORIES     = TASK_CATEGORIES;
const PRIORITIES     = TASK_PRIORITIES;
const STATUSES       = TASK_STATUSES;
const EFFORTS        = TASK_EFFORTS;
const PRIORITY_DPILL = PRIORITY_PILL;
// Visual colour bar (UI-only, not in model)
const PRIORITY_BAR   = { Urgent: 'var(--red)', High: 'var(--amber)', Medium: 'var(--teal)', Low: 'var(--sep2)' };

const EMPTY_TASK = createPropertyTask();

function addInterval(dateStr, interval, unit) {
  const d = new Date(dateStr);
  if (unit === 'days')       d.setDate(d.getDate() + interval);
  if (unit === 'weeks')      d.setDate(d.getDate() + interval * 7);
  if (unit === 'fortnights') d.setDate(d.getDate() + interval * 14);
  if (unit === 'months')     d.setMonth(d.getMonth() + interval);
  if (unit === 'years')      d.setFullYear(d.getFullYear() + interval);
  return d.toISOString().slice(0, 10);
}

function TaskRow({ task, areas, propName, showProp, onEdit, onDelete, onStatusChange, onAddNote }) {
  const [open,     setOpen]     = useState(false);
  const [noteText, setNoteText] = useState('');
  const area    = areas.find(a => a.id === task.areaId);
  const isOverdue = task.dueDate && task.dueDate < today() && task.status !== 'Done' && task.status !== 'Cancelled';

  const submitNote = () => {
    if (!noteText.trim()) return;
    onAddNote(task.id, noteText.trim());
    setNoteText('');
  };

  return (
    <div key={task.id} className={`expense-row ${open ? 'expanded' : ''}`} onClick={() => setOpen(o => !o)}>
      <div className="exp-cat-bar" style={{ background: PRIORITY_BAR[task.priority] }} />
      <div className="exp-main">
        <div className="exp-top">
          <div className="exp-info">
            <span className={`exp-name ${task.status === 'Done' ? 'line-through' : ''}`}>{task.title}</span>
            <span className="exp-tags">
              <span className="tag">{task.status}</span>
              <span className="tag">{task.category}</span>
              {area && <span className="tag teal">{area.name}</span>}
              {task.effort && <span className="tag">{task.effort}</span>}
              {task.recurring && <span className="tag amber">Recurring</span>}
              {showProp && propName && <span className="tag">{propName}</span>}
              {isOverdue && <span className="dpill red">Overdue</span>}
              {task.notes?.length > 0 && <span className="tag">{task.notes.length} note{task.notes.length !== 1 ? 's' : ''}</span>}
            </span>
          </div>
          <div className="exp-right">
            <div className="exp-amounts">
              {task.dueDate && (
                <span className="exp-amount" style={{ fontSize: 12, color: isOverdue ? 'var(--red)' : 'var(--text3)', fontFamily: 'var(--mono)', fontWeight: 500 }}>
                  {task.dueDate}
                </span>
              )}
              {task.priority !== 'Low' && (
                <span className={`dpill ${PRIORITY_DPILL[task.priority]}`}>{task.priority}</span>
              )}
            </div>
            <div className="exp-actions" onClick={e => e.stopPropagation()}>
              <button
                className="btn-icon"
                title={`Mark as ${STATUS_NEXT[task.status]}`}
                onClick={() => onStatusChange(task)}
              >
                {task.status === 'Done'
                  ? <Icon name="check" size={13} />
                  : <Icon name="chevronD" size={13} />}
              </button>
              <button className="btn-icon" onClick={() => onEdit(task)}><Icon name="pencil" /></button>
              <button className="btn-icon danger" onClick={() => onDelete(task.id)}><Icon name="trash" /></button>
            </div>
          </div>
        </div>

        {open && (
          <div className="exp-detail" onClick={e => e.stopPropagation()}>
            {task.description && (
              <div className="exp-detail-notes">{task.description}</div>
            )}

            {(task.notes || []).length > 0 && (
              <div className="change-history" style={{ marginTop: task.description ? 8 : 0 }}>
                <div className="ch-label">Notes</div>
                {task.notes.map(n => (
                  <div key={n.id} className="ch-row">
                    <span className="ch-date">{n.date}</span>
                    <span style={{ color: 'var(--text2)' }}>{n.text}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input
                className="input small"
                style={{ flex: 1 }}
                placeholder="Add a progress note…"
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submitNote(); }}
              />
              <button className="btn-ghost small" onClick={submitNote} disabled={!noteText.trim()}>Add</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PropertyTasks() {
  const { state, set, cascadeDelete } = useApp();
  const { properties = [], propertyTasks = [], selectedPropertyId } = state;

  const selProp = properties.find(p => p.id === selectedPropertyId) || null;

  const [filterStatus,    setFilterStatus]    = useState('All');
  const [filterPriority,  setFilterPriority]  = useState('All');
  const [filterArea,      setFilterArea]      = useState('All');
  const [propScope,       setPropScope]       = useState('current');
  const [showModal,       setShowModal]       = useState(false);
  const [form,            setForm]            = useState(EMPTY_TASK);
  const [editingId,       setEditingId]       = useState(null);
  const [errors,          setErrors]          = useState({});
  const [recurEnabled,    setRecurEnabled]    = useState(false);
  const [recurInterval,   setRecurInterval]   = useState(6);
  const [recurUnit,       setRecurUnit]       = useState('months');

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const areas = selProp?.areas || [];

  const visible = useMemo(() => {
    let list = propertyTasks;
    if (propScope === 'current' && selectedPropertyId) list = list.filter(t => t.propertyId === selectedPropertyId);
    if (filterStatus   !== 'All') list = list.filter(t => t.status   === filterStatus);
    if (filterPriority !== 'All') list = list.filter(t => t.priority === filterPriority);
    if (filterArea     !== 'All') list = list.filter(t => t.areaId   === filterArea);
    const order = { Urgent: 0, High: 1, Medium: 2, Low: 3 };
    return list.sort((a, b) => {
      if (order[a.priority] !== order[b.priority]) return order[a.priority] - order[b.priority];
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      return a.dueDate ? -1 : 1;
    });
  }, [propertyTasks, propScope, selectedPropertyId, filterStatus, filterPriority, filterArea]);

  const overdueCount = visible.filter(t => t.dueDate && t.dueDate < today() && t.status !== 'Done' && t.status !== 'Cancelled').length;

  const openNew = () => {
    setForm({ ...EMPTY_TASK, id: uid(), propertyId: selectedPropertyId || '', createdAt: today() });
    setRecurEnabled(false); setRecurInterval(6); setRecurUnit('months');
    setErrors({}); setEditingId('new'); setShowModal(true);
  };

  const openEdit = (task) => {
    setForm({ ...EMPTY_TASK, ...task });
    setRecurEnabled(!!task.recurring);
    setRecurInterval(task.recurring?.interval || 6);
    setRecurUnit(task.recurring?.unit || 'months');
    setErrors({}); setEditingId(task.id); setShowModal(true);
  };

  const close = () => { setShowModal(false); setForm(EMPTY_TASK); setEditingId(null); setErrors({}); };

  const save = () => {
    const payload = {
      title:      form.title,
      propertyId: form.propertyId,
      ...(recurEnabled ? { recurInterval } : {}),
    };
    const { ok, errors: errs } = validate(propertyTaskSchema, payload);
    if (!ok) { setErrors(errs); return; }
    setErrors({});

    const taskData = { ...form, recurring: recurEnabled ? { interval: +recurInterval, unit: recurUnit } : null };
    if (editingId === 'new') set('propertyTasks', [...propertyTasks, taskData]);
    else set('propertyTasks', propertyTasks.map(t => t.id === taskData.id ? taskData : t));
    close();
  };

  const deleteTask = (id) => {
    const deps = getTaskDependents(state, id);
    if (!confirm(taskDeleteMessage(deps))) return;
    cascadeDelete(cascadeDeleteTask(state, id));
  };

  const cycleStatus = (task) => {
    const next = STATUS_NEXT[task.status] || 'To Do';
    let updated = propertyTasks.map(t => t.id === task.id ? { ...t, status: next } : t);
    if (next === 'Done' && task.recurring?.interval && task.dueDate) {
      const nextDue = addInterval(task.dueDate, task.recurring.interval, task.recurring.unit);
      updated = [...updated, { ...task, id: uid(), status: 'To Do', dueDate: nextDue, notes: [], createdAt: today() }];
    }
    set('propertyTasks', updated);
  };

  const addNote = (taskId, text) => {
    set('propertyTasks', propertyTasks.map(t =>
      t.id === taskId ? { ...t, notes: [...(t.notes || []), { id: uid(), date: today(), text }] } : t
    ));
  };

  if (!selProp && propScope === 'current') {
    return (
      <div className="page-content">
        <div className="page-header"><div className="page-title">Tasks</div></div>
        <div className="empty-state">
          <div className="es-icon"><Icon name="clipboard" size={38} /></div>
          <div className="es-text">Select a property from the Overview or Properties tab first.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <div className="page-title">Tasks</div>
          <div className="page-sub">
            {selProp ? selProp.name : 'All properties'} · {visible.length} task{visible.length !== 1 ? 's' : ''}
            {overdueCount > 0 && <span className="red" style={{ marginLeft: 8 }}>· {overdueCount} overdue</span>}
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
            <Icon name="plus" size={14} /> Add Task
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="dash-section" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="form-section-label" style={{ minWidth: 60 }}>Status</span>
            <div className="filter-tabs">
              {['All', ...STATUSES].map(s => (
                <button key={s} className={`filter-tab ${filterStatus === s ? 'active' : ''}`} onClick={() => setFilterStatus(s)}>{s}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="form-section-label" style={{ minWidth: 60 }}>Priority</span>
            <div className="filter-tabs">
              {['All', ...PRIORITIES].map(p => (
                <button key={p} className={`filter-tab ${filterPriority === p ? 'active' : ''}`} onClick={() => setFilterPriority(p)}>{p}</button>
              ))}
            </div>
          </div>
          {areas.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="form-section-label" style={{ minWidth: 60 }}>Area</span>
              <div className="filter-tabs">
                {[{ id: 'All', name: 'All' }, ...areas].map(a => (
                  <button key={a.id} className={`filter-tab ${filterArea === a.id ? 'active' : ''}`} onClick={() => setFilterArea(a.id)}>{a.name}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="empty-state">
          <div className="es-icon"><Icon name="clipboard" size={38} /></div>
          <div className="es-text">
            {propertyTasks.length === 0 ? 'No tasks yet. Create your first task to track what needs doing.' : 'No tasks match the current filters.'}
          </div>
          {selProp && <button className="btn-primary" onClick={openNew}><Icon name="plus" size={14} /> Add Task</button>}
        </div>
      ) : (
        <div className="expense-list">
          {visible.map(task => {
            const prop = properties.find(p => p.id === task.propertyId);
            return (
              <TaskRow
                key={task.id}
                task={task}
                areas={prop?.areas || []}
                propName={prop?.name}
                showProp={propScope === 'all' && properties.length > 1}
                onEdit={openEdit}
                onDelete={deleteTask}
                onStatusChange={cycleStatus}
                onAddNote={addNote}
              />
            );
          })}
        </div>
      )}

      {/* ── Modal ──────────────────────────────────────────────────────────── */}
      {showModal && (
        <div className="modal-overlay" onClick={close}>
          <div className="modal wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId === 'new' ? 'Add Task' : 'Edit Task'}</h3>
              <button className="btn-icon" onClick={close}><Icon name="close" size={14} /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group full">
                  <label>Title *</label>
                  <input className={`input${errors.title ? ' input-error' : ''}`} placeholder="What needs doing?" value={form.title} onChange={e => setField('title', e.target.value)} autoFocus />
                  {errors.title && <span className="field-error">{errors.title}</span>}
                </div>
                <div className="form-group full">
                  <label>Description</label>
                  <textarea className="input" rows={2} style={{ resize: 'vertical' }} value={form.description} onChange={e => setField('description', e.target.value)} />
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
                  <label>Category</label>
                  <select className="input" value={form.category} onChange={e => setField('category', e.target.value)}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Priority</label>
                  <select className="input" value={form.priority} onChange={e => setField('priority', e.target.value)}>
                    {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select className="input" value={form.status} onChange={e => setField('status', e.target.value)}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Effort</label>
                  <select className="input" value={form.effort} onChange={e => setField('effort', e.target.value)}>
                    <option value="">— None —</option>
                    {EFFORTS.map(e => <option key={e}>{e}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Due Date</label>
                  <input className="input" type="date" value={form.dueDate} onChange={e => setField('dueDate', e.target.value)} />
                </div>
                <div className="form-group full">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: recurEnabled ? 10 : 0 }}>
                    <input type="checkbox" id="recur" checked={recurEnabled} onChange={e => setRecurEnabled(e.target.checked)} />
                    <label htmlFor="recur" style={{ cursor: 'pointer', fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>Recurring task</label>
                  </div>
                  {recurEnabled && (
                    <>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span className="text3" style={{ fontSize: 12 }}>Repeat every</span>
                        <input className={`input${errors.recurInterval ? ' input-error' : ''}`} type="number" min="1" style={{ width: 60 }} value={recurInterval} onChange={e => setRecurInterval(e.target.value)} />
                        <select className="input" style={{ width: 110 }} value={recurUnit} onChange={e => setRecurUnit(e.target.value)}>
                          {RECUR_UNITS.map(u => <option key={u}>{u}</option>)}
                        </select>
                      </div>
                      {errors.recurInterval && <span className="field-error">{errors.recurInterval}</span>}
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={close}>Cancel</button>
              <button className="btn-primary" onClick={save}>
                {editingId === 'new' ? 'Add Task' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

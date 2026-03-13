import { useState, useMemo, Fragment } from 'react';
import { useProperty } from '../../store/hooks';
import Icon from '../../components/Icon';
import { EmptyState, Card, SectionHeader, StatTile, Modal } from '../../components/ui';
import {
  createPropertyTask,
  TASK_CATEGORIES, TASK_PRIORITIES, TASK_STATUSES, TASK_EFFORTS, RECUR_UNITS,
  PRIORITY_PILL, STATUS_NEXT,
} from '../../models/PropertyTask';
import { getTaskDependents, cascadeDeleteTask, taskDeleteMessage } from '../../utils/cascade';
import { validate, propertyTaskSchema } from '../../utils/validation';

function today() { return new Date().toISOString().slice(0, 10); }

const CATEGORIES     = TASK_CATEGORIES;
const PRIORITIES     = TASK_PRIORITIES;
const STATUSES       = TASK_STATUSES;
const EFFORTS        = TASK_EFFORTS;
const PRIORITY_DPILL = PRIORITY_PILL;
const PRIORITY_BAR   = { Urgent: 'var(--red)', High: 'var(--amber)', Medium: 'var(--teal)', Low: 'var(--sep2)' };
const PRIORITY_ORDER = { Urgent: 0, High: 1, Medium: 2, Low: 3 };
const TYPE_COLOR     = {
  'Primary Home': 'teal', 'Rental': 'amber', 'Bach/Holiday': 'green',
  'Investment': 'purple', 'Land/Section': '', 'Other': '',
};

const EMPTY_TASK = createPropertyTask();

// ── List helpers ─────────────────────────────────────────────────────────────

function addInterval(dateStr, interval, unit) {
  const d = new Date(dateStr);
  if (unit === 'days')       d.setDate(d.getDate() + interval);
  if (unit === 'weeks')      d.setDate(d.getDate() + interval * 7);
  if (unit === 'fortnights') d.setDate(d.getDate() + interval * 14);
  if (unit === 'months')     d.setMonth(d.getMonth() + interval);
  if (unit === 'years')      d.setFullYear(d.getFullYear() + interval);
  return d.toISOString().slice(0, 10);
}

function getSortFn(sortBy) {
  if (sortBy === 'dueDate') return (a, b) => {
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    return a.dueDate ? -1 : 1;
  };
  if (sortBy === 'title')    return (a, b) => a.title.localeCompare(b.title);
  if (sortBy === 'category') return (a, b) => a.category.localeCompare(b.category);
  return (a, b) => {
    if (PRIORITY_ORDER[a.priority] !== PRIORITY_ORDER[b.priority])
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    return a.dueDate ? -1 : 1;
  };
}

/** Returns a compact, human-readable due-date label relative to today. */
function relativeDue(dateStr) {
  if (!dateStr) return null;
  const todayStr = today();
  const diff = Math.round(
    (new Date(dateStr + 'T00:00:00') - new Date(todayStr + 'T00:00:00')) / 86400000
  );
  if (diff < 0)   return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff <= 7)  return `${diff}d`;
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
}

const BUCKETS = [
  { key: 'overdue',  label: 'Overdue',    color: 'red'   },
  { key: 'dueSoon',  label: 'Due Soon',   color: 'amber' },
  { key: 'upcoming', label: 'Upcoming',   color: ''      },
  { key: 'noDue',    label: 'No Due Date',color: ''      },
  { key: 'done',     label: 'Completed',  color: ''      },
];

// ── UI helpers ────────────────────────────────────────────────────────────────

function ActiveChip({ label, onClear }) {
  return (
    <span className="tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {label}
      <button
        onClick={onClear}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: 'var(--text3)', fontSize: 13 }}
        aria-label="Remove filter"
      >×</button>
    </span>
  );
}

// ── TaskRow ───────────────────────────────────────────────────────────────────

function TaskRow({ task, areas, propName, showProp, onEdit, onDelete, onStatusChange, onAddNote }) {
  const [open,     setOpen]     = useState(false);
  const [noteText, setNoteText] = useState('');

  const area      = areas.find(a => a.id === task.areaId);
  const todayStr  = today();
  const isOverdue = task.dueDate && task.dueDate < todayStr && task.status !== 'Done' && task.status !== 'Cancelled';
  const dueLabel  = relativeDue(task.dueDate);
  const isDone    = task.status === 'Done' || task.status === 'Cancelled';

  // Show status tag only when it communicates something actionable
  const showStatusTag = task.status === 'In Progress' || task.status === 'Waiting';

  const submitNote = () => {
    if (!noteText.trim()) return;
    onAddNote(task.id, noteText.trim());
    setNoteText('');
  };

  return (
    <div className={`expense-row ${open ? 'expanded' : ''}`} onClick={() => setOpen(o => !o)}>
      <div className="exp-cat-bar" style={{ background: PRIORITY_BAR[task.priority] }} />
      <div className="exp-main">
        <div className="exp-top">
          <div className="exp-info">
            <span className={`exp-name ${isDone ? 'line-through' : ''}`}>{task.title}</span>
            {showProp && propName && (
              <span className="text3" style={{ display: 'block', fontSize: 11, marginTop: 1 }}>
                {propName}
              </span>
            )}
            <span className="exp-tags">
              {showStatusTag && <span className="tag">{task.status}</span>}
              <span className="tag">{task.category}</span>
              {area && <span className="tag teal">{area.name}</span>}
              {task.effort && <span className="tag">{task.effort}</span>}
              {task.recurring && <span className="tag amber">Recurring</span>}
              {task.notes?.length > 0 && <span className="tag">{task.notes.length} note{task.notes.length !== 1 ? 's' : ''}</span>}
            </span>
          </div>
          <div className="exp-right">
            <div className="exp-amounts">
              {dueLabel && (
                <span className="exp-amount" style={{
                  fontSize: 12,
                  color: isOverdue ? 'var(--red)' : 'var(--text3)',
                  fontFamily: 'var(--mono)',
                  fontWeight: isOverdue ? 600 : 500,
                }}>
                  {dueLabel}
                </span>
              )}
              <span className={`dpill ${PRIORITY_DPILL[task.priority]}`} style={task.priority === 'Low' ? { color: 'var(--text3)' } : {}}>
                {task.priority}
              </span>
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
            <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-2)' }}>
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

// ── Main component ────────────────────────────────────────────────────────────

export default function PropertyTasks() {
  const { properties, propertyTasks, propertyMaintenance, selectedPropertyId, setProperty, mergeProperty } = useProperty();

  const selProp = properties.find(p => p.id === selectedPropertyId) || null;

  // ── Scope ──────────────────────────────────────────────────────────────────
  const [propScope, setPropScope] = useState('current');

  // ── Primary filters ────────────────────────────────────────────────────────
  const [filterSearch,   setFilterSearch]   = useState('');
  const [filterStatus,   setFilterStatus]   = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');
  const [filterArea,     setFilterArea]     = useState('All');
  const [sortBy,         setSortBy]         = useState('priority');

  // ── Secondary filters ──────────────────────────────────────────────────────
  const [showMore,        setShowMore]        = useState(false);
  const [filterCategory,  setFilterCategory]  = useState('All');
  const [filterRecurring, setFilterRecurring] = useState(false);
  const [filterShowDone,  setFilterShowDone]  = useState(true);
  const [filterDueBefore, setFilterDueBefore] = useState('');

  // ── Modal ──────────────────────────────────────────────────────────────────
  const [showModal,     setShowModal]     = useState(false);
  const [form,          setForm]          = useState(EMPTY_TASK);
  const [editingId,     setEditingId]     = useState(null);
  const [errors,        setErrors]        = useState({});
  const [recurEnabled,  setRecurEnabled]  = useState(false);
  const [recurInterval, setRecurInterval] = useState(6);
  const [recurUnit,     setRecurUnit]     = useState('months');

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const areas = selProp?.areas || [];

  // ── Scope helpers ──────────────────────────────────────────────────────────
  const selectProperty = (id) => {
    setProperty('selectedPropertyId', id);
    setPropScope('current');
    setFilterArea('All');
  };

  const selectAll = () => {
    setPropScope('all');
    setFilterArea('All');
  };

  const clearAllFilters = () => {
    setFilterSearch('');
    setFilterStatus('All');
    setFilterPriority('All');
    setFilterArea('All');
    setFilterCategory('All');
    setFilterRecurring(false);
    setFilterShowDone(true);
    setFilterDueBefore('');
  };

  // ── Derived data ───────────────────────────────────────────────────────────
  const scopedTasks = useMemo(() => {
    if (propScope === 'all') return propertyTasks;
    return selectedPropertyId ? propertyTasks.filter(t => t.propertyId === selectedPropertyId) : [];
  }, [propertyTasks, propScope, selectedPropertyId]);

  const snap = useMemo(() => {
    const todayStr = today();
    const d7 = new Date(); d7.setDate(d7.getDate() + 7);
    const in7days    = d7.toISOString().slice(0, 10);
    const open       = scopedTasks.filter(t => t.status !== 'Done' && t.status !== 'Cancelled');
    const overdue    = open.filter(t => t.dueDate && t.dueDate < todayStr);
    const dueSoon    = open.filter(t => t.dueDate && t.dueDate >= todayStr && t.dueDate <= in7days);
    const inProgress = scopedTasks.filter(t => t.status === 'In Progress').length;
    const recurring  = scopedTasks.filter(t => !!t.recurring).length;
    return { open: open.length, overdue: overdue.length, dueSoon: dueSoon.length, inProgress, recurring };
  }, [scopedTasks]);

  // Filtered flat list — no sort; sorting is applied per-bucket in `grouped`
  const visible = useMemo(() => {
    let list = propertyTasks;
    if (propScope === 'current' && selectedPropertyId) list = list.filter(t => t.propertyId === selectedPropertyId);
    if (filterSearch)             list = list.filter(t => t.title.toLowerCase().includes(filterSearch.toLowerCase()));
    if (filterStatus   !== 'All') list = list.filter(t => t.status   === filterStatus);
    if (filterPriority !== 'All') list = list.filter(t => t.priority === filterPriority);
    if (filterArea     !== 'All') list = list.filter(t => t.areaId   === filterArea);
    if (filterCategory !== 'All') list = list.filter(t => t.category === filterCategory);
    if (filterRecurring)          list = list.filter(t => !!t.recurring);
    if (!filterShowDone)          list = list.filter(t => t.status !== 'Done');
    if (filterDueBefore)          list = list.filter(t => t.dueDate && t.dueDate <= filterDueBefore);
    return list;
  }, [propertyTasks, propScope, selectedPropertyId, filterSearch, filterStatus, filterPriority, filterArea, filterCategory, filterRecurring, filterShowDone, filterDueBefore]);

  // Bucketed + sorted for rendering
  const grouped = useMemo(() => {
    const todayStr = today();
    const d7 = new Date(); d7.setDate(d7.getDate() + 7);
    const in7days = d7.toISOString().slice(0, 10);

    const buckets = BUCKETS.map(b => ({ ...b, tasks: [] }));
    const [bOverdue, bDueSoon, bUpcoming, bNoDue, bDone] = buckets;

    for (const t of visible) {
      const active = t.status !== 'Done' && t.status !== 'Cancelled';
      if (!active)                                                        { bDone.tasks.push(t);     continue; }
      if (t.dueDate && t.dueDate < todayStr)                             { bOverdue.tasks.push(t);  continue; }
      if (t.dueDate && t.dueDate >= todayStr && t.dueDate <= in7days)    { bDueSoon.tasks.push(t);  continue; }
      if (t.dueDate && t.dueDate > in7days)                              { bUpcoming.tasks.push(t); continue; }
      bNoDue.tasks.push(t);
    }

    const sortFn = getSortFn(sortBy);
    return buckets
      .map(b => ({ ...b, tasks: [...b.tasks].sort(sortFn) }))
      .filter(b => b.tasks.length > 0);
  }, [visible, sortBy]);

  const isFiltered = !!(filterSearch || filterStatus !== 'All' || filterPriority !== 'All' || filterArea !== 'All' || filterCategory !== 'All' || filterRecurring || !filterShowDone || filterDueBefore);

  // ── Modal actions ──────────────────────────────────────────────────────────
  const openNew = () => {
    setForm({ ...EMPTY_TASK, id: crypto.randomUUID(), propertyId: selectedPropertyId || '', createdAt: today() });
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
    if (editingId === 'new') setProperty('propertyTasks', [...propertyTasks, taskData]);
    else setProperty('propertyTasks', propertyTasks.map(t => t.id === taskData.id ? taskData : t));
    close();
  };

  const deleteTask = (id) => {
    const deps = getTaskDependents({ propertyMaintenance }, id);
    if (!confirm(taskDeleteMessage(deps))) return;
    mergeProperty(cascadeDeleteTask({ propertyTasks, propertyMaintenance }, id));
  };

  const cycleStatus = (task) => {
    const next = STATUS_NEXT[task.status] || 'To Do';
    let updated = propertyTasks.map(t => t.id === task.id ? { ...t, status: next } : t);
    if (next === 'Done' && task.recurring?.interval && task.dueDate) {
      const nextDue = addInterval(task.dueDate, task.recurring.interval, task.recurring.unit);
      updated = [...updated, { ...task, id: crypto.randomUUID(), status: 'To Do', dueDate: nextDue, notes: [], createdAt: today() }];
    }
    setProperty('propertyTasks', updated);
  };

  const addNote = (taskId, text) => {
    setProperty('propertyTasks', propertyTasks.map(t =>
      t.id === taskId ? { ...t, notes: [...(t.notes || []), { id: crypto.randomUUID(), date: today(), text }] } : t
    ));
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (properties.length === 0) {
    return (
      <div className="page-content">
        <EmptyState
          icon={<Icon name="clipboard" size={38} />}
          title="No properties yet. Add a property first to start tracking tasks."
        />
      </div>
    );
  }

  const scopeLabel = propScope === 'all' ? 'All properties' : (selProp?.name ?? 'No property selected');

  return (
    <div className="page-content">

      {/* ── 1. Property selector ────────────────────────────────────────── */}
      <Card variant="section">
        <SectionHeader
          title={<><Icon name="building" size={15} /> Properties</>}
          subtitle={`${properties.length} ${properties.length === 1 ? 'property' : 'properties'} · click to select`}
        />
        <div className="prop-selector">
          {/* All card */}
          <div
            className={`prop-sel-item${propScope === 'all' ? ' selected' : ''}`}
            onClick={selectAll}
          >
            <span className="prop-sel-name">All Properties</span>
            <div className="prop-sel-meta">
              <span className="tag">{properties.length} {properties.length === 1 ? 'property' : 'properties'}</span>
            </div>
          </div>
          {properties.map(prop => {
            const overdue = propertyTasks.filter(t =>
              t.propertyId === prop.id && t.dueDate && t.dueDate < today() &&
              t.status !== 'Done' && t.status !== 'Cancelled'
            ).length;
            const isSelected = propScope === 'current' && prop.id === selectedPropertyId;
            return (
              <div
                key={prop.id}
                className={`prop-sel-item${isSelected ? ' selected' : ''}`}
                onClick={() => selectProperty(prop.id)}
              >
                <span className="prop-sel-name">{prop.name}</span>
                {prop.address && <span className="prop-sel-addr">{prop.address}</span>}
                <div className="prop-sel-meta">
                  {prop.type     && <span className={`tag ${TYPE_COLOR[prop.type] || ''}`}>{prop.type}</span>}
                  {prop.bedrooms  && <span className="tag">{prop.bedrooms}bd</span>}
                  {prop.bathrooms && <span className="tag">{prop.bathrooms}ba</span>}
                  {overdue > 0    && <span className="dpill red">{overdue} due</span>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── 2. Task snapshot ────────────────────────────────────────────── */}
      <Card variant="section">
        <SectionHeader
          title={<><Icon name="clipboard" size={15} /> Task Snapshot</>}
          subtitle={scopeLabel}
        />
        <div className="fn-summary">
          <StatTile label="Open"        value={snap.open}        valueClassName={snap.open > 0 ? '' : 'text3'} />
          <StatTile label="Due Soon"    value={snap.dueSoon}     valueClassName={snap.dueSoon > 0 ? 'amber' : 'text3'} meta="next 7 days" />
          <StatTile label="Overdue"     value={snap.overdue}     valueClassName={snap.overdue > 0 ? 'red' : 'text3'} />
          <StatTile label="In Progress" value={snap.inProgress}  valueClassName={snap.inProgress > 0 ? 'teal' : 'text3'} />
          <StatTile label="Recurring"   value={snap.recurring}   valueClassName="text3" />
        </div>
      </Card>

      {/* ── 3. Filters ──────────────────────────────────────────────────── */}
      <Card variant="section">
        <SectionHeader
          title={<><Icon name="filter" size={15} /> Filters</>}
          actions={
            <button className="btn-ghost small" onClick={() => setShowMore(m => !m)}>
              {showMore ? 'Fewer' : 'More'}
            </button>
          }
        />

        {/* Primary toolbar */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="input small"
            style={{ flex: '1 1 160px', minWidth: 140 }}
            placeholder="Search tasks…"
            value={filterSearch}
            onChange={e => setFilterSearch(e.target.value)}
          />
          <select className="input small" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="All">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="input small" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
            <option value="All">All priorities</option>
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          {propScope === 'current' && areas.length > 0 && (
            <select className="input small" value={filterArea} onChange={e => setFilterArea(e.target.value)}>
              <option value="All">All areas</option>
              {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          <select className="input small" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="priority">Sort: Priority</option>
            <option value="dueDate">Sort: Due date</option>
            <option value="title">Sort: Title</option>
            <option value="category">Sort: Category</option>
          </select>
        </div>

        {/* Secondary filters */}
        {showMore && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--sep)' }}>
            <select className="input small" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
              <option value="All">All categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)', cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={filterRecurring} onChange={e => setFilterRecurring(e.target.checked)} />
              Recurring only
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)', cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={filterShowDone} onChange={e => setFilterShowDone(e.target.checked)} />
              Show completed
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="text3" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>Due before</span>
              <input
                className="input small"
                type="date"
                style={{ width: 140 }}
                value={filterDueBefore}
                onChange={e => setFilterDueBefore(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Active filter chips */}
        {isFiltered && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 'var(--space-3)' }}>
            <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>Active:</span>
            {filterSearch             && <ActiveChip label={`"${filterSearch}"`}                                       onClear={() => setFilterSearch('')} />}
            {filterStatus   !== 'All' && <ActiveChip label={filterStatus}                                              onClear={() => setFilterStatus('All')} />}
            {filterPriority !== 'All' && <ActiveChip label={filterPriority}                                            onClear={() => setFilterPriority('All')} />}
            {filterArea     !== 'All' && <ActiveChip label={areas.find(a => a.id === filterArea)?.name ?? filterArea}  onClear={() => setFilterArea('All')} />}
            {filterCategory !== 'All' && <ActiveChip label={filterCategory}                                            onClear={() => setFilterCategory('All')} />}
            {filterRecurring          && <ActiveChip label="Recurring"                                                 onClear={() => setFilterRecurring(false)} />}
            {!filterShowDone          && <ActiveChip label="Hiding completed"                                          onClear={() => setFilterShowDone(true)} />}
            {filterDueBefore          && <ActiveChip label={`Due before ${filterDueBefore}`}                           onClear={() => setFilterDueBefore('')} />}
            <button className="btn-ghost small" onClick={clearAllFilters} style={{ fontSize: 11, padding: '2px 8px' }}>Clear all</button>
          </div>
        )}
      </Card>

      {/* ── 4. Task list ────────────────────────────────────────────────── */}
      <Card variant="section">
        <SectionHeader
          title={<><Icon name="clipboard" size={15} /> Tasks</>}
          subtitle={`${visible.length} task${visible.length !== 1 ? 's' : ''}${isFiltered ? ' (filtered)' : ''}`}
          actions={
            <button className="btn-ghost small" onClick={openNew} disabled={!selProp && propScope !== 'all'}>
              <Icon name="plus" size={14} /> Add Task
            </button>
          }
        />

        {grouped.length === 0 ? (
          <EmptyState
            icon={<Icon name="clipboard" size={38} />}
            title={scopedTasks.length === 0
              ? 'No tasks yet. Create your first task to track what needs doing.'
              : 'No tasks match the current filters.'}
            action={selProp && <button className="btn-ghost" onClick={openNew}><Icon name="plus" size={14} /> Add Task</button>}
          />
        ) : (
          grouped.map((bucket, bi) => {
            const headerColor = bucket.color ? { color: `var(--${bucket.color})` } : {};
            return (
              <Fragment key={bucket.key}>
                <div className="section-subheader" style={{ marginTop: bi === 0 ? 4 : undefined }}>
                  <span style={headerColor}>{bucket.label}</span>
                  <span className={bucket.color ? `dpill ${bucket.color}` : 'dpill'}>
                    {bucket.tasks.length}
                  </span>
                </div>
                <div className="expense-list">
                  {bucket.tasks.map(task => {
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
              </Fragment>
            );
          })
        )}
      </Card>

      {/* ── Modal ────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={showModal}
        onClose={close}
        title={editingId === 'new' ? 'Add Task' : 'Edit Task'}
        wide
        footer={
          <>
            <button className="btn-ghost" onClick={close}>Cancel</button>
            <button className="btn-primary" onClick={save}>
              {editingId === 'new' ? 'Add Task' : 'Save'}
            </button>
          </>
        }
      >
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
      </Modal>
    </div>
  );
}

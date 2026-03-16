import { useState, useCallback } from 'react';
import { useProperty } from '../../store/hooks';
import Icon from '../../components/Icon';
import { EmptyState, Card, SectionHeader, StatTile, ConfirmDialog, FilterBar, FilterChips, GroupedList } from '../../components/ui';
import { STATUS_NEXT } from '../../models/PropertyTask';
import { getTaskDependents, cascadeDeleteTask, taskDeleteMessage } from '../../utils/cascade';
import { today } from '../../utils/finance/dates';
import TaskRow from '../../components/property/TaskRow';
import TaskModal from '../../components/property/TaskModal';
import { useTaskFilters, CATEGORIES, PRIORITIES, STATUSES } from './useTaskFilters';

function addInterval(dateStr, interval, unit) {
  const d = new Date(dateStr);
  if (unit === 'days')       d.setDate(d.getDate() + interval);
  if (unit === 'weeks')      d.setDate(d.getDate() + interval * 7);
  if (unit === 'fortnights') d.setDate(d.getDate() + interval * 14);
  if (unit === 'months')     d.setMonth(d.getMonth() + interval);
  if (unit === 'years')      d.setFullYear(d.getFullYear() + interval);
  return d.toISOString().slice(0, 10);
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PropertyTasks() {
  const { properties, propertyTasks, propertyMaintenance, selectedPropertyId, setProperty, mergeProperty } = useProperty();

  const selProp = properties.find(p => p.id === selectedPropertyId) || null;
  const areas = selProp?.areas || [];

  // ── Filtering + bucketing ──────────────────────────────────────────────────
  const { filters, scopedTasks, visible, grouped, snap, isFiltered, clearAll } = useTaskFilters(propertyTasks, selectedPropertyId);

  // ── Modal state ────────────────────────────────────────────────────────────
  const [showModal, setShowModal]       = useState(false);
  const [editTarget, setEditTarget]     = useState(null);   // null = new, object = edit
  const [confirmTarget, setConfirmTarget] = useState(null);

  const openNew = () => {
    setEditTarget(null);
    setShowModal(true);
  };

  const openEdit = useCallback((task) => {
    setEditTarget(task);
    setShowModal(true);
  }, []);

  const closeModal = () => { setShowModal(false); setEditTarget(null); };

  const handleSave = (taskData) => {
    if (!editTarget) {
      setProperty('propertyTasks', [...propertyTasks, taskData]);
    } else {
      setProperty('propertyTasks', propertyTasks.map(t => t.id === taskData.id ? taskData : t));
    }
    closeModal();
  };

  // ── Task actions ───────────────────────────────────────────────────────────
  const deleteTask = useCallback((id) => {
    const deps = getTaskDependents({ propertyMaintenance }, id);
    setConfirmTarget({ id, message: taskDeleteMessage(deps) });
  }, [propertyMaintenance]);

  const executeDeleteTask = () => {
    mergeProperty(cascadeDeleteTask({ propertyTasks, propertyMaintenance }, confirmTarget.id));
    setConfirmTarget(null);
  };

  const cycleStatus = useCallback((task) => {
    const next = STATUS_NEXT[task.status] || 'To Do';
    let updated = propertyTasks.map(t => t.id === task.id ? { ...t, status: next } : t);
    if (next === 'Done' && task.recurring?.interval && task.dueDate) {
      const nextDue = addInterval(task.dueDate, task.recurring.interval, task.recurring.unit);
      updated = [...updated, { ...task, id: crypto.randomUUID(), status: 'To Do', dueDate: nextDue, notes: [], createdAt: today() }];
    }
    setProperty('propertyTasks', updated);
  }, [propertyTasks, setProperty]);

  const addNote = useCallback((taskId, text) => {
    setProperty('propertyTasks', propertyTasks.map(t =>
      t.id === taskId ? { ...t, notes: [...(t.notes || []), { id: crypto.randomUUID(), date: today(), text }] } : t
    ));
  }, [propertyTasks, setProperty]);

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

  const scopeLabel = selectedPropertyId === null ? 'All properties' : (selProp?.name ?? 'No property selected');

  return (
    <div className="page-content">

      {/* ── 1. Task snapshot ────────────────────────────────────────────── */}
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

      {/* ── 2. Filters ──────────────────────────────────────────────────── */}
      <Card variant="section">
        <SectionHeader
          title={<><Icon name="filter" size={15} /> Filters</>}
          actions={
            <button className="btn-ghost small" onClick={() => filters.setShowMore(m => !m)}>
              {filters.showMore ? 'Fewer' : 'More'}
            </button>
          }
        />

        <FilterBar
          showMore={filters.showMore}
          secondary={
            <>
              <select className="input small" value={filters.category} onChange={e => filters.setCategory(e.target.value)} aria-label="Filter by category">
                <option value="All">All categories</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)', cursor: 'pointer', userSelect: 'none' }}>
                <input type="checkbox" checked={filters.recurring} onChange={e => filters.setRecurring(e.target.checked)} />
                Recurring only
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)', cursor: 'pointer', userSelect: 'none' }}>
                <input type="checkbox" checked={filters.showDone} onChange={e => filters.setShowDone(e.target.checked)} />
                Show completed
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="text3" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>Due before</span>
                <input
                  className="input small"
                  type="date"
                  style={{ width: 140 }}
                  value={filters.dueBefore}
                  onChange={e => filters.setDueBefore(e.target.value)}
                />
              </div>
            </>
          }
        >
          <input
            className="input small"
            style={{ flex: '1 1 160px', minWidth: 140 }}
            placeholder="Search tasks…"
            value={filters.search}
            onChange={e => filters.setSearch(e.target.value)}
          />
          <select className="input small" value={filters.status} onChange={e => filters.setStatus(e.target.value)} aria-label="Filter by status">
            <option value="All">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="input small" value={filters.priority} onChange={e => filters.setPriority(e.target.value)} aria-label="Filter by priority">
            <option value="All">All priorities</option>
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          {selectedPropertyId !== null && areas.length > 0 && (
            <select className="input small" value={filters.area} onChange={e => filters.setArea(e.target.value)} aria-label="Filter by area">
              <option value="All">All areas</option>
              {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          <select className="input small" value={filters.sortBy} onChange={e => filters.setSortBy(e.target.value)} aria-label="Sort tasks">
            <option value="priority">Sort: Priority</option>
            <option value="dueDate">Sort: Due date</option>
            <option value="title">Sort: Title</option>
            <option value="category">Sort: Category</option>
          </select>
        </FilterBar>

        <FilterChips
          chips={[
            { key: 'search', label: filters.search ? `"${filters.search}"` : '', onClear: () => filters.setSearch('') },
            { key: 'status', label: filters.status !== 'All' ? filters.status : '', onClear: () => filters.setStatus('All') },
            { key: 'priority', label: filters.priority !== 'All' ? filters.priority : '', onClear: () => filters.setPriority('All') },
            { key: 'area', label: filters.area !== 'All' ? (areas.find(a => a.id === filters.area)?.name ?? filters.area) : '', onClear: () => filters.setArea('All') },
            { key: 'category', label: filters.category !== 'All' ? filters.category : '', onClear: () => filters.setCategory('All') },
            { key: 'recurring', label: filters.recurring ? 'Recurring' : '', onClear: () => filters.setRecurring(false) },
            { key: 'showDone', label: !filters.showDone ? 'Hiding completed' : '', onClear: () => filters.setShowDone(true) },
            { key: 'dueBefore', label: filters.dueBefore ? `Due before ${filters.dueBefore}` : '', onClear: () => filters.setDueBefore('') },
          ]}
          onClearAll={clearAll}
        />
      </Card>

      {/* ── 3. Task list ────────────────────────────────────────────────── */}
      <Card variant="section">
        <SectionHeader
          title={<><Icon name="clipboard" size={15} /> Tasks</>}
          subtitle={`${visible.length} task${visible.length !== 1 ? 's' : ''}${isFiltered ? ' (filtered)' : ''}`}
          actions={
            <button className="btn-ghost small" onClick={openNew} disabled={!selProp && selectedPropertyId !== null}>
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
          <GroupedList
            groups={grouped.map(bucket => ({
              key: bucket.key,
              label: bucket.label,
              color: bucket.color,
              count: bucket.tasks.length,
              items: bucket.tasks.map(task => {
                const prop = properties.find(p => p.id === task.propertyId);
                return (
                  <TaskRow
                    key={task.id}
                    task={task}
                    areas={prop?.areas || []}
                    propName={prop?.name}
                    showProp={selectedPropertyId === null && properties.length > 1}
                    onEdit={openEdit}
                    onDelete={deleteTask}
                    onStatusChange={cycleStatus}
                    onAddNote={addNote}
                  />
                );
              }),
            }))}
          />
        )}
      </Card>

      {/* ── Modal ──────────────────────────────────────────────────────── */}
      {showModal && (
        <TaskModal
          isOpen
          task={editTarget}
          properties={properties}
          selectedPropertyId={selectedPropertyId}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}

      <ConfirmDialog
        open={!!confirmTarget}
        title="Delete task"
        message={confirmTarget?.message || ''}
        onConfirm={executeDeleteTask}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}

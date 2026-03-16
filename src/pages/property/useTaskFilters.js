import { useState, useEffect, useMemo } from 'react';
import { TASK_CATEGORIES, TASK_PRIORITIES, TASK_STATUSES } from '../../models/PropertyTask';
import { today } from '../../utils/finance/dates';

// ── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_ORDER = { Urgent: 0, High: 1, Medium: 2, Low: 3 };

const BUCKETS = [
  { key: 'overdue',  label: 'Overdue',     color: 'red'   },
  { key: 'dueSoon',  label: 'Due Soon',    color: 'amber' },
  { key: 'upcoming', label: 'Upcoming',    color: ''      },
  { key: 'noDue',    label: 'No Due Date', color: ''      },
  { key: 'done',     label: 'Completed',   color: ''      },
];

export { TASK_CATEGORIES as CATEGORIES, TASK_PRIORITIES as PRIORITIES, TASK_STATUSES as STATUSES };

// ── Sort helpers ─────────────────────────────────────────────────────────────

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

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Manages all task filtering, bucketing, and snapshot logic.
 *
 * Returns:
 *   filters     — current filter values + setters (for wiring into FilterBar / FilterChips)
 *   visible     — flat filtered task list
 *   grouped     — bucketed + sorted list for rendering
 *   snap        — summary counts (open, overdue, dueSoon, inProgress, recurring)
 *   isFiltered  — whether any filter is active
 *   clearAll()  — reset all filters to defaults
 */
export function useTaskFilters(propertyTasks, selectedPropertyId) {
  // ── Primary filters ──────────────────────────────────────────────────────
  const [search,   setSearch]   = useState('');
  const [status,   setStatus]   = useState('All');
  const [priority, setPriority] = useState('All');
  const [area,     setArea]     = useState('All');
  const [sortBy,   setSortBy]   = useState('priority');

  // ── Secondary filters ────────────────────────────────────────────────────
  const [showMore,   setShowMore]   = useState(false);
  const [category,   setCategory]   = useState('All');
  const [recurring,  setRecurring]  = useState(false);
  const [showDone,   setShowDone]   = useState(true);
  const [dueBefore,  setDueBefore]  = useState('');

  // Reset area filter when property changes
  useEffect(() => { setArea('All'); }, [selectedPropertyId]);

  const clearAll = () => {
    setSearch(''); setStatus('All'); setPriority('All'); setArea('All');
    setCategory('All'); setRecurring(false); setShowDone(true); setDueBefore('');
  };

  // ── Scoped tasks (for snapshot) ──────────────────────────────────────────
  const scopedTasks = useMemo(() => {
    if (selectedPropertyId === null) return propertyTasks;
    return selectedPropertyId ? propertyTasks.filter(t => t.propertyId === selectedPropertyId) : [];
  }, [propertyTasks, selectedPropertyId]);

  // ── Snapshot counts ──────────────────────────────────────────────────────
  const snap = useMemo(() => {
    const todayStr = today();
    const d7 = new Date(); d7.setDate(d7.getDate() + 7);
    const in7days    = d7.toISOString().slice(0, 10);
    const open       = scopedTasks.filter(t => t.status !== 'Done' && t.status !== 'Cancelled');
    const overdue    = open.filter(t => t.dueDate && t.dueDate < todayStr);
    const dueSoon    = open.filter(t => t.dueDate && t.dueDate >= todayStr && t.dueDate <= in7days);
    const inProgress = scopedTasks.filter(t => t.status === 'In Progress').length;
    const recurCount = scopedTasks.filter(t => !!t.recurring).length;
    return { open: open.length, overdue: overdue.length, dueSoon: dueSoon.length, inProgress, recurring: recurCount };
  }, [scopedTasks]);

  // ── Filtered flat list ───────────────────────────────────────────────────
  const visible = useMemo(() => {
    let list = propertyTasks;
    if (selectedPropertyId) list = list.filter(t => t.propertyId === selectedPropertyId);
    if (search)             list = list.filter(t => t.title.toLowerCase().includes(search.toLowerCase()));
    if (status   !== 'All') list = list.filter(t => t.status   === status);
    if (priority !== 'All') list = list.filter(t => t.priority === priority);
    if (area     !== 'All') list = list.filter(t => t.areaId   === area);
    if (category !== 'All') list = list.filter(t => t.category === category);
    if (recurring)          list = list.filter(t => !!t.recurring);
    if (!showDone)          list = list.filter(t => t.status !== 'Done');
    if (dueBefore)          list = list.filter(t => t.dueDate && t.dueDate <= dueBefore);
    return list;
  }, [propertyTasks, selectedPropertyId, search, status, priority, area, category, recurring, showDone, dueBefore]);

  // ── Bucketed + sorted ────────────────────────────────────────────────────
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

  const isFiltered = !!(search || status !== 'All' || priority !== 'All' || area !== 'All' || category !== 'All' || recurring || !showDone || dueBefore);

  return {
    filters: {
      search, setSearch,
      status, setStatus,
      priority, setPriority,
      area, setArea,
      sortBy, setSortBy,
      showMore, setShowMore,
      category, setCategory,
      recurring, setRecurring,
      showDone, setShowDone,
      dueBefore, setDueBefore,
    },
    scopedTasks,
    visible,
    grouped,
    snap,
    isFiltered,
    clearAll,
  };
}

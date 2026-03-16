import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { useProperty, useUndoDelete } from '../../store/hooks';
import Icon from '../../components/Icon';
import { EmptyState, Card, SectionHeader, StatTile, Modal, ExpandableRow, ConfirmDialog, FilterBar, FilterChips, GroupedList } from '../../components/ui';
import {
  createPropertyMaintenance,
  MAINTENANCE_CATEGORIES, PERFORMED_BY_OPTIONS,
} from '../../models/PropertyMaintenance';
import { today } from '../../utils/finance/dates';

const CATEGORIES   = MAINTENANCE_CATEGORIES;
const PERFORMED_BY = PERFORMED_BY_OPTIONS;

const CATEGORY_BAR = {
  Repair:      'var(--red)',
  Maintenance: 'var(--teal)',
  Improvement: 'var(--green)',
  Inspection:  'var(--teal)',
  Cleaning:    'var(--sep2)',
  Compliance:  'var(--amber)',
  General:     'var(--sep2)',
};

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

// ── MaintenanceRow ────────────────────────────────────────────────────────────

const MaintenanceRow = memo(function MaintenanceRow({ rec, areas, propName, showProp, propertyAssets, onEdit, onDelete }) {
  const area      = areas.find(a => a.id === rec.areaId);
  const asset     = propertyAssets.find(a => a.id === rec.assetId);
  const byLabel   = rec.performedBy === 'Other' ? (rec.performedByCustom || 'Other') : rec.performedBy;
  const showBy    = byLabel && byLabel !== 'Self';
  const hasDetail = !!rec.description;

  return (
    <ExpandableRow
      className="expense-row"
      summary={(expanded) => (
        <>
          <div className="exp-cat-bar" style={{ background: CATEGORY_BAR[rec.category] || 'var(--sep2)' }} />
          <div className="exp-main">
            <div className="exp-top">
              <div className="exp-info">
                <span className="exp-name">{rec.title}</span>
                <span className="exp-tags">
                  <span className="tag">{rec.category}</span>
                  {area  && <span className="tag teal">{area.name}</span>}
                  {asset && <span className="tag amber">{asset.name}</span>}
                  {showProp && propName && <span className="tag">{propName}</span>}
                </span>
                {!expanded && rec.description && (
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {rec.description}
                  </span>
                )}
              </div>
              <div className="exp-right">
                <div className="exp-amounts">
                  <span className="exp-amount" style={{ fontSize: 12, color: 'var(--text3)' }}>{rec.date}</span>
                  {showBy && <span className="dpill">{byLabel}</span>}
                </div>
                <div className="exp-actions" onClick={e => e.stopPropagation()}>
                  <button className="btn-icon" onClick={() => onEdit(rec)} aria-label="Edit maintenance record"><Icon name="pencil" /></button>
                  <button className="btn-icon danger" onClick={() => onDelete(rec.id)} aria-label="Delete maintenance record"><Icon name="trash" /></button>
                </div>
              </div>
            </div>

            {expanded && rec.description && (
              <div className="exp-detail" onClick={e => e.stopPropagation()}>
                <div className="exp-detail-notes">{rec.description}</div>
              </div>
            )}
          </div>
        </>
      )}
    />
  );
});

function fmtMonth(ym) {
  if (!ym || ym === 'Unknown') return 'Unknown';
  const [y, m] = ym.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString('en-NZ', { month: 'long', year: 'numeric' });
}

export default function PropertyMaintenance() {
  const { properties, propertyMaintenance, propertyTasks, propertyAssets, selectedPropertyId, setProperty } = useProperty();
  const undoDelete = useUndoDelete();

  const selProp = properties.find(p => p.id === selectedPropertyId) || null;
  const areas   = selProp?.areas || [];

  const [showModal,       setShowModal]       = useState(false);
  const [form,            setForm]            = useState(EMPTY_RECORD);
  const [editingId,       setEditingId]       = useState(null);
  // ── Filters ─────────────────────────────────────────────────────────────────
  const [search,          setSearch]          = useState('');
  const [filterCat,       setFilterCat]       = useState('All');
  const [filterArea,      setFilterArea]      = useState('All');
  const [filterBy,        setFilterBy]        = useState('All');
  const [sortBy,          setSortBy]          = useState('date-desc');
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [filterDateFrom,  setFilterDateFrom]  = useState('');
  const [filterDateTo,    setFilterDateTo]    = useState('');
  const [confirmTarget, setConfirmTarget] = useState(null);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Reset area filter when property changes
  useEffect(() => { setFilterArea('All'); }, [selectedPropertyId]);

  const scopeLabel = selectedPropertyId === null ? 'All properties' : (selProp?.name ?? 'No property selected');

  // ── Snapshot metrics ────────────────────────────────────────────────────────
  const snap = useMemo(() => {
    const todayStr = today();
    const d30 = new Date(todayStr); d30.setDate(d30.getDate() - 30);
    const last30 = d30.toISOString().slice(0, 10);
    const ym = todayStr.slice(0, 7);

    const scoped = selectedPropertyId === null
      ? propertyMaintenance
      : propertyMaintenance.filter(r => r.propertyId === selectedPropertyId);

    const scopedTasks = selectedPropertyId === null
      ? propertyTasks
      : propertyTasks.filter(t => t.propertyId === selectedPropertyId);

    const lastDate  = [...scoped].sort((a, b) => b.date.localeCompare(a.date))[0]?.date ?? null;
    const openTasks = scopedTasks.filter(t => t.status !== 'Done' && t.status !== 'Cancelled').length;

    return {
      total:     scoped.length,
      last30:    scoped.filter(r => r.date >= last30).length,
      thisMonth: scoped.filter(r => r.date?.startsWith(ym)).length,
      openTasks,
      lastDate,
    };
  }, [propertyMaintenance, propertyTasks, selectedPropertyId]);

  // ── Filtered + grouped records ──────────────────────────────────────────────
  const records = useMemo(() => {
    let list = propertyMaintenance;
    if (selectedPropertyId) list = list.filter(r => r.propertyId === selectedPropertyId);
    if (filterCat  !== 'All') list = list.filter(r => r.category  === filterCat);
    if (filterArea !== 'All') list = list.filter(r => r.areaId    === filterArea);
    if (filterBy   !== 'All') list = list.filter(r => {
      const label = r.performedBy === 'Other' ? (r.performedByCustom || 'Other') : r.performedBy;
      return label === filterBy || r.performedBy === filterBy;
    });
    if (filterDateFrom) list = list.filter(r => r.date >= filterDateFrom);
    if (filterDateTo)   list = list.filter(r => r.date <= filterDateTo);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r => r.title.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q));
    }
    list = [...list];
    if (sortBy === 'date-asc')  list.sort((a, b) => a.date.localeCompare(b.date));
    else if (sortBy === 'title')    list.sort((a, b) => a.title.localeCompare(b.title));
    else if (sortBy === 'category') list.sort((a, b) => a.category.localeCompare(b.category));
    else list.sort((a, b) => b.date.localeCompare(a.date)); // date-desc default
    return list;
  }, [propertyMaintenance, selectedPropertyId, filterCat, filterArea, filterBy, filterDateFrom, filterDateTo, search, sortBy]);

  const groups     = useMemo(() => groupByMonth(records), [records]);
  const isFiltered = filterCat !== 'All' || filterArea !== 'All' || filterBy !== 'All'
                  || !!search.trim() || !!filterDateFrom || !!filterDateTo;

  const clearAllFilters = () => {
    setSearch(''); setFilterCat('All'); setFilterArea('All');
    setFilterBy('All'); setFilterDateFrom(''); setFilterDateTo('');
  };

  const propTasks  = selProp ? propertyTasks.filter(t => t.propertyId === selProp.id && t.status !== 'Cancelled') : [];
  const propAssets = selProp ? propertyAssets.filter(a => a.propertyId === selProp.id) : [];

  // ── Modal actions ───────────────────────────────────────────────────────────
  const openNew = () => {
    setForm({ ...EMPTY_RECORD, id: crypto.randomUUID(), propertyId: selectedPropertyId || '', date: today(), createdAt: today() });
    setEditingId('new'); setShowModal(true);
  };

  const openEdit = useCallback((rec) => {
    setForm({ ...EMPTY_RECORD, ...rec });
    setEditingId(rec.id); setShowModal(true);
  }, []);

  const close = () => { setShowModal(false); setForm(EMPTY_RECORD); setEditingId(null); };

  const save = () => {
    if (!form.title.trim() || !form.date) return;
    if (editingId === 'new') setProperty('propertyMaintenance', [...propertyMaintenance, form]);
    else setProperty('propertyMaintenance', propertyMaintenance.map(r => r.id === form.id ? form : r));
    close();
  };

  const deleteRecord = useCallback((id) => setConfirmTarget(id), []);
  const executeDeleteRecord = () => {
    if (confirmTarget) {
      undoDelete({
        label: 'Maintenance record deleted',
        domain: 'property',
        snapshot: { propertyMaintenance },
        applyFn: () => setProperty('propertyMaintenance', propertyMaintenance.filter(r => r.id !== confirmTarget)),
      });
    }
    setConfirmTarget(null);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  if (properties.length === 0) {
    return (
      <div className="page-content">
        <EmptyState
          icon={<Icon name="tool" size={38} />}
          title="No properties yet. Add a property first to start tracking maintenance."
        />
      </div>
    );
  }

  return (
    <div className="page-content">

      {/* ── 1. Maintenance snapshot ──────────────────────────────────────── */}
      <Card variant="section">
        <SectionHeader
          title={<><Icon name="tool" size={15} /> Maintenance Snapshot</>}
          subtitle={scopeLabel}
        />
        <div className="fn-summary">
          <StatTile label="Total Records" value={snap.total}     valueClassName={snap.total > 0 ? '' : 'text3'} />
          <StatTile label="Last 30 Days"  value={snap.last30}    valueClassName={snap.last30 > 0 ? 'teal' : 'text3'} meta="recent activity" />
          <StatTile label="This Month"    value={snap.thisMonth} valueClassName={snap.thisMonth > 0 ? '' : 'text3'} />
          <StatTile label="Open Tasks"    value={snap.openTasks} valueClassName={snap.openTasks > 0 ? 'amber' : 'text3'} />
          <StatTile label="Last Logged"   value={snap.lastDate ?? '—'} valueClassName="text3" />
        </div>
      </Card>

      {/* ── 3. Filters ───────────────────────────────────────────────────── */}
      <Card variant="section">
        <SectionHeader
          title={<><Icon name="filter" size={15} /> Filters</>}
          actions={
            <button className="btn-ghost small" onClick={() => setShowMoreFilters(m => !m)}>
              {showMoreFilters ? 'Fewer' : 'More'}
            </button>
          }
        />

        <FilterBar
          showMore={showMoreFilters}
          secondary={
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="text3" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>From</span>
                <input
                  className="input small"
                  type="date"
                  style={{ width: 140 }}
                  value={filterDateFrom}
                  onChange={e => setFilterDateFrom(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="text3" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>To</span>
                <input
                  className="input small"
                  type="date"
                  style={{ width: 140 }}
                  value={filterDateTo}
                  onChange={e => setFilterDateTo(e.target.value)}
                />
              </div>
            </>
          }
        >
          <input
            className="input small"
            style={{ flex: '1 1 160px', minWidth: 140 }}
            placeholder="Search title or description…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="input small" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option value="All">All categories</option>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          {selectedPropertyId !== null && areas.length > 0 && (
            <select className="input small" value={filterArea} onChange={e => setFilterArea(e.target.value)}>
              <option value="All">All areas</option>
              {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          <select className="input small" value={filterBy} onChange={e => setFilterBy(e.target.value)}>
            <option value="All">All contractors</option>
            {PERFORMED_BY.map(p => <option key={p}>{p}</option>)}
          </select>
          <select className="input small" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="date-desc">Sort: Newest</option>
            <option value="date-asc">Sort: Oldest</option>
            <option value="title">Sort: Title</option>
            <option value="category">Sort: Category</option>
          </select>
        </FilterBar>

        <FilterChips
          chips={[
            { key: 'search', label: search ? `"${search}"` : '', onClear: () => setSearch('') },
            { key: 'category', label: filterCat !== 'All' ? filterCat : '', onClear: () => setFilterCat('All') },
            { key: 'area', label: filterArea !== 'All' ? (areas.find(a => a.id === filterArea)?.name ?? filterArea) : '', onClear: () => setFilterArea('All') },
            { key: 'by', label: filterBy !== 'All' ? filterBy : '', onClear: () => setFilterBy('All') },
            { key: 'dateFrom', label: filterDateFrom ? `From ${filterDateFrom}` : '', onClear: () => setFilterDateFrom('') },
            { key: 'dateTo', label: filterDateTo ? `To ${filterDateTo}` : '', onClear: () => setFilterDateTo('') },
          ]}
          onClearAll={clearAllFilters}
        />
      </Card>

      {/* ── 4. Maintenance log ───────────────────────────────────────────── */}
      <Card variant="section">
        <SectionHeader
          title={<><Icon name="tool" size={15} /> Maintenance Log</>}
          subtitle={`${records.length} record${records.length !== 1 ? 's' : ''}${isFiltered ? ' (filtered)' : ''}`}
          actions={
            <button className="btn-ghost small" onClick={openNew} disabled={!selProp && selectedPropertyId !== null}>
              <Icon name="plus" size={14} /> Log Work
            </button>
          }
        />

        {groups.length === 0 ? (
          <EmptyState
            icon={<Icon name="tool" size={38} />}
            title={
              !selProp && selectedPropertyId !== null
                ? 'Select a property above to view its maintenance history.'
                : propertyMaintenance.length === 0
                ? 'No maintenance records yet. Log your first piece of work to start building a history.'
                : 'No records match the current filters.'
            }
            action={selProp && <button className="btn-ghost" onClick={openNew}><Icon name="plus" size={14} /> Log Work</button>}
          />
        ) : (
          <GroupedList
            groups={groups.map(({ month, items }) => ({
              key: month,
              label: fmtMonth(month),
              count: items.length,
              items: items.map(rec => {
                const prop = properties.find(p => p.id === rec.propertyId);
                return (
                  <MaintenanceRow
                    key={rec.id}
                    rec={rec}
                    areas={prop?.areas || []}
                    propName={prop?.name}
                    showProp={selectedPropertyId === null && properties.length > 1}
                    propertyAssets={propertyAssets}
                    onEdit={openEdit}
                    onDelete={deleteRecord}
                  />
                );
              }),
            }))}
          />
        )}
      </Card>

      {/* ── Modal ─────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={showModal}
        onClose={close}
        title={editingId === 'new' ? 'Log Maintenance Work' : 'Edit Record'}
        wide
        footer={
          <>
            <button className="btn-ghost" onClick={close}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={!form.title.trim() || !form.date}>
              {editingId === 'new' ? 'Log Record' : 'Save'}
            </button>
          </>
        }
      >
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
      </Modal>

      <ConfirmDialog
        open={!!confirmTarget}
        title="Delete maintenance record"
        message="Delete this maintenance record?"
        onConfirm={executeDeleteRecord}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}

import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { useProperty } from '../../store/hooks';
import Icon from '../../components/Icon';
import { EmptyState, Card, SectionHeader, StatTile, Modal, ExpandableRow, ConfirmDialog, FilterBar, FilterChips, GroupedList } from '../../components/ui';
import {
  createPropertyAsset,
  ASSET_TYPES, ASSET_CONDITIONS, CONDITION_PILL,
} from '../../models/PropertyAsset';
import { getAssetDependents, cascadeDeleteAsset, assetDeleteMessage } from '../../utils/cascade';
import { validate, propertyAssetSchema } from '../../utils/validation';
import { today } from '../../utils/finance/dates';

function warrantyStatus(warrantyExpiry) {
  if (!warrantyExpiry) return null;
  const days = Math.round((new Date(warrantyExpiry) - new Date(today())) / 86400000);
  if (days < 0)   return { label: 'Warranty expired',            pill: 'red'   };
  if (days <= 30) return { label: `Warranty expires in ${days}d`, pill: 'red'   };
  if (days <= 90) return { label: `Warranty expires in ${days}d`, pill: 'amber' };
  return null;
}

function lifespanAlert(dateInstalled, expectedLifespan) {
  if (!dateInstalled || !expectedLifespan) return null;
  const yearsLeft = (new Date(dateInstalled).getFullYear() + parseInt(expectedLifespan, 10)) - new Date().getFullYear();
  if (yearsLeft < 0)  return { label: 'Past expected lifespan',          pill: 'red'   };
  if (yearsLeft <= 2) return { label: `${yearsLeft}yr left of expected life`, pill: 'amber' };
  return null;
}

const EMPTY_ASSET = createPropertyAsset();

// ── AssetRow ──────────────────────────────────────────────────────────────────

const AssetRow = memo(function AssetRow({ asset, area, propName, showProp, maintenanceRecords, onEdit, onDelete }) {
  const warranty    = warrantyStatus(asset.warrantyExpiry);
  const lifespan    = lifespanAlert(asset.dateInstalled, asset.expectedLifespan);
  const history     = maintenanceRecords
    .filter(m => m.assetId === asset.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const lastService = history[0] ?? null;
  const hasDetail   = history.length > 0 || !!asset.notes;

  return (
    <ExpandableRow
      summary={(expanded) => (
        <div
          className="fn-main"
          style={{ cursor: hasDetail ? 'pointer' : 'default' }}
        >
          <div className="fn-left">
            <div className="fn-dates">

              {/* Title — fn-label already provides font-size/weight via CSS */}
              <div className="fn-label">{asset.name}</div>

              {/* Primary classification chips */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {showProp && propName && <span className="tag">{propName}</span>}
                <span className="tag">{asset.type}</span>
                {area && <span className="tag teal">{area.name}</span>}
                <span className={`dpill ${CONDITION_PILL[asset.condition] || ''}`}>{asset.condition}</span>
                {warranty && <span className={`dpill ${warranty.pill}`}>{warranty.label}</span>}
                {lifespan && <span className={`dpill ${lifespan.pill}`}>{lifespan.label}</span>}
              </div>

              {/* Lifecycle line */}
              {(asset.dateInstalled || lastService) && (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {asset.dateInstalled && (
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>Installed {asset.dateInstalled}</span>
                  )}
                  {lastService && (
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>Last service {lastService.date}</span>
                  )}
                </div>
              )}

              {/* Notes preview — only when collapsed */}
              {!expanded && asset.notes && (
                <div style={{ fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {asset.notes}
                </div>
              )}

            </div>
          </div>

          <div className="fn-right" style={{ alignItems: 'flex-end', gap: 'var(--space-2)' }}>
            {asset.brand && (
              <span style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'right' }}>
                {asset.brand}{asset.model ? ` ${asset.model}` : ''}
              </span>
            )}
            <div className="exp-actions">
              <button className="btn-icon small" onClick={e => { e.stopPropagation(); onEdit(asset); }} aria-label="Edit asset"><Icon name="pencil" size={12} /></button>
              <button className="btn-icon small danger" onClick={e => { e.stopPropagation(); onDelete(asset.id); }} aria-label="Delete asset"><Icon name="trash" size={12} /></button>
            </div>
          </div>
        </div>
      )}
    >
      <div className="exp-detail" onClick={e => e.stopPropagation()}>
        {asset.notes && (
          <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, marginBottom: history.length > 0 ? 'var(--space-3)' : 0 }}>
            {asset.notes}
          </div>
        )}
        {history.length > 0 && (
          <>
            <div className="form-section-label" style={{ marginBottom: 'var(--space-2)' }}>Maintenance History</div>
            <div className="change-history">
              {history.slice(0, 5).map(m => (
                <div key={m.id} className="ch-row">
                  <span className="ch-date mono">{m.date}</span>
                  <span className="ch-text" style={{ flex: 1 }}>{m.title}</span>
                  {m.performedBy && m.performedBy !== 'Self' && (
                    <span className="tag" style={{ fontSize: 10 }}>{m.performedBy}</span>
                  )}
                </div>
              ))}
              {history.length > 5 && (
                <div style={{ fontSize: 11, color: 'var(--text3)', padding: '4px 0' }}>+{history.length - 5} more records</div>
              )}
            </div>
          </>
        )}
      </div>
    </ExpandableRow>
  );
});

// ── Main component ────────────────────────────────────────────────────────────

export default function PropertyAssets() {
  const { properties, propertyAssets, propertyMaintenance, selectedPropertyId, setProperty, mergeProperty } = useProperty();

  const selProp = properties.find(p => p.id === selectedPropertyId) || null;

  const [showModal,    setShowModal]    = useState(false);
  const [form,         setForm]         = useState(EMPTY_ASSET);
  const [editingId,    setEditingId]    = useState(null);
  const [errors,       setErrors]       = useState({});
  const [filterSearch, setFilterSearch] = useState('');
  const [filterType,   setFilterType]   = useState('All');
  const [filterCond,   setFilterCond]   = useState('All');
  const [filterArea,   setFilterArea]   = useState('All');
  const [sortBy,       setSortBy]       = useState('condition');
  const [confirmTarget, setConfirmTarget] = useState(null);
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const scopeLabel = selectedPropertyId === null ? 'All properties' : (selProp?.name ?? 'No property selected');

  // Reset area filter when property changes
  useEffect(() => { setFilterArea('All'); }, [selectedPropertyId]);

  // ── Scoped assets (pre-filter) — used for snapshot ─────────────────────────
  const scopedAssets = useMemo(() => {
    if (selectedPropertyId === null) return propertyAssets;
    return selectedPropertyId ? propertyAssets.filter(a => a.propertyId === selectedPropertyId) : [];
  }, [propertyAssets, selectedPropertyId]);

  // ── Filtered + sorted assets — used for the register ───────────────────────
  const visibleAssets = useMemo(() => {
    let list = scopedAssets;
    if (filterSearch.trim()) {
      const q = filterSearch.toLowerCase();
      list = list.filter(a => a.name.toLowerCase().includes(q) || (a.brand || '').toLowerCase().includes(q));
    }
    if (filterType !== 'All') list = list.filter(a => a.type      === filterType);
    if (filterCond !== 'All') list = list.filter(a => a.condition === filterCond);
    if (filterArea !== 'All') list = list.filter(a => a.areaId    === filterArea);
    const condOrder = { Critical: 0, Poor: 1, Fair: 2, Good: 3, Excellent: 4 };
    const out = [...list];
    if (sortBy === 'name')      out.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === 'type') out.sort((a, b) => a.type.localeCompare(b.type));
    else out.sort((a, b) => (condOrder[a.condition] ?? 5) - (condOrder[b.condition] ?? 5));
    return out;
  }, [scopedAssets, filterSearch, filterType, filterCond, filterArea, sortBy]);

  // ── Assets grouped by type — preserves ASSET_TYPES order ───────────────────
  const groupedAssets = useMemo(() => (
    ASSET_TYPES
      .map(type => ({ type, items: visibleAssets.filter(a => a.type === type) }))
      .filter(g => g.items.length > 0)
  ), [visibleAssets]);

  // ── Snapshot stats ──────────────────────────────────────────────────────────
  const snap = useMemo(() => {
    const count = (cond) => scopedAssets.filter(a => a.condition === cond).length;
    return {
      total:    scopedAssets.length,
      excellent: count('Excellent'),
      good:      count('Good'),
      fair:      count('Fair'),
      poorCrit:  count('Poor') + count('Critical'),
    };
  }, [scopedAssets]);

  const areas      = selProp?.areas || [];
  const isFiltered = !!(filterSearch || filterType !== 'All' || filterCond !== 'All' || filterArea !== 'All');

  const clearFilters = () => { setFilterSearch(''); setFilterType('All'); setFilterCond('All'); setFilterArea('All'); };

  // ── CRUD handlers ───────────────────────────────────────────────────────────
  const openNew = () => {
    setForm({ ...EMPTY_ASSET, id: crypto.randomUUID(), propertyId: selectedPropertyId || '', createdAt: today() });
    setErrors({}); setEditingId('new'); setShowModal(true);
  };

  const openEdit = useCallback((asset) => {
    setForm({ ...EMPTY_ASSET, ...asset });
    setErrors({}); setEditingId(asset.id); setShowModal(true);
  }, []);

  const close = () => { setShowModal(false); setForm(EMPTY_ASSET); setEditingId(null); setErrors({}); };

  const save = () => {
    const { ok, errors: errs } = validate(propertyAssetSchema, form);
    if (!ok) { setErrors(errs); return; }
    setErrors({});
    if (editingId === 'new') setProperty('propertyAssets', [...propertyAssets, form]);
    else setProperty('propertyAssets', propertyAssets.map(a => a.id === form.id ? form : a));
    close();
  };

  const deleteAsset = useCallback((id) => {
    const asset = propertyAssets.find(a => a.id === id);
    if (!asset) return;
    const deps = getAssetDependents({ propertyMaintenance }, id);
    setConfirmTarget({ id, message: assetDeleteMessage(asset.name, deps) });
  }, [propertyAssets, propertyMaintenance]);
  const executeDeleteAsset = () => {
    mergeProperty(cascadeDeleteAsset({ propertyAssets, propertyMaintenance }, confirmTarget.id));
    setConfirmTarget(null);
  };

  // ── No properties guard ─────────────────────────────────────────────────────
  if (properties.length === 0) {
    return (
      <div className="page-content">
        <EmptyState
          icon={<Icon name="wrench" size={38} />}
          title="No properties yet. Add a property first to start tracking assets."
        />
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="page-content">

      {/* ── 1. Asset snapshot ────────────────────────────────────────────── */}
      <Card variant="section">
        <SectionHeader
          title={<><Icon name="wrench" size={15} /> Asset Snapshot</>}
          subtitle={scopeLabel}
        />
        <div className="fn-summary">
          <StatTile label="Total"           value={snap.total}     valueClassName={snap.total > 0 ? '' : 'text3'} />
          <StatTile label="Excellent"       value={snap.excellent} valueClassName={snap.excellent > 0 ? 'green' : 'text3'} />
          <StatTile label="Good"            value={snap.good}      valueClassName={snap.good > 0 ? 'teal' : 'text3'} />
          <StatTile label="Fair"            value={snap.fair}      valueClassName={snap.fair > 0 ? '' : 'text3'} />
          <StatTile label="Poor / Critical" value={snap.poorCrit}  valueClassName={snap.poorCrit > 0 ? 'red' : 'text3'} />
        </div>
      </Card>

      {/* ── 3. Filter toolbar ────────────────────────────────────────────── */}
      <Card variant="section">
        <SectionHeader title={<><Icon name="filter" size={15} /> Filters</>} />
        <FilterBar>
          <input
            className="input small"
            style={{ flex: '1 1 160px', minWidth: 140 }}
            placeholder="Search assets…"
            value={filterSearch}
            onChange={e => setFilterSearch(e.target.value)}
          />
          <select className="input small" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="All">All types</option>
            {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="input small" value={filterCond} onChange={e => setFilterCond(e.target.value)}>
            <option value="All">All conditions</option>
            {ASSET_CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {selectedPropertyId !== null && areas.length > 0 && (
            <select className="input small" value={filterArea} onChange={e => setFilterArea(e.target.value)}>
              <option value="All">All areas</option>
              {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          <select className="input small" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="condition">Sort: Condition</option>
            <option value="name">Sort: Name</option>
            <option value="type">Sort: Type</option>
          </select>
        </FilterBar>
        <FilterChips
          chips={[
            { key: 'search', label: filterSearch ? `"${filterSearch}"` : '', onClear: () => setFilterSearch('') },
            { key: 'type', label: filterType !== 'All' ? filterType : '', onClear: () => setFilterType('All') },
            { key: 'condition', label: filterCond !== 'All' ? filterCond : '', onClear: () => setFilterCond('All') },
            { key: 'area', label: filterArea !== 'All' ? (areas.find(a => a.id === filterArea)?.name ?? filterArea) : '', onClear: () => setFilterArea('All') },
          ]}
          onClearAll={clearFilters}
        />
      </Card>

      {/* ── 4. Asset register ────────────────────────────────────────────── */}
      <Card variant="section">
        <SectionHeader
          title={<><Icon name="wrench" size={15} /> Assets</>}
          subtitle={`${visibleAssets.length} asset${visibleAssets.length !== 1 ? 's' : ''}${isFiltered ? ' (filtered)' : ''}`}
          actions={
            <button className="btn-ghost small" onClick={openNew} disabled={!selProp && selectedPropertyId !== null}>
              <Icon name="plus" size={14} /> Add Asset
            </button>
          }
        />
        {visibleAssets.length === 0 ? (
          <EmptyState
            icon={<Icon name="wrench" size={38} />}
            title={
              !selProp && selectedPropertyId !== null
                ? 'Select a property above to view its assets.'
                : scopedAssets.length === 0
                ? 'No assets registered yet. Track your appliances, systems, and fixtures here.'
                : 'No assets match the current filters.'
            }
            action={selProp && <button className="btn-ghost" onClick={openNew}><Icon name="plus" size={14} /> Add Asset</button>}
          />
        ) : (
          <GroupedList
            listClass="fn-list"
            groups={groupedAssets.map(({ type, items }) => ({
              key: type,
              label: type,
              count: items.length,
              items: items.map(asset => {
                const prop = properties.find(p => p.id === asset.propertyId);
                const area = (prop?.areas || []).find(a => a.id === asset.areaId);
                const maintRecords = propertyMaintenance.filter(m => m.propertyId === asset.propertyId);
                return (
                  <AssetRow
                    key={asset.id}
                    asset={asset}
                    area={area}
                    propName={prop?.name}
                    showProp={selectedPropertyId === null && properties.length > 1}
                    maintenanceRecords={maintRecords}
                    onEdit={openEdit}
                    onDelete={deleteAsset}
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
        title={editingId === 'new' ? 'Add Asset / Appliance' : 'Edit Asset'}
        wide
        footer={
          <>
            <button className="btn-ghost" onClick={close}>Cancel</button>
            <button className="btn-primary" onClick={save}>
              {editingId === 'new' ? 'Add Asset' : 'Save'}
            </button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-group full">
            <label>Name *</label>
            <input className={`input${errors.name ? ' input-error' : ''}`} placeholder='e.g. "Lounge Heat Pump", "Hot Water Cylinder"' value={form.name} onChange={e => setField('name', e.target.value)} autoFocus />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>
          <div className="form-group">
            <label>Type</label>
            <select className="input" value={form.type} onChange={e => setField('type', e.target.value)}>
              {ASSET_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Condition</label>
            <select className="input" value={form.condition} onChange={e => setField('condition', e.target.value)}>
              {ASSET_CONDITIONS.map(c => <option key={c}>{c}</option>)}
            </select>
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
            <label>Brand</label>
            <input className="input" placeholder="e.g. Mitsubishi" value={form.brand} onChange={e => setField('brand', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Model</label>
            <input className="input" placeholder="e.g. MSZ-AP25VG" value={form.model} onChange={e => setField('model', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Date Installed</label>
            <input className="input" type="date" value={form.dateInstalled} onChange={e => setField('dateInstalled', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Warranty Expiry</label>
            <input className="input" type="date" value={form.warrantyExpiry} onChange={e => setField('warrantyExpiry', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Expected Lifespan (years)</label>
            <input className={`input${errors.expectedLifespan ? ' input-error' : ''}`} type="number" min="1" placeholder="e.g. 15" value={form.expectedLifespan} onChange={e => setField('expectedLifespan', e.target.value)} />
            {errors.expectedLifespan && <span className="field-error">{errors.expectedLifespan}</span>}
          </div>
          <div className="form-group full">
            <label>Notes (serial number, supplier, etc.)</label>
            <textarea className="input" rows={3} style={{ resize: 'vertical' }} value={form.notes} onChange={e => setField('notes', e.target.value)} />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmTarget}
        title="Delete asset"
        message={confirmTarget?.message || ''}
        onConfirm={executeDeleteAsset}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}

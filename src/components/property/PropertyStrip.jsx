/**
 * PropertyStrip — compact persistent header for the Property section.
 *
 * Mirrors PortfolioStrip: slim strip with dropdown property switcher,
 * meta summary (property count, open tasks), and quick actions.
 *
 * Rendered between the tab bar and page content in App.jsx.
 */
import { useState, useRef, useEffect } from 'react';
import { useProperty } from '../../store/hooks';
import { useNavigate } from '../../contexts/NavigationContext';
import Icon from '../Icon';

const ALL_SCOPE_TABS = new Set(['prop-tasks', 'prop-maint', 'prop-projects', 'prop-assets']);

export default function PropertyStrip({ currentTab, onAddProperty }) {
  const {
    properties: rawProperties,
    propertyTasks,
    selectedPropertyId,
    setProperty,
  } = useProperty();

  const goTab = useNavigate();
  const props = rawProperties || [];
  const tasks = propertyTasks || [];
  const showAll = ALL_SCOPE_TABS.has(currentTab);

  const selected = props.find(p => p.id === selectedPropertyId);

  // Open task count (scoped to selected property, or all)
  const openTasks = tasks.filter(
    t => t.status !== 'Done' && t.status !== 'Cancelled'
      && (selectedPropertyId == null || t.propertyId === selectedPropertyId)
  ).length;

  // ── Dropdown state ──────────────────────────────────────────────────────

  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  // ── Helpers ─────────────────────────────────────────────────────────────

  const selectProperty = (id) => {
    setProperty('selectedPropertyId', id);
    setOpen(false);
  };

  const openTasksFor = (propertyId) =>
    tasks.filter(t => t.propertyId === propertyId && t.status !== 'Done' && t.status !== 'Cancelled').length;

  // ── Empty state ─────────────────────────────────────────────────────────

  if (props.length === 0) {
    return (
      <div className="portfolio-strip">
        <div className="ps-trigger-wrap">
          <span className="ps-empty-label">
            <Icon name="building" size={14} />
            No properties
          </span>
        </div>
        <div style={{ flex: 1 }} />
        <div className="ps-actions">
          <button className="btn-ghost small" onClick={onAddProperty}>+ Add Property</button>
        </div>
      </div>
    );
  }

  // ── Display label ───────────────────────────────────────────────────────

  const triggerLabel = selectedPropertyId == null
    ? 'All Properties'
    : (selected?.name || 'Select property');

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="portfolio-strip" ref={wrapRef}>

      {/* Trigger */}
      <button
        className="ps-trigger"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Icon name="building" size={14} />
        <span className="ps-name">{triggerLabel}</span>
        <Icon name="chevronD" size={10} />
      </button>

      {/* Meta summary */}
      <div className="ps-meta">
        <span className="tag sm">{props.length} {props.length === 1 ? 'property' : 'properties'}</span>
        <span className="tag sm">{openTasks} {openTasks === 1 ? 'task' : 'tasks'}</span>
      </div>

      {/* Actions */}
      <div className="ps-actions">
        <button className="btn-ghost small" onClick={onAddProperty}>+ New</button>
        <button
          className="btn-icon small"
          title="Manage properties"
          onClick={() => goTab('prop-register')}
        >
          <Icon name="settings" size={14} />
        </button>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="ps-dropdown" role="listbox" aria-label="Property list">
          {/* All Properties option (only on scoped tabs with multiple properties) */}
          {showAll && props.length > 1 && (
            <button
              className={`ps-dropdown-item${selectedPropertyId == null ? ' active' : ''}`}
              role="option"
              aria-selected={selectedPropertyId == null}
              onClick={() => selectProperty(null)}
            >
              <span className="ps-dd-name">All Properties</span>
              <span className="ps-dd-right">
                {selectedPropertyId == null && <Icon name="check" size={12} />}
                <span className="tag sm">{props.length}p</span>
              </span>
            </button>
          )}

          {props.map(p => {
            const isSel = p.id === selectedPropertyId;
            const count = openTasksFor(p.id);
            return (
              <button
                key={p.id}
                className={`ps-dropdown-item${isSel ? ' active' : ''}`}
                role="option"
                aria-selected={isSel}
                onClick={() => selectProperty(p.id)}
              >
                <div className="ps-dd-prop-info">
                  <span className="ps-dd-name">{p.name}</span>
                  {p.address && <span className="ps-dd-addr">{p.address}</span>}
                </div>
                <span className="ps-dd-right">
                  {isSel && <Icon name="check" size={12} />}
                  <span className="tag sm">{count}t</span>
                </span>
              </button>
            );
          })}

          <div className="ps-dropdown-divider" />

          <button
            className="ps-dropdown-item ps-manage-link"
            onClick={() => { setOpen(false); goTab('prop-register'); }}
          >
            Manage Properties…
          </button>
        </div>
      )}
    </div>
  );
}

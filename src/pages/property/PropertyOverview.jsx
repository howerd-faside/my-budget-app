import { useMemo } from 'react';
import { useProperty } from '../../store/hooks';
import Icon from '../../components/Icon';
import { SectionHeader, StatTile, EmptyState, Card } from '../../components/ui';

const TODAY = new Date().toISOString().slice(0, 10);

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

const PRIORITY_COLOR = { Urgent: 'var(--red)', High: 'var(--amber)', Medium: 'var(--teal)', Low: 'var(--text3)' };
const PRIORITY_DPILL = { Urgent: 'red', High: 'amber', Medium: 'teal', Low: '' };

export default function PropertyOverview({ onSelectTab }) {
  const {
    properties, propertyTasks, propertyMaintenance, propertyProjects, propertyAssets,
    selectedPropertyId, setProperty,
  } = useProperty();

  const selProp = properties.find(p => p.id === selectedPropertyId) || null;

  // ── Cross-property stats ──────────────────────────────────────────────────
  const crossStats = useMemo(() => properties.map(prop => {
    const tasks   = propertyTasks.filter(t => t.propertyId === prop.id && t.status !== 'Done' && t.status !== 'Cancelled');
    const overdue = tasks.filter(t => t.dueDate && t.dueDate < TODAY);
    return { prop, openTasks: tasks.length, overdueTasks: overdue.length };
  }), [properties, propertyTasks]);

  // ── Per-property detail ───────────────────────────────────────────────────
  const detail = useMemo(() => {
    if (!selProp) return null;
    const id = selProp.id;
    const tasks     = propertyTasks.filter(t => t.propertyId === id);
    const open      = tasks.filter(t => t.status !== 'Done' && t.status !== 'Cancelled');
    const overdue   = open.filter(t => t.dueDate && t.dueDate < TODAY);
    const upcoming  = open
      .filter(t => t.dueDate && t.dueDate >= TODAY && daysBetween(TODAY, t.dueDate) <= 30)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const urgent    = open.filter(t => t.priority === 'Urgent').length;
    const projects  = propertyProjects.filter(p => p.propertyId === id && p.status !== 'Completed' && p.status !== 'Cancelled');
    const recentM   = [...propertyMaintenance]
      .filter(m => m.propertyId === id)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);
    const assetAlerts = propertyAssets.filter(a => {
      if (a.propertyId !== id) return false;
      if (a.condition === 'Poor' || a.condition === 'Critical') return true;
      if (a.warrantyExpiry && daysBetween(TODAY, a.warrantyExpiry) >= 0 && daysBetween(TODAY, a.warrantyExpiry) <= 90) return true;
      return false;
    });
    return { open, overdue, upcoming, urgent, projects, recentM, assetAlerts };
  }, [selProp, propertyTasks, propertyProjects, propertyMaintenance, propertyAssets]);

  if (properties.length === 0) {
    return (
      <div className="page-content">
        <div className="page-header">
          <div>
            <div className="page-title">Property</div>
            <div className="page-sub">Manage your properties, tasks, and maintenance</div>
          </div>
        </div>
        <EmptyState
          icon={<Icon name="building" size={38} />}
          title="No properties yet. Add your first property to start tracking tasks, maintenance, and improvements."
          action={
            <button className="btn-primary" onClick={() => onSelectTab('prop-register')}>
              <Icon name="plus" size={14} /> Add Property
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <div className="page-title">Property</div>
          <div className="page-sub">{properties.length} {properties.length === 1 ? 'property' : 'properties'}</div>
        </div>
        <button className="btn-primary" onClick={() => onSelectTab('prop-register')}>
          <Icon name="plus" size={14} /> Add Property
        </button>
      </div>

      {/* ── Properties ─────────────────────────────────────────────────── */}
      <Card variant="section">
        <SectionHeader
          title="Properties"
          actions={<span className="text3" style={{ fontSize: 11 }}>Click to select</span>}
        />
        <div className="income-grid">
          {crossStats.map(({ prop, openTasks, overdueTasks }) => {
            const isSelected = prop.id === selectedPropertyId;
            return (
              <div
                key={prop.id}
                className="income-card"
                style={{
                  cursor: 'pointer',
                  border: isSelected ? '1px solid var(--teal)' : '1px solid transparent',
                  background: isSelected ? 'rgba(0,113,227,0.04)' : undefined,
                }}
                onClick={() => setProperty('selectedPropertyId', prop.id)}
              >
                <div className="ic-header">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="ic-name">{prop.name}</div>
                    {prop.address && <div className="ic-employer-line">{prop.address}</div>}
                  </div>
                  <div className="ic-tags">
                    <span className="tag">{prop.type || 'Property'}</span>
                    {isSelected && <span className="tag teal">Selected</span>}
                  </div>
                </div>
                <div className="ic-stats" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="ic-stat">
                    <span className="ic-stat-label">Open Tasks</span>
                    <span className={`mono ic-stat-val ${openTasks > 0 ? '' : 'text3'}`}>{openTasks}</span>
                  </div>
                  <div className="ic-stat">
                    <span className="ic-stat-label">Overdue</span>
                    <span className={`mono ic-stat-val ${overdueTasks > 0 ? 'red' : 'text3'}`}>{overdueTasks}</span>
                  </div>
                </div>
                <div className="ic-deductions">
                  <span className="ic-ded" style={{ color: 'var(--text3)' }}>
                    {(prop.areas || []).length} area{(prop.areas || []).length !== 1 ? 's' : ''} ·{' '}
                    {[prop.bedrooms && `${prop.bedrooms} bed`, prop.floorArea && `${prop.floorArea}m²`].filter(Boolean).join(' · ') || 'No profile details'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── Per-property detail ─────────────────────────────────────────── */}
      {selProp && detail && (
        <>
          {/* At a Glance */}
          <Card variant="section">
            <SectionHeader title={`${selProp.name} — At a Glance`} />
            <div className="fn-summary">
              <StatTile label="Open Tasks"     value={detail.open.length}    valueClassName={detail.open.length > 0 ? '' : 'text3'} />
              <StatTile label="Overdue"        value={detail.overdue.length} valueClassName={detail.overdue.length > 0 ? 'red' : 'text3'} />
              <StatTile label="Urgent"         value={detail.urgent}         valueClassName={detail.urgent > 0 ? 'amber' : 'text3'} />
              <StatTile label="Active Projects" value={detail.projects.length} />
            </div>
          </Card>

          {/* Upcoming tasks */}
          <Card variant="section">
            <SectionHeader
              title="Upcoming & Overdue Tasks"
              actions={<button className="btn-ghost small" onClick={() => onSelectTab('prop-tasks')}>View all</button>}
            />

            {detail.overdue.length === 0 && detail.upcoming.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text3)', padding: '4px 0' }}>No upcoming tasks in the next 30 days.</p>
            ) : (
              <div className="expense-list">
                {detail.overdue.map(t => (
                  <div key={t.id} className="expense-row">
                    <div className="exp-cat-bar" style={{ background: 'var(--red)' }} />
                    <div className="exp-main">
                      <div className="exp-top">
                        <div className="exp-info">
                          <span className="exp-name">{t.title}</span>
                          <span className="exp-tags">
                            <span className="tag">{t.category}</span>
                            <span className={`dpill red`}>{Math.abs(daysBetween(TODAY, t.dueDate))}d overdue</span>
                          </span>
                        </div>
                        <div className="exp-right">
                          <span className={`dpill ${PRIORITY_DPILL[t.priority] || ''}`}>{t.priority}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {detail.upcoming.map(t => {
                  const days = daysBetween(TODAY, t.dueDate);
                  return (
                    <div key={t.id} className="expense-row">
                      <div className="exp-cat-bar" style={{ background: PRIORITY_COLOR[t.priority] }} />
                      <div className="exp-main">
                        <div className="exp-top">
                          <div className="exp-info">
                            <span className="exp-name">{t.title}</span>
                            <span className="exp-tags">
                              <span className="tag">{t.category}</span>
                              <span className="tag">{t.dueDate}</span>
                            </span>
                          </div>
                          <div className="exp-right">
                            <span className={`dpill ${days <= 7 ? 'amber' : ''}`} style={days > 7 ? { color: 'var(--text3)' } : {}}>
                              {days}d
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Recent maintenance */}
          <Card variant="section">
            <SectionHeader
              title="Recent Maintenance"
              actions={<button className="btn-ghost small" onClick={() => onSelectTab('prop-maint')}>View all</button>}
            />
            {detail.recentM.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text3)', padding: '4px 0' }}>No maintenance records yet.</p>
            ) : (
              <div className="fn-list">
                {detail.recentM.map(m => (
                  <div key={m.id} className="fn-row">
                    <div className="fn-main" style={{ cursor: 'default' }}>
                      <div className="fn-left">
                        <div className="fn-dates">
                          <div className="fn-label" style={{ fontSize: 13, fontWeight: 500 }}>{m.title}</div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                            <span className="tag">{m.category}</span>
                            {m.performedBy && m.performedBy !== 'Self' && <span className="tag">{m.performedBy}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="fn-right">
                        <span className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>{m.date}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Active projects */}
          {detail.projects.length > 0 && (
            <Card variant="section">
              <SectionHeader
                title="Active Projects"
                actions={<button className="btn-ghost small" onClick={() => onSelectTab('prop-projects')}>View all</button>}
              />
              <div className="fn-list">
                {detail.projects.map(proj => (
                  <div key={proj.id} className="fn-row">
                    <div className="fn-main" style={{ cursor: 'default' }}>
                      <div className="fn-left">
                        <div className="fn-dates">
                          <div className="fn-label" style={{ fontSize: 13, fontWeight: 500 }}>{proj.title}</div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                            <span className="tag">{proj.status}</span>
                            <span className="tag">{proj.priority}</span>
                          </div>
                        </div>
                      </div>
                      {proj.targetEnd && (
                        <div className="fn-right">
                          <span className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>Target {proj.targetEnd}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Alerts */}
          {detail.assetAlerts.length > 0 && (
            <Card variant="section">
              <SectionHeader title="Asset Alerts" />
              <div className="fn-list">
                {detail.assetAlerts.map(a => {
                  const wDays = a.warrantyExpiry ? daysBetween(TODAY, a.warrantyExpiry) : null;
                  const isCond = a.condition === 'Poor' || a.condition === 'Critical';
                  return (
                    <div key={a.id} className="fn-row">
                      <div className="fn-main" style={{ cursor: 'default' }}>
                        <div className="fn-left">
                          <div className="fn-dates">
                            <div className="fn-label" style={{ fontSize: 13, fontWeight: 500 }}>{a.name}</div>
                            <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                              {isCond && <span className={`dpill ${a.condition === 'Critical' ? 'red' : 'amber'}`}>{a.condition} condition</span>}
                              {wDays !== null && wDays >= 0 && wDays <= 90 && (
                                <span className={`dpill ${wDays <= 30 ? 'red' : 'amber'}`}>Warranty expires in {wDays}d</span>
                              )}
                              {wDays !== null && wDays < 0 && (
                                <span className="dpill red">Warranty expired</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

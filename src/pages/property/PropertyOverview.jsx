import { useMemo } from 'react';
import { useProperty } from '../../store/hooks';
import Icon from '../../components/Icon';
import { SectionHeader, StatTile, EmptyState, Card } from '../../components/ui';

const TODAY = new Date().toISOString().slice(0, 10);

const PRIORITY_COLOR_HEX = { Urgent: '#FF3B30', High: '#FF9F0A', Medium: '#0071E3', Low: '#86868B' };

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
    const d30 = new Date(TODAY); d30.setDate(d30.getDate() - 30);
    const thirtyDaysStr = d30.toISOString().slice(0, 10);
    const maintCount30d = propertyMaintenance.filter(m => m.propertyId === id && m.date >= thirtyDaysStr).length;
    return { open, overdue, upcoming, urgent, projects, recentM, assetAlerts, maintCount30d };
  }, [selProp, propertyTasks, propertyProjects, propertyMaintenance, propertyAssets]);

  if (properties.length === 0) {
    return (
      <div className="page-content">
        <EmptyState
          icon={<Icon name="building" size={38} />}
          title="No properties yet. Add your first property to start tracking tasks, maintenance, and improvements."
          action={
            <button className="btn-ghost small" onClick={() => onSelectTab('prop-register')}>
              <Icon name="plus" size={12} /> Add Property
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="page-content">

      {/* ── Properties ─────────────────────────────────────────────────── */}
      <Card variant="section">
        <SectionHeader
          title={<><Icon name="building" size={15} /> Properties</>}
          subtitle={`${properties.length} ${properties.length === 1 ? 'property' : 'properties'} · click to select`}
          actions={<button className="btn-ghost small" onClick={() => onSelectTab('prop-register')}><Icon name="plus" size={12} /> Add Property</button>}
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
          {/* Row 2 — Property Snapshot section */}
          <Card variant="section">
            <SectionHeader title={<><Icon name="building" size={15} /> Property Snapshot</>} subtitle={selProp.name} />
            <div className="fn-summary">
              <StatTile label="Open Tasks"      value={detail.open.length}    valueClassName={detail.open.length > 0 ? '' : 'text3'} />
              <StatTile label="Overdue"         value={detail.overdue.length} valueClassName={detail.overdue.length > 0 ? 'red' : 'text3'} />
              <StatTile label="Urgent"          value={detail.urgent}         valueClassName={detail.urgent > 0 ? 'amber' : 'text3'} />
              <StatTile label="Active Projects" value={detail.projects.length} />
              <StatTile label="Maint. (30d)"    value={detail.maintCount30d} />
              <StatTile label="Asset Alerts"    value={detail.assetAlerts.length} valueClassName={detail.assetAlerts.length > 0 ? 'amber' : 'text3'} />
            </div>
          </Card>

          {/* Row 3 — Task Breakdown */}
          {(() => {
            const priorityCounts = {};
            detail.open.forEach(t => { priorityCounts[t.priority] = (priorityCounts[t.priority] || 0) + 1; });
            const priorityData = ['Urgent', 'High', 'Medium', 'Low']
              .filter(p => priorityCounts[p])
              .map(p => ({ priority: p, count: priorityCounts[p], pct: priorityCounts[p] / detail.open.length }));
            return (
              <Card variant="section">
                <SectionHeader title={<><Icon name="clipboard" size={15} /> Task Breakdown</>} />
                {priorityData.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text3)', padding: '4px 0' }}>No open tasks — all clear.</p>
                ) : (
                  <div className="cat-proportion-wrap">
                    <div className="cat-proportion">
                      {priorityData.map(({ priority, pct }) => (
                        <div
                          key={priority}
                          className="cp-segment"
                          style={{ flex: Math.max(0.02, pct), background: PRIORITY_COLOR_HEX[priority] }}
                          title={`${priority}: ${priorityCounts[priority]}`}
                        />
                      ))}
                    </div>
                    <div className="cat-legend">
                      {priorityData.map(({ priority, count, pct }) => (
                        <div key={priority} className="cl-item">
                          <span className="cl-dot" style={{ background: PRIORITY_COLOR_HEX[priority] }} />
                          <span className="cl-label">{priority}</span>
                          <span className="cl-amt">{count} task{count !== 1 ? 's' : ''}</span>
                          <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                            {(pct * 100).toFixed(0)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })()}

          {/* Row 4 — Operational: tasks (8) + maintenance (4) */}
          <div className="dash-grid">
            <Card variant="section" className="dash-col-8">
              <SectionHeader
                title={<><Icon name="clipboard" size={15} /> Upcoming & Overdue Tasks</>}
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

            <Card variant="section" className="dash-col-4">
              <SectionHeader
                title={<><Icon name="tool" size={15} /> Recent Maintenance</>}
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
          </div>

          {/* Secondary data row: projects + alerts */}
          {(detail.projects.length > 0 || detail.assetAlerts.length > 0) && (
            <div className="dash-grid">
              {detail.projects.length > 0 && (
                <Card variant="section" className={detail.assetAlerts.length > 0 ? 'dash-col-6' : 'dash-col-12'}>
                  <SectionHeader
                    title={<><Icon name="layers" size={15} /> Active Projects</>}
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

              {detail.assetAlerts.length > 0 && (
                <Card variant="section" className={detail.projects.length > 0 ? 'dash-col-6' : 'dash-col-12'}>
                  <SectionHeader title={<><Icon name="alertcir" size={15} /> Asset Alerts</>} />
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
            </div>
          )}
        </>
      )}
    </div>
  );
}

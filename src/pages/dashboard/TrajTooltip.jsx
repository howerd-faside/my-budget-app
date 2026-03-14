import PropTypes from 'prop-types';

/**
 * Custom Recharts tooltip for the savings trajectory chart.
 *
 * @param {object}   props
 * @param {boolean}  props.active   - Whether the tooltip is active (from Recharts)
 * @param {Array}    props.payload  - Chart data payload (from Recharts)
 * @param {string}   props.label    - Current x-axis label / date (from Recharts)
 * @param {Array}    props.goals    - Goals with computed _hitDate fields
 * @param {Array}    props.people   - People array (for income event detection)
 */
const TrajTooltip = ({ active, payload, label, goals, people }) => {
  if (!active || !payload?.length) return null;
  const bal = payload[0]?.value;
  const hit = goals.filter(g => g._hitDate === label);
  // Detect active income events at this month
  const monthDate = label ? new Date(label + '-15') : null;
  const activeEvents = monthDate ? (people || []).flatMap(p =>
    (p.incomeEvents || [])
      .filter(e => e.startDate && new Date(e.startDate) <= monthDate && (!e.endDate || new Date(e.endDate) > monthDate))
      .map(e => ({ ...e, personName: p.name }))
  ) : [];
  return (
    <div className="chart-tt">
      <div className="tt-date">{label}</div>
      <div className="tt-bal">${Math.round(bal).toLocaleString('en-NZ')}</div>
      {activeEvents.map(e => (
        <div key={e.id} style={{ color: '#FF9F0A', fontSize: 10, marginTop: 2, fontWeight: 600 }}>⚑ {e.label} · {e.personName}</div>
      ))}
      {hit.map(g => <div key={g.id} className="tt-goal">🎯 {g.name}</div>)}
    </div>
  );
};

TrajTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.array,
  label: PropTypes.string,
  goals: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    _hitDate: PropTypes.string,
  })).isRequired,
  people: PropTypes.arrayOf(PropTypes.shape({
    name: PropTypes.string,
    incomeEvents: PropTypes.array,
  })),
};

export default TrajTooltip;

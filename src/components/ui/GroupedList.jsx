import { Fragment } from 'react';
import PropTypes from 'prop-types';

/**
 * GroupedList — renders subheader + list-items pattern used across property pages.
 *
 * Props:
 *   groups       — array of { key, label, color?, count, items: ReactNode }
 *   listClass    — CSS class for the list container (default: 'expense-list')
 *   labelElement — optional: render function (group) => ReactNode for the subheader label.
 *                  Defaults to <span style={color}>label</span> + <span className="dpill {color}">count</span>
 */
export default function GroupedList({ groups, listClass = 'expense-list', labelElement }) {
  return groups.map((group, gi) => (
    <Fragment key={group.key}>
      <div className="section-subheader" style={{ marginTop: gi === 0 ? 4 : undefined }}>
        {labelElement ? labelElement(group) : (
          <>
            <span style={group.color ? { color: `var(--${group.color})` } : {}}>
              {group.label}
            </span>
            <span className={group.color ? `dpill ${group.color}` : 'dpill'}>
              {group.count}
            </span>
          </>
        )}
      </div>
      <div className={listClass}>
        {group.items}
      </div>
    </Fragment>
  ));
}

GroupedList.propTypes = {
  groups: PropTypes.arrayOf(PropTypes.shape({
    key: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    color: PropTypes.string,
    count: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    items: PropTypes.node.isRequired,
  })).isRequired,
  listClass: PropTypes.string,
  labelElement: PropTypes.func,
};

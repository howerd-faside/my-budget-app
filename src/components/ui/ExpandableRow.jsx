import { useState, useCallback, memo } from 'react';
import PropTypes from 'prop-types';

/**
 * Shared expand/collapse row component.
 *
 * Manages its own expanded state and renders the outer row container.
 * Supports two usage patterns:
 *
 * 1. fn-row pattern (summary + children as ReactNode):
 *    <ExpandableRow summary={<div className="fn-main">…</div>}>
 *      <div className="exp-detail">…</div>
 *    </ExpandableRow>
 *
 * 2. expense-row pattern (summary as render function for nested detail):
 *    <ExpandableRow className="expense-row" summary={(expanded) => (
 *      <>
 *        <div className="exp-cat-bar" />
 *        <div className="exp-main">
 *          <div className="exp-top">…</div>
 *          {expanded && <div className="exp-detail">…</div>}
 *        </div>
 *      </>
 *    )} />
 *
 * @param {object}                    props
 * @param {React.ReactNode|Function}  props.summary          - Always-visible row content.
 *                                                              Pass a function (expanded) => ReactNode when
 *                                                              the summary needs the expanded state (e.g. to
 *                                                              show/hide a preview or render nested detail).
 * @param {React.ReactNode}           [props.children]        - Expanded detail content (rendered when expanded).
 *                                                              Omit when using the render-function form of summary.
 * @param {boolean}                   [props.defaultExpanded=false] - Initial expanded state
 * @param {string}                    [props.className]       - CSS class(es) for the outer row div (defaults to 'fn-row')
 */
const ExpandableRow = memo(function ExpandableRow({
  summary,
  children,
  defaultExpanded = false,
  className,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const toggle = useCallback(() => setExpanded(prev => !prev), []);

  return (
    <div
      className={`${className || 'fn-row'}${expanded ? ' expanded' : ''}`}
      onClick={toggle}
    >
      {typeof summary === 'function' ? summary(expanded) : summary}
      {expanded && children}
    </div>
  );
});

ExpandableRow.propTypes = {
  summary: PropTypes.oneOfType([PropTypes.node, PropTypes.func]).isRequired,
  children: PropTypes.node,
  defaultExpanded: PropTypes.bool,
  className: PropTypes.string,
};

ExpandableRow.defaultProps = {
  defaultExpanded: false,
};

export default ExpandableRow;

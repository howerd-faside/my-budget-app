/**
 * Card — shared surface wrapper.
 *
 * variant:
 *   'default'  white card, border, shadow-sm  (standalone content block)
 *   'section'  same as .dash-section          (full page section panel)
 *   'flat'     card2 bg, no shadow            (inner / nested surface)
 */
export default function Card({ children, variant = 'default', className = '', style }) {
  const cls = {
    default: 'card-ui',
    section: 'dash-section',
    flat:    'card-ui card-ui--flat',
  }[variant] ?? 'card-ui';

  return (
    <div className={`${cls} ${className}`} style={style}>
      {children}
    </div>
  );
}

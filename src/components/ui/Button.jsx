/**
 * Button — thin wrapper over the global .btn-* classes.
 *
 * variant:  'primary' | 'ghost' | 'icon' | 'ai'
 * size:     'sm' | 'md' (default)
 * danger:   boolean — adds danger hover style (icon variant only)
 */
export default function Button({
  children,
  variant = 'primary',
  size,
  danger = false,
  className = '',
  ...props
}) {
  let base;
  switch (variant) {
    case 'ghost': base = 'btn-ghost'; break;
    case 'icon':  base = 'btn-icon';  break;
    case 'ai':    base = 'btn-ai';    break;
    default:      base = 'btn-primary';
  }

  const sizeClass = size === 'sm' ? 'small' : '';
  const dangerClass = danger && variant === 'icon' ? 'danger' : '';

  const cls = [base, sizeClass, dangerClass, className].filter(Boolean).join(' ');

  return (
    <button className={cls} {...props}>
      {children}
    </button>
  );
}

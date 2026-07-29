import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  block?: boolean;
  /** Icon-only. The label still ships, as the accessible name. */
  iconOnly?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconRight,
  block,
  iconOnly,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    `btn--${variant}`,
    size !== 'md' && `btn--${size}`,
    block && 'btn--block',
    iconOnly && 'btn--icon',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const glyph = size === 'lg' ? 20 : 17;

  return (
    <button type="button" className={classes} {...rest}>
      {icon ? <Icon name={icon} size={glyph} /> : null}
      {iconOnly ? <span className="visually-hidden">{children}</span> : children}
      {iconRight ? <Icon name={iconRight} size={glyph} /> : null}
    </button>
  );
}

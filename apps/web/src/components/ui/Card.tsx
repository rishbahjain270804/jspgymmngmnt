import type { ReactNode } from 'react';

export interface CardProps {
  children: ReactNode;
  /** Pad the card directly. Omit when using CardHead/CardBody. */
  pad?: boolean;
  raised?: boolean;
  className?: string;
  style?: React.CSSProperties;
  as?: 'div' | 'section' | 'article';
}

export function Card({ children, pad, raised, className = '', style, as = 'div' }: CardProps) {
  const Tag = as;
  const classes = ['card', pad && 'card--pad', raised && 'card--raised', className]
    .filter(Boolean)
    .join(' ');
  return (
    <Tag className={classes} style={style}>
      {children}
    </Tag>
  );
}

export function CardHead({
  title,
  sub,
  action,
  id,
}: {
  title: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <div className="card__head">
      <div>
        <div className="card__title" id={id}>
          {title}
        </div>
        {sub ? <div className="card__sub">{sub}</div> : null}
      </div>
      {action}
    </div>
  );
}

export function CardBody({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`card__body ${className}`}>{children}</div>;
}

export function CardFoot({ children }: { children: ReactNode }) {
  return <div className="card__foot">{children}</div>;
}

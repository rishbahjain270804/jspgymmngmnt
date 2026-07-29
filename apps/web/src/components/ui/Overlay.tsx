import { useId } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';
import { useModal } from '../../lib/hooks';

interface BaseProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  sub?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

/** Centred modal. Escape closes, focus is trapped and then restored. */
export function Dialog({ open, onClose, title, sub, children, footer, wide }: BaseProps) {
  const ref = useModal(open, onClose);
  const titleId = useId();
  if (!open) return null;

  return createPortal(
    <div
      className="scrim scrim--center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={`dialog ${wide ? 'dialog--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="dialog__head">
          <div>
            <div className="dialog__title" id={titleId}>
              {title}
            </div>
            {sub ? <div className="card__sub">{sub}</div> : null}
          </div>
          <Button variant="ghost" size="sm" iconOnly icon="x" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="dialog__body">{children}</div>
        {footer ? <div className="dialog__foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

/** Right-hand drawer. Same behaviour, different entrance. */
export function Drawer({ open, onClose, title, sub, children, footer }: BaseProps) {
  const ref = useModal(open, onClose);
  const titleId = useId();
  if (!open) return null;

  return createPortal(
    <div
      className="scrim scrim--right"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="dialog__head">
          <div>
            <div className="dialog__title" id={titleId}>
              {title}
            </div>
            {sub ? <div className="card__sub">{sub}</div> : null}
          </div>
          <Button variant="ghost" size="sm" iconOnly icon="x" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="dialog__body">{children}</div>
        {footer ? <div className="dialog__foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { Icon, type IconName } from './Icon';

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <span className="field__error" role="alert">
          <Icon name="alert" size={12} />
          {error}
        </span>
      ) : hint ? (
        <span className="field__hint">{hint}</span>
      ) : null}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  icon?: IconName;
  affix?: ReactNode;
}

export function Input({ label, hint, error, icon, affix, className = '', ...rest }: InputProps) {
  const auto = useId();
  const id = rest.id ?? auto;

  const control = (
    <div className={icon || affix ? 'field__wrap' : undefined}>
      {icon ? (
        <span className="field__icon">
          <Icon name={icon} size={17} />
        </span>
      ) : null}
      <input
        {...rest}
        id={id}
        className={`input ${error ? 'input--invalid' : ''} ${className}`}
        aria-invalid={error ? true : undefined}
      />
      {affix ? <span className="field__affix">{affix}</span> : null}
    </div>
  );

  if (!label) return control;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      {control}
    </Field>
  );
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}

export function Select({ label, hint, className = '', children, ...rest }: SelectProps) {
  const auto = useId();
  const id = rest.id ?? auto;

  const control = (
    <div className="field__wrap">
      <select {...rest} id={id} className={`input ${className}`}>
        {children}
      </select>
      <span className="field__affix" aria-hidden="true">
        <Icon name="chevron-down" size={15} />
      </span>
    </div>
  );

  if (!label) return control;
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      {control}
    </Field>
  );
}

/**
 * Segmented control. Used for cash/accrual and status filters — the two
 * places the wireframes show a persistent, mutually-exclusive choice.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string; icon?: IconName; count?: number }[];
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="segmented__item"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.icon ? <Icon name={o.icon} size={15} /> : null}
          {o.label}
          {o.count !== undefined ? <span className="tab__count tnum">{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface FormFieldProps {
  label?: string;
  error?: string;
}

export function FormInput({ label, error, className = '', ...props }: FormFieldProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      {label && <div className="text-field-label" style={{ marginBottom: 'var(--space-2)' }}>{label}</div>}
      <input className={`form-input ${error ? 'form-error' : ''} ${className}`} {...props} />
      {error && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger-text)', marginTop: 'var(--space-1)' }}>{error}</div>}
    </div>
  );
}

export function FormTextarea({ label, error, className = '', ...props }: FormFieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      {label && <div className="text-field-label" style={{ marginBottom: 'var(--space-2)' }}>{label}</div>}
      <textarea className={`form-textarea ${error ? 'form-error' : ''} ${className}`} {...props} />
      {error && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger-text)', marginTop: 'var(--space-1)' }}>{error}</div>}
    </div>
  );
}

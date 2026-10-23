import { forwardRef, useId, type InputHTMLAttributes } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
}

export const Field = forwardRef<HTMLInputElement, Props>(function Field({ label, error, hint, className = '', ...rest }, ref) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="label">{label}</label>
      <input
        id={id}
        ref={ref}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        className={`input ${error ? 'input-error' : ''}`}
        {...rest}
      />
      {hint && !error && <p id={`${id}-hint`} className="mt-1.5 text-xs text-milk/50">{hint}</p>}
      {error && <p id={`${id}-err`} role="alert" className="field-error">{error}</p>}
    </div>
  )
})

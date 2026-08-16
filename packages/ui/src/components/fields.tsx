"use client";

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes, useId } from "react";
import styles from "./fields.module.css";

/* ------------------------------------------------------------------ */
/* Input                                                                */
/* ------------------------------------------------------------------ */

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, helper, className, id, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const helperId = helper ? `${inputId}-helper` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  return (
    <div className={[styles.field, className].filter(Boolean).join(" ")}>
      {label ? (
        <label className={styles.label} htmlFor={inputId}>
          {label}
        </label>
      ) : null}
      <input
        ref={ref}
        id={inputId}
        className={[styles.input, error ? styles.inputError : ""].filter(Boolean).join(" ")}
        aria-invalid={error ? true : undefined}
        aria-describedby={[helperId, errorId].filter(Boolean).join(" ") || undefined}
        {...rest}
      />
      {helper && !error ? (
        <p className={styles.helper} id={helperId}>{helper}</p>
      ) : null}
      {error ? (
        <p className={styles.error} id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* Textarea                                                             */
/* ------------------------------------------------------------------ */

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, className, id, ...rest },
  ref,
) {
  const autoId = useId();
  const areaId = id ?? autoId;
  return (
    <div className={[styles.field, className].filter(Boolean).join(" ")}>
      {label ? (
        <label className={styles.label} htmlFor={areaId}>{label}</label>
      ) : null}
      <textarea
        ref={ref}
        id={areaId}
        className={[styles.input, styles.textarea, error ? styles.inputError : ""].filter(Boolean).join(" ")}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* Select                                                               */
/* ------------------------------------------------------------------ */

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, options, placeholder, className, id, ...rest },
  ref,
) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className={[styles.field, className].filter(Boolean).join(" ")}>
      {label ? (
        <label className={styles.label} htmlFor={selectId}>{label}</label>
      ) : null}
      <select
        ref={ref}
        id={selectId}
        className={[styles.input, styles.select, error ? styles.inputError : ""].filter(Boolean).join(" ")}
        aria-invalid={error ? true : undefined}
        {...rest}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
    </div>
  );
});

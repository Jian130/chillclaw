import { forwardRef } from "react";
import type { InputHTMLAttributes, PropsWithChildren, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function FieldLabel(props: PropsWithChildren<{ htmlFor?: string; className?: string }>) {
  return (
    <label className={`field__label ${props.className ?? ""}`.trim()} htmlFor={props.htmlFor}>
      {props.children}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(props, ref) {
  const { className = "", ...rest } = props;
  return <input ref={ref} className={`field__control ${className}`.trim()} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(props, ref) {
  const { className = "", ...rest } = props;
  return <textarea ref={ref} className={`field__control field__control--textarea ${className}`.trim()} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(props, ref) {
  const { className = "", ...rest } = props;
  return <select ref={ref} className={`field__control ${className}`.trim()} {...rest} />;
});

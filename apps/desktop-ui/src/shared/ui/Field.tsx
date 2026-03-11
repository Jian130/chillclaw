import type { InputHTMLAttributes, PropsWithChildren, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function FieldLabel(props: PropsWithChildren<{ htmlFor?: string; className?: string }>) {
  return (
    <label className={`field__label ${props.className ?? ""}`.trim()} htmlFor={props.htmlFor}>
      {props.children}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input className={`field__control ${className}`.trim()} {...rest} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return <textarea className={`field__control field__control--textarea ${className}`.trim()} {...rest} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", ...rest } = props;
  return <select className={`field__control ${className}`.trim()} {...rest} />;
}

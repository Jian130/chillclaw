import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export function Button(
  props: PropsWithChildren<
    ButtonHTMLAttributes<HTMLButtonElement> & {
      variant?: Variant;
      size?: Size;
      fullWidth?: boolean;
    }
  >
) {
  const { className = "", variant = "primary", size = "md", fullWidth = false, ...rest } = props;
  return (
    <button
      className={`button button--${variant} button--${size}${fullWidth ? " button--full" : ""} ${className}`.trim()}
      {...rest}
    />
  );
}

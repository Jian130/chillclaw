import type { HTMLAttributes, PropsWithChildren } from "react";

export function Badge(
  props: PropsWithChildren<HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "success" | "warning" | "info" }>
) {
  const { className = "", tone = "neutral", ...rest } = props;
  return <span className={`badge badge--${tone} ${className}`.trim()} {...rest} />;
}

import { Badge } from "./Badge.js";

export function StatusPill(props: { tone: "success" | "warning" | "danger" | "neutral" | "info"; children: string }) {
  const map = {
    success: "success",
    warning: "warning",
    danger: "warning",
    neutral: "neutral",
    info: "info"
  } as const;

  return <Badge tone={map[props.tone]}>{props.children}</Badge>;
}

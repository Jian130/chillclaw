import { Button } from "./Button.js";

export function EmptyState(props: { title: string; description: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="empty-state">
      <h3>{props.title}</h3>
      <p>{props.description}</p>
      {props.actionLabel && props.onAction ? (
        <Button onClick={props.onAction} variant="outline">
          {props.actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

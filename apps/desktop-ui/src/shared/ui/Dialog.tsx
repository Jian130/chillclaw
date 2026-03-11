import type { PropsWithChildren } from "react";

export function Dialog(props: PropsWithChildren<{ open: boolean; onClose: () => void; title: string; description?: string; wide?: boolean }>) {
  if (!props.open) {
    return null;
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <div className={`dialog${props.wide ? " dialog--wide" : ""}`}>
        <div className="dialog__header">
          <div>
            <h3>{props.title}</h3>
            {props.description ? <p>{props.description}</p> : null}
          </div>
          <button className="dialog__close" onClick={props.onClose} type="button">
            ×
          </button>
        </div>
        <div className="dialog__body">{props.children}</div>
      </div>
    </div>
  );
}

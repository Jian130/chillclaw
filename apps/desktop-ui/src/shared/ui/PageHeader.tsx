import type { PropsWithChildren } from "react";

export function PageHeader(props: PropsWithChildren<{ title: string; subtitle: string; actions?: React.ReactNode }>) {
  return (
    <div className="page-header">
      <div>
        <h1>{props.title}</h1>
        <p>{props.subtitle}</p>
      </div>
      {props.actions ? <div className="page-header__actions">{props.actions}</div> : null}
    </div>
  );
}

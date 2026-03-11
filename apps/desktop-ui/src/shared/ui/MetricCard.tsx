export function MetricCard(props: { label: string; value: string | number; detail?: string; accent?: string }) {
  return (
    <div className="metric-card" style={props.accent ? ({ ["--metric-accent" as string]: props.accent } as React.CSSProperties) : undefined}>
      <p className="metric-card__label">{props.label}</p>
      <strong className="metric-card__value">{props.value}</strong>
      {props.detail ? <p className="metric-card__detail">{props.detail}</p> : null}
    </div>
  );
}

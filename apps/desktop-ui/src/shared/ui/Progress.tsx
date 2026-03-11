export function Progress(props: { value: number; label?: string }) {
  return (
    <div className="progress">
      {props.label ? <div className="progress__label">{props.label}</div> : null}
      <div className="progress__track">
        <div className="progress__fill" style={{ width: `${Math.min(100, Math.max(0, props.value))}%` }} />
      </div>
    </div>
  );
}

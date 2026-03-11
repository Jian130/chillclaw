interface SwitchProps {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  label?: string;
}

export function Switch(props: SwitchProps) {
  return (
    <button
      aria-pressed={props.checked}
      className={`switch${props.checked ? " switch--checked" : ""}`}
      onClick={() => props.onCheckedChange(!props.checked)}
      type="button"
    >
      <span className="switch__thumb" />
      {props.label ? <span className="switch__label">{props.label}</span> : null}
    </button>
  );
}

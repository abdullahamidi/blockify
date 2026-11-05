import type { BrickColor } from '../../engine/palette';

interface Props {
  label: string;
  value: string;
  colors: BrickColor[];
  onChange: (id: string) => void;
}

export function ColorPicker({ label, value, colors, onChange }: Props) {
  const current = colors.find((c) => c.id === value);
  return (
    <div className="field">
      <div className="field-label">
        {label} <span className="muted">· {current?.name ?? ''}</span>
      </div>
      <div className="swatches" role="radiogroup" aria-label={label}>
        {colors.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={c.id === value}
            aria-label={c.name}
            title={c.name}
            className={`swatch ${c.id === value ? 'active' : ''}`}
            style={{ background: c.hex }}
            onClick={() => onChange(c.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface SegProps<T extends string> {
  label: string;
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (v: T) => void;
}

export function Segmented<T extends string>({ label, value, options, labels, onChange }: SegProps<T>) {
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={o === value}
            className={o === value ? 'active' : ''}
            onClick={() => onChange(o)}
          >
            {labels[o]}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}

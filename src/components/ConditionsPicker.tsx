import { useState } from 'react';
import { CONDITIONS } from '../types';

export default function ConditionsPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [other, setOther] = useState('');
  const custom = value.filter((c) => !(CONDITIONS as readonly string[]).includes(c));

  function toggle(c: string) {
    onChange(value.includes(c) ? value.filter((x) => x !== c) : [...value, c]);
  }

  function addOther() {
    const t = other.trim();
    if (t && !value.some((c) => c.toLowerCase() === t.toLowerCase())) {
      onChange([...value, t]);
    }
    setOther('');
  }

  return (
    <div className="conditions-picker">
      <div className="tag-row">
        {CONDITIONS.map((c) => (
          <button
            key={c}
            type="button"
            className={'tag-toggle' + (value.includes(c) ? ' on' : '')}
            onClick={() => toggle(c)}
          >
            {c}
          </button>
        ))}
        {custom.map((c) => (
          <button key={c} type="button" className="tag-toggle on" onClick={() => toggle(c)}>
            {c} ✕
          </button>
        ))}
      </div>
      <div className="field-row other-row">
        <input
          placeholder="Other condition…"
          value={other}
          onChange={(e) => setOther(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addOther();
            }
          }}
        />
        <button type="button" className="btn btn-sm" onClick={addOther} disabled={!other.trim()}>
          Add
        </button>
      </div>
    </div>
  );
}

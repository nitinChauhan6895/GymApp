import { useState } from 'react';
import { SPECIAL_PROGRAMS } from '../types';

const OTHER = '__other__';

export default function ProgramSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const isPreset = value === '' || (SPECIAL_PROGRAMS as readonly string[]).includes(value);
  const [otherMode, setOtherMode] = useState(!isPreset);

  return (
    <label className="field">
      <span>Special Program (optional)</span>
      {!otherMode ? (
        <select
          value={value}
          onChange={(e) => {
            if (e.target.value === OTHER) {
              setOtherMode(true);
              onChange('');
            } else {
              onChange(e.target.value);
            }
          }}
        >
          <option value="">None</option>
          {SPECIAL_PROGRAMS.map((p) => (
            <option key={p}>{p}</option>
          ))}
          <option value={OTHER}>Other…</option>
        </select>
      ) : (
        <div className="field-row other-row">
          <input
            autoFocus
            placeholder="Program name…"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              setOtherMode(false);
              onChange('');
            }}
          >
            List
          </button>
        </div>
      )}
    </label>
  );
}

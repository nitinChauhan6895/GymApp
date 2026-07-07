import { useState } from 'react';
import { extendMembership } from '../data';
import type { Member, Membership } from '../types';
import { addDays, formatDate } from '../utils';
import Modal from './Modal';

const QUICK = [3, 7, 15, 30];

export default function ExtendModal({
  member,
  membership,
  onClose,
}: {
  member: Member;
  membership: Membership;
  onClose: () => void;
}) {
  const [days, setDays] = useState('7');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const n = Math.round(Number(days) || 0);

  async function save() {
    if (n <= 0 || saving) return;
    setSaving(true);
    await extendMembership(membership.id!, n, reason.trim() || undefined);
    onClose();
  }

  return (
    <Modal title={`Add Extra Days — ${member.fullName}`} onClose={onClose}>
      <div className="chip-row">
        {QUICK.map((q) => (
          <button
            key={q}
            className={'chip' + (n === q ? ' chip-active' : '')}
            onClick={() => setDays(String(q))}
          >
            +{q} days
          </button>
        ))}
      </div>
      <div className="field-row">
        <label className="field">
          <span>Days to add</span>
          <input type="number" min="1" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
        </label>
        <label className="field">
          <span>Reason</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Gym closed, goodwill…" />
        </label>
      </div>
      <div className="summary-box">
        <div>
          <span>Current expiry</span>
          <strong>{formatDate(membership.endDate)}</strong>
        </div>
        <div>
          <span>New expiry</span>
          <strong>{n > 0 ? formatDate(addDays(membership.endDate, n)) : '—'}</strong>
        </div>
      </div>
      <button className="btn btn-primary btn-block" disabled={n <= 0 || saving} onClick={save}>
        {saving ? 'Saving…' : `Add ${n > 0 ? n : ''} Day${n === 1 ? '' : 's'}`}
      </button>
    </Modal>
  );
}

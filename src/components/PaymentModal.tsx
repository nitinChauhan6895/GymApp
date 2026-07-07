import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { recordPayment } from '../data';
import type { Member, Membership, PaymentMode } from '../types';
import { PAYMENT_MODES } from '../types';
import { money } from '../utils';
import Modal from './Modal';

export default function PaymentModal({
  member,
  membership,
  outstanding,
  onClose,
}: {
  member: Member;
  membership: Membership | null;
  outstanding?: number;
  onClose: () => void;
}) {
  const employees = useLiveQuery(() => db.employees.toArray(), []) || [];
  const [amount, setAmount] = useState(outstanding && outstanding > 0 ? String(outstanding) : '');
  const [mode, setMode] = useState<PaymentMode>('Cash');
  const [discount, setDiscount] = useState('');
  const [reference, setReference] = useState('');
  const [remarks, setRemarks] = useState('');
  const [recordedBy, setRecordedBy] = useState('');
  const [saving, setSaving] = useState(false);

  const amt = Number(amount) || 0;

  async function save() {
    if (amt <= 0 || saving) return;
    setSaving(true);
    await recordPayment({
      memberId: member.id!,
      membershipId: membership?.id ?? null,
      amount: amt,
      mode,
      discount: Number(discount) || 0,
      reference: reference || undefined,
      remarks: remarks || undefined,
      recordedBy: recordedBy || undefined,
    });
    onClose();
  }

  return (
    <Modal title={`Record Payment — ${member.fullName}`} onClose={onClose}>
      {outstanding !== undefined && outstanding > 0 && (
        <div className="hint">Outstanding balance: <strong>{money(outstanding)}</strong></div>
      )}
      <div className="field-row">
        <label className="field">
          <span>Amount (₹)</span>
          <input type="number" min="0" inputMode="numeric" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="field">
          <span>Payment Mode</span>
          <select value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)}>
            {PAYMENT_MODES.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="field-row">
        <label className="field">
          <span>Discount (₹)</span>
          <input type="number" min="0" inputMode="numeric" value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </label>
        <label className="field">
          <span>Reference #</span>
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UPI ref, cheque…" />
        </label>
      </div>
      <label className="field">
        <span>Remarks</span>
        <input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional" />
      </label>
      {employees.length > 0 && (
        <label className="field">
          <span>Recorded By</span>
          <select value={recordedBy} onChange={(e) => setRecordedBy(e.target.value)}>
            <option value="">—</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.name}>
                {emp.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <button className="btn btn-primary btn-block" disabled={amt <= 0 || saving} onClick={save}>
        {saving ? 'Saving…' : `Record ${amt > 0 ? money(amt) : 'Payment'}`}
      </button>
    </Modal>
  );
}

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { renewMembership } from '../data';
import type { Member, Membership, PaymentMode } from '../types';
import { PAYMENT_MODES } from '../types';
import { addMonths, formatDate, money, todayISO } from '../utils';
import Modal from './Modal';

export default function RenewModal({
  member,
  current,
  onClose,
}: {
  member: Member;
  current: Membership | null;
  onClose: () => void;
}) {
  const packages = useLiveQuery(() => db.packages.filter((p) => p.active).toArray(), []) || [];
  const employees = useLiveQuery(() => db.employees.toArray(), []) || [];
  const [packageId, setPackageId] = useState<number | ''>('');
  const [discount, setDiscount] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [mode, setMode] = useState<PaymentMode>('Cash');
  const [reference, setReference] = useState('');
  const [recordedBy, setRecordedBy] = useState('');
  const [saving, setSaving] = useState(false);
  const [touchedAmount, setTouchedAmount] = useState(false);

  const pkg = packages.find((p) => p.id === packageId);
  const disc = Number(discount) || 0;
  const finalPrice = pkg ? Math.max(0, pkg.price - disc) : 0;

  const newDates = useMemo(() => {
    if (!pkg) return null;
    const base = current && current.endDate >= todayISO() ? current.endDate : todayISO();
    return { start: base, end: addMonths(base, pkg.durationMonths) };
  }, [pkg, current]);

  const effectiveAmount = touchedAmount ? Number(amountPaid) || 0 : finalPrice;

  async function save() {
    if (!pkg || saving) return;
    setSaving(true);
    await renewMembership({
      memberId: member.id!,
      pkg,
      discount: disc,
      amountPaid: effectiveAmount,
      paymentMode: mode,
      reference: reference || undefined,
      recordedBy: recordedBy || undefined,
    });
    onClose();
  }

  return (
    <Modal title={`Renew — ${member.fullName}`} onClose={onClose}>
      <label className="field">
        <span>Package</span>
        <select value={packageId} onChange={(e) => setPackageId(Number(e.target.value) || '')}>
          <option value="">Choose package…</option>
          {packages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {money(p.price)}
            </option>
          ))}
        </select>
      </label>
      <div className="field-row">
        <label className="field">
          <span>Discount (₹)</span>
          <input type="number" min="0" inputMode="numeric" value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </label>
        <label className="field">
          <span>Amount Paid (₹)</span>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            value={touchedAmount ? amountPaid : finalPrice || ''}
            onChange={(e) => {
              setTouchedAmount(true);
              setAmountPaid(e.target.value);
            }}
          />
        </label>
      </div>
      <div className="field-row">
        <label className="field">
          <span>Payment Mode</span>
          <select value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)}>
            {PAYMENT_MODES.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Reference #</span>
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" />
        </label>
      </div>
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
      {pkg && newDates && (
        <div className="summary-box">
          <div>
            <span>New expiry</span>
            <strong>{formatDate(newDates.end)}</strong>
          </div>
          <div>
            <span>Price after discount</span>
            <strong>{money(finalPrice)}</strong>
          </div>
          {effectiveAmount < finalPrice && (
            <div>
              <span>Balance due</span>
              <strong className="due">{money(finalPrice - effectiveAmount)}</strong>
            </div>
          )}
        </div>
      )}
      <button className="btn btn-primary btn-block" disabled={!pkg || saving} onClick={save}>
        {saving ? 'Saving…' : 'Confirm Renewal'}
      </button>
    </Modal>
  );
}

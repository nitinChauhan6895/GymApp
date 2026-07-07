import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { createMember, logActivity } from '../data';
import type { Gender, PaymentMode } from '../types';
import { PAYMENT_MODES } from '../types';
import { fileToDataUrl, money, normPhone, todayISO } from '../utils';
import Avatar from '../components/Avatar';
import ConditionsPicker from '../components/ConditionsPicker';
import PageHeader from '../components/PageHeader';
import ProgramSelect from '../components/ProgramSelect';

export default function MemberForm() {
  const { id } = useParams();
  const editId = id ? Number(id) : null;
  const navigate = useNavigate();
  const packages = useLiveQuery(() => db.packages.filter((p) => p.active).toArray(), []) || [];

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState<Gender>('');
  const [dob, setDob] = useState('');
  const [address, setAddress] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [photo, setPhoto] = useState<string | undefined>();
  const [conditions, setConditions] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  // membership (new member only)
  const [packageId, setPackageId] = useState<number | ''>('');
  const [finalAmount, setFinalAmount] = useState('');
  const [touchedFinal, setTouchedFinal] = useState(false);
  const [program, setProgram] = useState('');
  const [joiningDate, setJoiningDate] = useState(todayISO());
  const [amountPaid, setAmountPaid] = useState('');
  const [touchedAmount, setTouchedAmount] = useState(false);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('Cash');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editId) return;
    db.members.get(editId).then((m) => {
      if (!m) return;
      setFullName(m.fullName);
      setPhone(m.phone);
      setEmail(m.email || '');
      setGender(m.gender || '');
      setDob(m.dob || '');
      setAddress(m.address || '');
      setEmergencyContact(m.emergencyContact || '');
      setPhoto(m.photo);
      setConditions(m.conditions || []);
      setNotes(m.notes || '');
    });
  }, [editId]);

  const pkg = packages.find((p) => p.id === packageId);
  const effectiveFinal = touchedFinal ? Number(finalAmount) || 0 : pkg?.price ?? 0;
  const autoDiscount = pkg ? Math.max(0, pkg.price - effectiveFinal) : 0;
  const effectiveAmount = touchedAmount ? amountPaid : pkg ? String(effectiveFinal) : '';

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    try {
      setPhoto(await fileToDataUrl(file));
    } catch {
      setError('Could not read that image.');
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!fullName.trim() || !phone.trim()) {
      setError('Name and phone are required.');
      return;
    }
    const dup = await db.members
      .filter((m) => !m.deletedAt && m.id !== editId && normPhone(m.phone) === normPhone(phone))
      .first();
    if (dup) {
      setError(`Phone already belongs to ${dup.fullName}.`);
      return;
    }
    setSaving(true);
    const memberFields = {
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      gender,
      dob: dob || undefined,
      address: address.trim() || undefined,
      emergencyContact: emergencyContact.trim() || undefined,
      photo,
      conditions,
      notes: notes.trim() || undefined,
    };
    if (editId) {
      await db.members.update(editId, memberFields);
      await logActivity('member', `Member updated: ${memberFields.fullName}`);
      navigate(`/members/${editId}`, { replace: true });
    } else {
      const newId = await createMember({
        member: memberFields,
        packageId: packageId || undefined,
        finalAmount: packageId ? effectiveFinal : undefined,
        specialProgram: program.trim() || undefined,
        joiningDate,
        amountPaid: Number(effectiveAmount) || 0,
        paymentMode,
      });
      navigate(`/members/${newId}`, { replace: true });
    }
  }

  return (
    <div className="page">
      <PageHeader title={editId ? 'Edit Member' : 'Add Member'} back />
      <form onSubmit={submit} className="form">
        <div className="photo-row">
          <Avatar name={fullName || '?'} photo={photo} size={64} />
          <label className="btn btn-sm">
            {photo ? 'Change Photo' : 'Add Photo'}
            <input type="file" accept="image/*" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
          </label>
        </div>

        <h2 className="section-title">Personal Details</h2>
        <label className="field">
          <span>Full Name *</span>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required autoFocus={!editId} />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Phone *</span>
            <input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </label>
          <label className="field">
            <span>Gender</span>
            <select value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
              <option value="">—</option>
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </select>
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span>Date of Birth</span>
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>Address</span>
          <input value={address} onChange={(e) => setAddress(e.target.value)} />
        </label>
        <label className="field">
          <span>Emergency Contact</span>
          <input type="tel" inputMode="tel" value={emergencyContact} onChange={(e) => setEmergencyContact(e.target.value)} />
        </label>
        <label className="field">
          <span>Health Conditions</span>
        </label>
        <ConditionsPicker value={conditions} onChange={setConditions} />
        <label className="field">
          <span>Notes</span>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        {!editId && (
          <>
            <h2 className="section-title">Membership &amp; Payment</h2>
            <div className="field-row">
              <label className="field">
                <span>Package</span>
                <select value={packageId} onChange={(e) => setPackageId(Number(e.target.value) || '')}>
                  <option value="">No package yet</option>
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {money(p.price)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Joining Date</span>
                <input type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} />
              </label>
            </div>
            {pkg && (
              <>
                <ProgramSelect value={program} onChange={setProgram} />
                <div className="field-row">
                  <label className="field">
                    <span>Final Amount (₹)</span>
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={touchedFinal ? finalAmount : String(pkg.price)}
                      onChange={(e) => {
                        setTouchedFinal(true);
                        setFinalAmount(e.target.value);
                      }}
                    />
                  </label>
                  <label className="field">
                    <span>Amount Paid (₹)</span>
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={effectiveAmount}
                      onChange={(e) => {
                        setTouchedAmount(true);
                        setAmountPaid(e.target.value);
                      }}
                    />
                  </label>
                </div>
                <label className="field">
                  <span>Payment Mode</span>
                  <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}>
                    {PAYMENT_MODES.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </label>
                <div className="hint">
                  Package price {money(pkg.price)} − final amount {money(effectiveFinal)} ={' '}
                  <strong>discount {money(autoDiscount)}</strong>
                </div>
              </>
            )}
          </>
        )}

        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary btn-block" type="submit" disabled={saving}>
          {saving ? 'Saving…' : editId ? 'Save Changes' : 'Create Member'}
        </button>
      </form>
    </div>
  );
}

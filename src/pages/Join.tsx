import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { logActivity } from '../data';
import type { Gender } from '../types';
import { normPhone, nowISO } from '../utils';
import ConditionsPicker from '../components/ConditionsPicker';

/**
 * Kiosk self-registration: staff opens this screen and hands the device to
 * the member. No navigation is rendered, so the member can't browse gym data.
 */
export default function Join() {
  const navigate = useNavigate();
  const settings = useLiveQuery(() => db.settings.get(1));
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState<Gender>('');
  const [dob, setDob] = useState('');
  const [address, setAddress] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [conditions, setConditions] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  function reset() {
    setFullName('');
    setPhone('');
    setEmail('');
    setGender('');
    setDob('');
    setAddress('');
    setEmergencyContact('');
    setConditions([]);
    setError('');
    setDone(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!fullName.trim() || !phone.trim()) {
      setError('Please fill your name and phone number.');
      return;
    }
    const dup = await db.members
      .filter((m) => !m.deletedAt && normPhone(m.phone) === normPhone(phone))
      .first();
    if (dup) {
      setError('This phone number is already registered. Please ask at the front desk.');
      return;
    }
    setSaving(true);
    await db.members.add({
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      gender,
      dob: dob || undefined,
      address: address.trim() || undefined,
      emergencyContact: emergencyContact.trim() || undefined,
      conditions,
      notes: 'Self-registered',
      createdAt: nowISO(),
      deletedAt: null,
    });
    await logActivity('member', `Self-registration: ${fullName.trim()}`);
    setSaving(false);
    setDone(fullName.trim());
  }

  if (done) {
    return (
      <div className="page join-page">
        <div className="empty-state join-done">
          <h1>🎉 Welcome, {done}!</h1>
          <p>Your details are saved. Please hand the device back to the staff to choose your membership plan.</p>
          <button className="btn btn-primary" onClick={reset}>
            Register another person
          </button>
          <button className="btn btn-sm" onClick={() => navigate('/members')}>
            Staff: back to app
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page join-page">
      <header className="page-header hero">
        <div>
          <p className="muted">{settings?.gymName || 'Welcome'}</p>
          <h1>New Member Registration</h1>
        </div>
        {settings?.logo && <img src={settings.logo} alt="" className="avatar" style={{ width: 44, height: 44 }} />}
      </header>
      <p className="muted">Fill in your details below — it takes under a minute.</p>
      <form onSubmit={submit} className="form">
        <label className="field">
          <span>Full Name *</span>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required autoFocus />
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
          <span>Any health conditions we should know about?</span>
        </label>
        <ConditionsPicker value={conditions} onChange={setConditions} />
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary btn-block" type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Submit Registration'}
        </button>
      </form>
    </div>
  );
}

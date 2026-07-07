import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { downloadBlob, fileToDataUrl, todayISO } from '../utils';
import PageHeader from '../components/PageHeader';

export default function Settings() {
  const settings = useLiveQuery(() => db.settings.get(1));
  const employees = useLiveQuery(() => db.employees.toArray(), []) || [];
  const [gymName, setGymName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);
  const [empName, setEmpName] = useState('');
  const [empRole, setEmpRole] = useState<'Owner' | 'Employee'>('Employee');
  const restoreRef = useRef<HTMLInputElement>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (settings && !loaded.current) {
      loaded.current = true;
      setGymName(settings.gymName);
      setAddress(settings.address);
      setPhone(settings.phone);
    }
  }, [settings]);

  async function saveGym() {
    await db.settings.update(1, { gymName, address, phone });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }

  async function onLogo(file: File | undefined) {
    if (!file) return;
    const logo = await fileToDataUrl(file, 256);
    await db.settings.update(1, { logo });
  }

  async function toggleNotifications() {
    if (!settings) return;
    if (!settings.notificationsEnabled) {
      if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
          alert('Notification permission was denied by the browser.');
          return;
        }
      }
      await db.settings.update(1, { notificationsEnabled: true });
    } else {
      await db.settings.update(1, { notificationsEnabled: false });
    }
  }

  async function addEmployee() {
    if (!empName.trim()) return;
    await db.employees.add({ name: empName.trim(), role: empRole });
    setEmpName('');
  }

  async function backup() {
    const dump = {
      version: 1,
      exportedAt: new Date().toISOString(),
      members: await db.members.toArray(),
      packages: await db.packages.toArray(),
      memberships: await db.memberships.toArray(),
      payments: await db.payments.toArray(),
      employees: await db.employees.toArray(),
      campaigns: await db.campaigns.toArray(),
      activities: await db.activities.toArray(),
      settings: await db.settings.toArray(),
    };
    downloadBlob(new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' }), `gymapp-backup-${todayISO()}.json`);
  }

  async function restore(file: File | undefined) {
    if (!file) return;
    if (!confirm('Restoring replaces ALL current data with the backup. Continue?')) return;
    try {
      const dump = JSON.parse(await file.text());
      await db.transaction(
        'rw',
        [db.members, db.packages, db.memberships, db.payments, db.employees, db.campaigns, db.activities, db.settings],
        async () => {
          await Promise.all([
            db.members.clear(),
            db.packages.clear(),
            db.memberships.clear(),
            db.payments.clear(),
            db.employees.clear(),
            db.campaigns.clear(),
            db.activities.clear(),
            db.settings.clear(),
          ]);
          await db.members.bulkAdd(dump.members || []);
          await db.packages.bulkAdd(dump.packages || []);
          await db.memberships.bulkAdd(dump.memberships || []);
          await db.payments.bulkAdd(dump.payments || []);
          await db.employees.bulkAdd(dump.employees || []);
          await db.campaigns.bulkAdd(dump.campaigns || []);
          await db.activities.bulkAdd(dump.activities || []);
          await db.settings.bulkAdd(dump.settings || []);
        }
      );
      loaded.current = false;
      alert('Backup restored.');
    } catch (err) {
      alert('Restore failed: ' + (err instanceof Error ? err.message : 'invalid file'));
    }
  }

  return (
    <div className="page">
      <PageHeader title="Settings" />

      <h2 className="section-title">Gym Details</h2>
      <div className="card form">
        <div className="photo-row">
          {settings?.logo ? (
            <img src={settings.logo} alt="Logo" className="avatar" style={{ width: 56, height: 56 }} />
          ) : (
            <div className="avatar avatar-initials" style={{ width: 56, height: 56 }}>
              🏋️
            </div>
          )}
          <label className="btn btn-sm">
            {settings?.logo ? 'Change Logo' : 'Upload Logo'}
            <input type="file" accept="image/*" hidden onChange={(e) => onLogo(e.target.files?.[0])} />
          </label>
        </div>
        <label className="field">
          <span>Business Name</span>
          <input value={gymName} onChange={(e) => setGymName(e.target.value)} />
        </label>
        <label className="field">
          <span>Address</span>
          <input value={address} onChange={(e) => setAddress(e.target.value)} />
        </label>
        <label className="field">
          <span>Phone</span>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <button className="btn btn-primary" onClick={saveGym}>
          {savedFlash ? '✓ Saved' : 'Save Details'}
        </button>
      </div>

      <h2 className="section-title">Manage</h2>
      <div className="card">
        <Link to="/settings/packages" className="list-row list-row-btn">
          <strong>📦 Membership Packages</strong>
          <span className="muted">→</span>
        </Link>
        <Link to="/settings/import" className="list-row list-row-btn">
          <strong>📥 Import Members (Excel)</strong>
          <span className="muted">→</span>
        </Link>
        <Link to="/reports" className="list-row list-row-btn">
          <strong>📊 Reports</strong>
          <span className="muted">→</span>
        </Link>
      </div>

      <h2 className="section-title">Employees</h2>
      <div className="card">
        {employees.map((emp) => (
          <div key={emp.id} className="list-row">
            <div>
              <strong>{emp.name}</strong>
              <span className="muted"> · {emp.role}</span>
            </div>
            <button className="icon-btn" onClick={() => db.employees.delete(emp.id!)} aria-label="Remove">
              ✕
            </button>
          </div>
        ))}
        <div className="field-row emp-add">
          <input placeholder="Employee name" value={empName} onChange={(e) => setEmpName(e.target.value)} />
          <select value={empRole} onChange={(e) => setEmpRole(e.target.value as 'Owner' | 'Employee')}>
            <option>Employee</option>
            <option>Owner</option>
          </select>
          <button className="btn btn-sm" onClick={addEmployee}>
            Add
          </button>
        </div>
      </div>

      <h2 className="section-title">Notifications</h2>
      <div className="card">
        <div className="list-row">
          <div>
            <strong>Daily morning summary</strong>
            <span className="muted block">Browser notification with expiring memberships</span>
          </div>
          <button
            className={'toggle' + (settings?.notificationsEnabled ? ' on' : '')}
            onClick={toggleNotifications}
            aria-label="Toggle notifications"
          >
            <span />
          </button>
        </div>
        <Link to="/notifications" className="list-row list-row-btn">
          <strong>🔔 Open Notification Center</strong>
          <span className="muted">→</span>
        </Link>
      </div>

      <h2 className="section-title">Backup &amp; Restore</h2>
      <div className="card">
        <div className="btn-row pad">
          <button className="btn" onClick={backup}>
            ⬇️ Backup (JSON)
          </button>
          <button className="btn" onClick={() => restoreRef.current?.click()}>
            ⬆️ Restore
          </button>
          <input ref={restoreRef} type="file" accept=".json" hidden onChange={(e) => restore(e.target.files?.[0])} />
        </div>
        <p className="muted pad tiny">
          All data lives on this device (offline-first). Take a backup regularly and keep it safe.
        </p>
      </div>
    </div>
  );
}

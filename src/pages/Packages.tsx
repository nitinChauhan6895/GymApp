import { FormEvent, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Package } from '../types';
import { money } from '../utils';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';

export default function Packages() {
  const packages = useLiveQuery(() => db.packages.toArray(), []) || [];
  const [editing, setEditing] = useState<Package | 'new' | null>(null);

  return (
    <div className="page">
      <PageHeader
        title="Packages"
        back
        actions={
          <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>
            + New
          </button>
        }
      />
      <div className="member-list">
        {packages.map((p) => (
          <button key={p.id} className={'card package-card' + (p.active ? '' : ' inactive')} onClick={() => setEditing(p)}>
            <div>
              <strong>{p.name}</strong>
              <span className="muted block">
                {p.durationMonths} month{p.durationMonths === 1 ? '' : 's'}
                {p.description ? ` · ${p.description}` : ''}
              </span>
            </div>
            <div className="list-row-right">
              <strong>{money(p.price)}</strong>
              {!p.active && <span className="badge badge-expired">Inactive</span>}
            </div>
          </button>
        ))}
      </div>
      {editing && <PackageModal pkg={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function PackageModal({ pkg, onClose }: { pkg: Package | null; onClose: () => void }) {
  const [name, setName] = useState(pkg?.name || '');
  const [duration, setDuration] = useState(pkg ? String(pkg.durationMonths) : '1');
  const [price, setPrice] = useState(pkg ? String(pkg.price) : '');
  const [description, setDescription] = useState(pkg?.description || '');
  const [active, setActive] = useState(pkg?.active ?? true);

  async function save(e: FormEvent) {
    e.preventDefault();
    const record = {
      name: name.trim(),
      durationMonths: Math.max(1, Number(duration) || 1),
      price: Math.max(0, Number(price) || 0),
      description: description.trim(),
      active,
    };
    if (!record.name) return;
    if (pkg?.id) await db.packages.update(pkg.id, record);
    else await db.packages.add(record);
    onClose();
  }

  return (
    <Modal title={pkg ? 'Edit Package' : 'New Package'} onClose={onClose}>
      <form onSubmit={save}>
        <label className="field">
          <span>Package Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Duration (months)</span>
            <input type="number" min="1" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} required />
          </label>
          <label className="field">
            <span>Price (₹)</span>
            <input type="number" min="0" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} required />
          </label>
        </div>
        <label className="field">
          <span>Description</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="check-row">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          <span>Active (available for new memberships)</span>
        </label>
        <button className="btn btn-primary btn-block" type="submit">
          {pkg ? 'Save Package' : 'Create Package'}
        </button>
      </form>
    </Modal>
  );
}

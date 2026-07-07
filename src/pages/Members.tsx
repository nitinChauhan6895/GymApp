import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { buildMemberViews } from '../data';
import MemberCard from '../components/MemberCard';
import PageHeader from '../components/PageHeader';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'expiring', label: 'Expiring Soon' },
  { key: 'expired', label: 'Expired' },
] as const;

export default function Members() {
  const [params, setParams] = useSearchParams();
  const filter = params.get('filter') || 'all';
  const [q, setQ] = useState('');

  const views =
    useLiveQuery(async () => {
      const [members, memberships, payments] = await Promise.all([
        db.members.toArray(),
        db.memberships.toArray(),
        db.payments.toArray(),
      ]);
      return buildMemberViews(members, memberships, payments);
    }, []) || [];

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return views
      .filter((v) => {
        if (filter === 'active' && !(v.status === 'active' || v.status === 'expiring')) return false;
        if (filter === 'expiring' && v.status !== 'expiring') return false;
        if (filter === 'expired' && v.status !== 'expired') return false;
        if (term) {
          return (
            v.member.fullName.toLowerCase().includes(term) ||
            v.member.phone.includes(term) ||
            (v.member.email || '').toLowerCase().includes(term)
          );
        }
        return true;
      })
      .sort((a, b) => a.member.fullName.localeCompare(b.member.fullName));
  }, [views, filter, q]);

  return (
    <div className="page">
      <PageHeader
        title="Members"
        actions={
          <Link to="/members/new" className="btn btn-primary btn-sm">
            + Add
          </Link>
        }
      />
      <input
        className="search-input"
        placeholder="Search name, phone, email…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="chip-row">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={'chip' + (filter === f.key ? ' chip-active' : '')}
            onClick={() => setParams(f.key === 'all' ? {} : { filter: f.key })}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="member-list">
        {filtered.map((v) => (
          <MemberCard key={v.member.id} view={v} />
        ))}
        {filtered.length === 0 && (
          <div className="empty-state">
            <p>No members {q ? 'match your search' : 'yet'}.</p>
            {!q && (
              <Link to="/members/new" className="btn btn-primary">
                + Add your first member
              </Link>
            )}
          </div>
        )}
      </div>
      <p className="muted center count-note">{filtered.length} member{filtered.length === 1 ? '' : 's'}</p>
    </div>
  );
}

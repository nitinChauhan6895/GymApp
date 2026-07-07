import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { buildMemberViews } from '../data';
import type { MemberView } from '../types';
import { formatDate } from '../utils';
import Avatar from './Avatar';
import Modal from './Modal';
import StatusBadge from './StatusBadge';

export default function MemberPicker({
  title,
  onPick,
  onClose,
}: {
  title: string;
  onPick: (view: MemberView) => void;
  onClose: () => void;
}) {
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
    const list = term
      ? views.filter(
          (v) => v.member.fullName.toLowerCase().includes(term) || v.member.phone.includes(term)
        )
      : views;
    return list.sort((a, b) => a.member.fullName.localeCompare(b.member.fullName)).slice(0, 50);
  }, [views, q]);

  return (
    <Modal title={title} onClose={onClose}>
      <input
        className="search-input"
        placeholder="Search name or phone…"
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="picker-list">
        {filtered.map((v) => (
          <button key={v.member.id} className="picker-row" onClick={() => onPick(v)}>
            <Avatar name={v.member.fullName} photo={v.member.photo} size={36} />
            <div className="picker-row-body">
              <span className="member-name">{v.member.fullName}</span>
              <span className="muted">
                {v.member.phone}
                {v.membership ? ` · exp ${formatDate(v.membership.endDate)}` : ''}
              </span>
            </div>
            <StatusBadge status={v.status} />
          </button>
        ))}
        {filtered.length === 0 && <p className="muted center">No members found</p>}
      </div>
    </Modal>
  );
}

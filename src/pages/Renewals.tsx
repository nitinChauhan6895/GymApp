import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { buildMemberViews } from '../data';
import type { MemberView } from '../types';
import { formatDate, telLink, whatsappLink } from '../utils';
import Avatar from '../components/Avatar';
import PageHeader from '../components/PageHeader';
import RenewModal from '../components/RenewModal';

const TABS = [
  { key: 'today', label: 'Today' },
  { key: '3days', label: '3 Days' },
  { key: 'week', label: '7 Days' },
  { key: 'expired', label: 'Expired' },
] as const;

export default function Renewals() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'today';
  const [renewing, setRenewing] = useState<MemberView | null>(null);
  const settings = useLiveQuery(() => db.settings.get(1));

  const views =
    useLiveQuery(async () => {
      const [members, memberships, payments] = await Promise.all([
        db.members.toArray(),
        db.memberships.toArray(),
        db.payments.toArray(),
      ]);
      return buildMemberViews(members, memberships, payments);
    }, []) || [];

  const list = useMemo(() => {
    const withMs = views.filter((v) => v.membership && v.daysLeft !== null);
    let filtered: MemberView[];
    if (tab === 'today') filtered = withMs.filter((v) => v.daysLeft === 0);
    else if (tab === '3days') filtered = withMs.filter((v) => v.daysLeft! >= 0 && v.daysLeft! <= 3);
    else if (tab === 'week') filtered = withMs.filter((v) => v.daysLeft! >= 0 && v.daysLeft! <= 7);
    else filtered = withMs.filter((v) => v.daysLeft! < 0);
    return filtered.sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0) || a.member.fullName.localeCompare(b.member.fullName));
  }, [views, tab]);

  const gymName = settings?.gymName || 'our gym';

  function reminderMsg(v: MemberView) {
    const exp = formatDate(v.membership!.endDate);
    if (v.daysLeft! < 0) {
      return `Hi ${v.member.fullName}, your membership at ${gymName} expired on ${exp}. Renew today to keep your fitness streak going! 💪`;
    }
    return `Hi ${v.member.fullName}, your membership at ${gymName} expires on ${exp}. Renew now to avoid any break in your workouts! 💪`;
  }

  return (
    <div className="page">
      <PageHeader title="Renewals" />
      <div className="chip-row">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={'chip' + (tab === t.key ? ' chip-active' : '')}
            onClick={() => setParams({ tab: t.key })}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="member-list">
        {list.map((v) => (
          <div key={v.member.id} className="card renewal-card">
            <Link to={`/members/${v.member.id}`} className="renewal-card-main">
              <Avatar name={v.member.fullName} photo={v.member.photo} size={40} />
              <div>
                <span className="member-name">{v.member.fullName}</span>
                <span className="muted block">
                  {v.member.phone} · exp {formatDate(v.membership!.endDate)}
                </span>
                <span className={v.daysLeft! < 0 ? 'due block' : 'muted block'}>
                  {v.daysLeft! < 0
                    ? `Expired ${Math.abs(v.daysLeft!)} day${Math.abs(v.daysLeft!) === 1 ? '' : 's'} ago`
                    : v.daysLeft === 0
                      ? 'Expires today'
                      : `${v.daysLeft} day${v.daysLeft === 1 ? '' : 's'} left`}
                </span>
              </div>
            </Link>
            <div className="renewal-actions">
              <button className="btn btn-primary btn-sm" onClick={() => setRenewing(v)}>
                Renew
              </button>
              <a className="icon-btn" href={telLink(v.member.phone)} aria-label="Call">
                📞
              </a>
              <a
                className="icon-btn"
                href={whatsappLink(v.member.phone, reminderMsg(v))}
                target="_blank"
                rel="noreferrer"
                aria-label="WhatsApp"
              >
                💬
              </a>
            </div>
          </div>
        ))}
        {list.length === 0 && (
          <div className="empty-state">
            <p>🎉 Nothing here — no memberships {tab === 'expired' ? 'expired' : 'expiring'} in this window.</p>
          </div>
        )}
      </div>
      {renewing && (
        <RenewModal member={renewing.member} current={renewing.membership} onClose={() => setRenewing(null)} />
      )}
    </div>
  );
}

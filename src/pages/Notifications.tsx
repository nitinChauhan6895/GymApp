import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { buildMemberViews } from '../data';
import { formatDate, money, todayISO } from '../utils';
import PageHeader from '../components/PageHeader';

export default function Notifications() {
  const data = useLiveQuery(async () => {
    const [members, memberships, payments] = await Promise.all([
      db.members.toArray(),
      db.memberships.toArray(),
      db.payments.toArray(),
    ]);
    return buildMemberViews(members, memberships, payments);
  });

  const groups = useMemo(() => {
    const views = data || [];
    return {
      today: views.filter((v) => v.daysLeft === 0),
      tomorrow: views.filter((v) => v.daysLeft === 1),
      week: views.filter((v) => v.daysLeft !== null && v.daysLeft >= 2 && v.daysLeft <= 7),
      expired: views
        .filter((v) => v.status === 'expired')
        .sort((a, b) => (b.daysLeft ?? 0) - (a.daysLeft ?? 0))
        .slice(0, 20),
      due: views.filter((v) => v.outstanding > 0 && v.status !== 'expired'),
    };
  }, [data]);

  const sections = [
    { title: '🔴 Expiring Today', items: groups.today },
    { title: '🟠 Expiring Tomorrow', items: groups.tomorrow },
    { title: '🟡 Expiring This Week', items: groups.week },
    { title: '💰 Outstanding Balance', items: groups.due },
    { title: '⚫ Recently Expired', items: groups.expired },
  ];

  const total = sections.reduce((s, g) => s + g.items.length, 0);

  return (
    <div className="page">
      <PageHeader title="Notifications" back />
      <p className="muted">
        Summary for {formatDate(todayISO())} — {total} item{total === 1 ? '' : 's'} need attention.
      </p>
      {sections.map(
        (section) =>
          section.items.length > 0 && (
            <div key={section.title}>
              <h2 className="section-title">{section.title}</h2>
              <div className="card">
                {section.items.map((v) => (
                  <Link key={v.member.id} to={`/members/${v.member.id}`} className="list-row list-row-btn">
                    <div>
                      <strong>{v.member.fullName}</strong>
                      <span className="muted block">{v.member.phone}</span>
                    </div>
                    <div className="list-row-right">
                      {v.membership && <span className="muted">exp {formatDate(v.membership.endDate)}</span>}
                      {v.outstanding > 0 && <span className="due tiny">due {money(v.outstanding)}</span>}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )
      )}
      {total === 0 && (
        <div className="empty-state">
          <p>✅ All clear! No expiries or dues need attention right now.</p>
        </div>
      )}
    </div>
  );
}

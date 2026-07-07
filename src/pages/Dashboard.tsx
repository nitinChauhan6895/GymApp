import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { buildMemberViews } from '../data';
import type { MemberView } from '../types';
import { formatDateTime, money, todayISO } from '../utils';
import MemberPicker from '../components/MemberPicker';
import PaymentModal from '../components/PaymentModal';
import RenewModal from '../components/RenewModal';

export default function Dashboard() {
  const navigate = useNavigate();
  const settings = useLiveQuery(() => db.settings.get(1));
  const [action, setAction] = useState<'renew' | 'payment' | null>(null);
  const [picked, setPicked] = useState<MemberView | null>(null);

  const data = useLiveQuery(async () => {
    const [members, memberships, payments, activities] = await Promise.all([
      db.members.toArray(),
      db.memberships.toArray(),
      db.payments.toArray(),
      db.activities.orderBy('at').reverse().limit(8).toArray(),
    ]);
    return { views: buildMemberViews(members, memberships, payments), payments, activities };
  });

  const views = data?.views || [];
  const today = todayISO();
  const month = today.slice(0, 7);

  const active = views.filter((v) => v.status === 'active' || v.status === 'expiring').length;
  const expToday = views.filter((v) => v.daysLeft === 0).length;
  const exp7 = views.filter((v) => v.daysLeft !== null && v.daysLeft >= 0 && v.daysLeft <= 7).length;
  const expired = views.filter((v) => v.status === 'expired').length;
  const paymentsToday = (data?.payments || []).filter((p) => p.paymentDate === today);
  const renewalsMonth = useLiveQuery(async () => {
    const ms = await db.memberships.toArray();
    return ms.filter((m) => m.renewedFrom != null && m.createdAt.slice(0, 7) === month).length;
  }, [month]);

  return (
    <div className="page">
      <header className="page-header hero">
        <div>
          <p className="muted">{settings?.gymName || 'My Gym'}</p>
          <h1>Dashboard</h1>
        </div>
        <Link to="/notifications" className="icon-btn" aria-label="Notifications">
          🔔
        </Link>
      </header>

      <div className="stat-grid">
        <Link to="/members?filter=active" className="stat-card">
          <span className="stat-value">{active}</span>
          <span className="stat-label">Active Members</span>
        </Link>
        <Link to="/renewals?tab=today" className="stat-card stat-warn">
          <span className="stat-value">{expToday}</span>
          <span className="stat-label">Expiring Today</span>
        </Link>
        <Link to="/renewals?tab=week" className="stat-card stat-warn">
          <span className="stat-value">{exp7}</span>
          <span className="stat-label">Expiring in 7 Days</span>
        </Link>
        <Link to="/renewals?tab=expired" className="stat-card stat-danger">
          <span className="stat-value">{expired}</span>
          <span className="stat-label">Expired</span>
        </Link>
        <div className="stat-card stat-ok">
          <span className="stat-value">{money(paymentsToday.reduce((s, p) => s + p.amount, 0))}</span>
          <span className="stat-label">Payments Today ({paymentsToday.length})</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{renewalsMonth ?? 0}</span>
          <span className="stat-label">Renewals This Month</span>
        </div>
      </div>

      <h2 className="section-title">Quick Actions</h2>
      <div className="quick-actions">
        <button className="btn btn-primary" onClick={() => navigate('/members/new')}>
          + Add Member
        </button>
        <button className="btn" onClick={() => setAction('renew')}>
          🔄 Renew Member
        </button>
        <button className="btn" onClick={() => setAction('payment')}>
          💰 Record Payment
        </button>
        <button className="btn" onClick={() => navigate('/settings/import')}>
          📥 Import Excel
        </button>
      </div>

      <div className="row-between">
        <h2 className="section-title">Recent Activity</h2>
        <Link to="/reports" className="link">
          Reports →
        </Link>
      </div>
      <div className="card activity-list">
        {(data?.activities || []).map((a) => (
          <div key={a.id} className="activity-row">
            <span className="activity-icon">
              {a.type === 'payment' ? '💰' : a.type === 'renewal' ? '🔄' : a.type === 'import' ? '📥' : '👤'}
            </span>
            <span className="activity-msg">{a.message}</span>
            <span className="activity-time">{formatDateTime(a.at)}</span>
          </div>
        ))}
        {(data?.activities || []).length === 0 && (
          <p className="muted center pad">No activity yet. Add your first member to get started.</p>
        )}
      </div>

      {action && !picked && (
        <MemberPicker
          title={action === 'renew' ? 'Renew — pick member' : 'Payment — pick member'}
          onPick={setPicked}
          onClose={() => setAction(null)}
        />
      )}
      {action === 'renew' && picked && (
        <RenewModal
          member={picked.member}
          current={picked.membership}
          onClose={() => {
            setAction(null);
            setPicked(null);
          }}
        />
      )}
      {action === 'payment' && picked && (
        <PaymentModal
          member={picked.member}
          membership={picked.membership}
          outstanding={picked.outstanding}
          onClose={() => {
            setAction(null);
            setPicked(null);
          }}
        />
      )}
    </div>
  );
}

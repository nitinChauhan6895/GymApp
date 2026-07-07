import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { outstandingOf, softDeleteMember } from '../data';
import { daysUntil, formatDate, money, statusOf, telLink, whatsappLink } from '../utils';
import Avatar from '../components/Avatar';
import ExtendModal from '../components/ExtendModal';
import PageHeader from '../components/PageHeader';
import PaymentModal from '../components/PaymentModal';
import RenewModal from '../components/RenewModal';
import StatusBadge from '../components/StatusBadge';

export default function MemberProfile() {
  const { id } = useParams();
  const memberId = Number(id);
  const navigate = useNavigate();
  const [showRenew, setShowRenew] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showExtend, setShowExtend] = useState(false);

  const data = useLiveQuery(async () => {
    const [member, memberships, payments, settings] = await Promise.all([
      db.members.get(memberId),
      db.memberships.where('memberId').equals(memberId).toArray(),
      db.payments.where('memberId').equals(memberId).toArray(),
      db.settings.get(1),
    ]);
    return { member, memberships, payments, settings };
  }, [memberId]);

  if (!data) return <div className="page" />;
  if (!data.member || data.member.deletedAt) {
    return (
      <div className="page">
        <PageHeader title="Member" back />
        <p className="muted center pad">Member not found.</p>
      </div>
    );
  }

  const { member } = data;
  const memberships = [...data.memberships].sort((a, b) => (a.endDate < b.endDate ? 1 : -1));
  const current = memberships[0] || null;
  const payments = [...data.payments].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const outstanding = outstandingOf(data.memberships, data.payments);
  const status = statusOf(current?.endDate);
  const daysLeft = current ? daysUntil(current.endDate) : null;
  const gymName = data.settings?.gymName || 'our gym';

  async function del() {
    if (!confirm(`Delete ${member.fullName}? Their history is kept but they will disappear from lists.`)) return;
    await softDeleteMember(memberId);
    navigate('/members', { replace: true });
  }

  return (
    <div className="page">
      <PageHeader
        title="Member Profile"
        back
        actions={
          <button className="icon-btn" onClick={del} aria-label="Delete member">
            🗑️
          </button>
        }
      />

      <div className="card profile-head">
        <Avatar name={member.fullName} photo={member.photo} size={64} />
        <div className="profile-head-body">
          <h2>{member.fullName}</h2>
          <StatusBadge status={status} />
        </div>
        <div className="profile-contact">
          <a className="icon-btn" href={telLink(member.phone)} aria-label="Call">
            📞
          </a>
          <a
            className="icon-btn"
            href={whatsappLink(member.phone, `Hi ${member.fullName}, greetings from ${gymName}!`)}
            target="_blank"
            rel="noreferrer"
            aria-label="WhatsApp"
          >
            💬
          </a>
        </div>
      </div>

      <div className="btn-row">
        <button className="btn btn-primary" onClick={() => setShowRenew(true)}>
          🔄 Renew
        </button>
        <button className="btn" onClick={() => setShowPayment(true)}>
          💰 Payment
        </button>
        <Link className="btn" to={`/members/${memberId}/edit`}>
          ✏️ Edit
        </Link>
      </div>

      <h2 className="section-title">Membership</h2>
      <div className="card">
        {current ? (
          <div className="kv-grid">
            <div>
              <span>Plan</span>
              <strong>{current.packageName}</strong>
            </div>
            {current.specialProgram && (
              <div>
                <span>Program</span>
                <strong>{current.specialProgram}</strong>
              </div>
            )}
            <div>
              <span>Start</span>
              <strong>{formatDate(current.startDate)}</strong>
            </div>
            <div>
              <span>Expiry</span>
              <strong>{formatDate(current.endDate)}</strong>
            </div>
            <div>
              <span>Remaining</span>
              <strong>{daysLeft !== null && daysLeft >= 0 ? `${daysLeft} days` : 'Expired'}</strong>
            </div>
            <div>
              <span>Price</span>
              <strong>{money(current.finalPrice)}</strong>
            </div>
            <div>
              <span>Outstanding</span>
              <strong className={outstanding > 0 ? 'due' : ''}>{money(outstanding)}</strong>
            </div>
            <div className="kv-wide">
              <button className="btn btn-sm" onClick={() => setShowExtend(true)}>
                ➕ Add Extra Days
              </button>
            </div>
          </div>
        ) : (
          <p className="muted center pad">No membership yet. Tap Renew to assign a package.</p>
        )}
      </div>

      <h2 className="section-title">Personal Information</h2>
      <div className="card kv-grid">
        <div>
          <span>Phone</span>
          <strong>{member.phone}</strong>
        </div>
        <div>
          <span>Gender</span>
          <strong>{member.gender || '—'}</strong>
        </div>
        <div>
          <span>DOB</span>
          <strong>{formatDate(member.dob)}</strong>
        </div>
        <div>
          <span>Email</span>
          <strong>{member.email || '—'}</strong>
        </div>
        <div className="kv-wide">
          <span>Address</span>
          <strong>{member.address || '—'}</strong>
        </div>
        <div className="kv-wide">
          <span>Emergency Contact</span>
          <strong>{member.emergencyContact || '—'}</strong>
        </div>
        {(member.conditions || []).length > 0 && (
          <div className="kv-wide">
            <span>Health Conditions</span>
            <div className="tag-row">
              {member.conditions!.map((c) => (
                <span key={c} className="tag">
                  ⚕ {c}
                </span>
              ))}
            </div>
          </div>
        )}
        {member.notes && (
          <div className="kv-wide">
            <span>Notes</span>
            <strong>{member.notes}</strong>
          </div>
        )}
      </div>

      <h2 className="section-title">Payment History</h2>
      <div className="card">
        {payments.length === 0 && <p className="muted center pad">No payments recorded.</p>}
        {payments.map((p) => (
          <div key={p.id} className="list-row">
            <div>
              <strong>{money(p.amount)}</strong>
              <span className="muted"> · {p.mode}</span>
              {p.discount > 0 && <span className="muted"> · disc {money(p.discount)}</span>}
            </div>
            <div className="list-row-right">
              <span className="muted">{formatDate(p.paymentDate)}</span>
              {p.recordedBy && <span className="muted tiny">by {p.recordedBy}</span>}
            </div>
          </div>
        ))}
      </div>

      <h2 className="section-title">Membership History</h2>
      <div className="card">
        {memberships.length === 0 && <p className="muted center pad">No memberships yet.</p>}
        {memberships.map((m) => (
          <div key={m.id} className="list-row">
            <div>
              <strong>{m.packageName}</strong>
              {m.specialProgram && <span className="muted"> · {m.specialProgram}</span>}
              {m.renewedFrom != null && <span className="muted"> · renewal</span>}
            </div>
            <span className="muted">
              {formatDate(m.startDate)} → {formatDate(m.endDate)}
            </span>
          </div>
        ))}
      </div>

      {showRenew && <RenewModal member={member} current={current} onClose={() => setShowRenew(false)} />}
      {showExtend && current && (
        <ExtendModal member={member} membership={current} onClose={() => setShowExtend(false)} />
      )}
      {showPayment && (
        <PaymentModal member={member} membership={current} outstanding={outstanding} onClose={() => setShowPayment(false)} />
      )}
    </div>
  );
}

import { Link } from 'react-router-dom';
import type { MemberView } from '../types';
import { formatDate, money } from '../utils';
import Avatar from './Avatar';
import StatusBadge from './StatusBadge';

export default function MemberCard({ view }: { view: MemberView }) {
  const { member, membership, status, outstanding } = view;
  return (
    <Link to={`/members/${member.id}`} className="card member-card">
      <Avatar name={member.fullName} photo={member.photo} />
      <div className="member-card-body">
        <div className="member-card-top">
          <span className="member-name">{member.fullName}</span>
          <StatusBadge status={status} />
        </div>
        <div className="member-card-sub">
          <span>📞 {member.phone}</span>
          {membership && (
            <span>
              {membership.packageName}
              {membership.specialProgram ? ` · ${membership.specialProgram}` : ''}
            </span>
          )}
        </div>
        <div className="member-card-sub">
          {membership ? <span>Expires {formatDate(membership.endDate)}</span> : <span>No membership</span>}
          {outstanding > 0 && <span className="due">Due {money(outstanding)}</span>}
        </div>
        {(member.conditions || []).length > 0 && (
          <div className="member-card-sub">
            <span className="tag-inline">
              ⚕ {member.conditions!.slice(0, 2).join(', ')}
              {member.conditions!.length > 2 ? ` +${member.conditions!.length - 2}` : ''}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

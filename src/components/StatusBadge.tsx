import type { MemberStatus } from '../types';
import { STATUS_LABEL } from '../utils';

export default function StatusBadge({ status }: { status: MemberStatus }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABEL[status]}</span>;
}

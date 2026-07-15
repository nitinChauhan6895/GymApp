import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { buildMemberViews } from '../data';
import { formatDate, money, todayISO } from '../utils';
import PageHeader from '../components/PageHeader';

export default function Reports() {
  const data = useLiveQuery(async () => {
    const [members, memberships, payments] = await Promise.all([
      db.members.toArray(),
      db.memberships.toArray(),
      db.payments.toArray(),
    ]);
    return { views: buildMemberViews(members, memberships, payments), memberships, payments };
  });

  const month = todayISO().slice(0, 7);

  // members per health condition and per special program (current membership)
  const programStats = useMemo(() => {
    if (!data) return null;
    const conditions = new Map<string, { total: number; active: number }>();
    const programs = new Map<string, { total: number; active: number }>();
    const bump = (map: Map<string, { total: number; active: number }>, key: string, isActive: boolean) => {
      const e = map.get(key) || { total: 0, active: 0 };
      e.total++;
      if (isActive) e.active++;
      map.set(key, e);
    };
    for (const v of data.views) {
      const isActive = v.status === 'active' || v.status === 'expiring';
      for (const c of v.member.conditions || []) bump(conditions, c, isActive);
      if (v.membership?.specialProgram) bump(programs, v.membership.specialProgram, isActive);
    }
    const sorted = (m: Map<string, { total: number; active: number }>) =>
      [...m.entries()].sort((a, b) => b[1].total - a[1].total);
    return { conditions: sorted(conditions), programs: sorted(programs) };
  }, [data]);

  const stats = useMemo(() => {
    if (!data) return null;
    const { views, memberships, payments } = data;
    const monthPayments = payments.filter((p) => p.paymentDate.slice(0, 7) === month);
    const modeSplit = new Map<string, number>();
    for (const p of monthPayments) modeSplit.set(p.mode, (modeSplit.get(p.mode) || 0) + p.amount);
    return {
      active: views.filter((v) => v.status === 'active' || v.status === 'expiring').length,
      expired: views.filter((v) => v.status === 'expired').length,
      upcoming: views.filter((v) => v.daysLeft !== null && v.daysLeft >= 0 && v.daysLeft <= 7).length,
      renewalsMonth: memberships.filter((m) => m.renewedFrom != null && m.createdAt.slice(0, 7) === month).length,
      revenueMonth: monthPayments.reduce((s, p) => s + p.amount, 0),
      discountMonth: memberships
        .filter((m) => m.createdAt.slice(0, 7) === month)
        .reduce((s, m) => s + m.discount, 0),
      newMembers: views.filter((v) => v.member.createdAt.slice(0, 7) === month).length,
      modeSplit: [...modeSplit.entries()],
    };
  }, [data, month]);

  async function exportExcel() {
    if (!data) return;
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const memberRows = data.views.map((v) => ({
      'Member ID': v.member.memberCode || '',
      Name: v.member.fullName,
      Phone: v.member.phone,
      Email: v.member.email || '',
      Gender: v.member.gender || '',
      Conditions: (v.member.conditions || []).join(', '),
      Status: v.status,
      Package: v.membership?.packageName || '',
      Program: v.membership?.specialProgram || '',
      'Start Date': v.membership?.startDate || '',
      'Expiry Date': v.membership?.endDate || '',
      'Outstanding (INR)': v.outstanding,
      Joined: v.member.createdAt.slice(0, 10),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(memberRows), 'Members');
    const paymentRows = data.payments.map((p) => ({
      Date: p.paymentDate,
      Member: data.views.find((v) => v.member.id === p.memberId)?.member.fullName || p.memberId,
      'Amount (INR)': p.amount,
      Mode: p.mode,
      'Discount (INR)': p.discount,
      Reference: p.reference || '',
      'Recorded By': p.recordedBy || '',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(paymentRows), 'Payments');
    const membershipRows = data.memberships.map((m) => ({
      Member: data.views.find((v) => v.member.id === m.memberId)?.member.fullName || m.memberId,
      Package: m.packageName,
      Start: m.startDate,
      Expiry: m.endDate,
      'Discount (INR)': m.discount,
      'Price (INR)': m.finalPrice,
      Renewal: m.renewedFrom != null ? 'Yes' : 'No',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(membershipRows), 'Memberships');
    if (programStats) {
      const rows = [
        ...programStats.programs.map(([name, c]) => ({
          Type: 'Program',
          Name: name,
          Members: c.total,
          Active: c.active,
        })),
        ...programStats.conditions.map(([name, c]) => ({
          Type: 'Condition',
          Name: name,
          Members: c.total,
          Active: c.active,
        })),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Programs & Conditions');
    }
    XLSX.writeFile(wb, `gym-report-${todayISO()}.xlsx`);
  }

  if (!stats) return <div className="page" />;

  return (
    <div className="page">
      <PageHeader
        title="Reports"
        back
        actions={
          <>
            <button className="btn btn-sm" onClick={exportExcel}>
              Excel
            </button>
            <button className="btn btn-sm" onClick={() => window.print()}>
              PDF
            </button>
          </>
        }
      />
      <p className="muted">
        Report for <strong>{formatDate(todayISO())}</strong>
      </p>

      <div className="stat-grid print-grid">
        <div className="stat-card">
          <span className="stat-value">{stats.active}</span>
          <span className="stat-label">Active Members</span>
        </div>
        <div className="stat-card stat-danger">
          <span className="stat-value">{stats.expired}</span>
          <span className="stat-label">Expired Members</span>
        </div>
        <div className="stat-card stat-warn">
          <span className="stat-value">{stats.upcoming}</span>
          <span className="stat-label">Upcoming Renewals (7d)</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.renewalsMonth}</span>
          <span className="stat-label">Renewals This Month</span>
        </div>
        <div className="stat-card stat-ok">
          <span className="stat-value">{money(stats.revenueMonth)}</span>
          <span className="stat-label">Revenue This Month</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{money(stats.discountMonth)}</span>
          <span className="stat-label">Discount Given</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.newMembers}</span>
          <span className="stat-label">New Members</span>
        </div>
      </div>

      <h2 className="section-title">Payment Mode Split (this month)</h2>
      <div className="card">
        {stats.modeSplit.length === 0 && <p className="muted center pad">No payments this month.</p>}
        {stats.modeSplit.map(([mode, amt]) => (
          <div key={mode} className="list-row">
            <strong>{mode}</strong>
            <span>{money(amt)}</span>
          </div>
        ))}
      </div>

      <h2 className="section-title">Members by Special Program</h2>
      <div className="card">
        {(!programStats || programStats.programs.length === 0) && (
          <p className="muted center pad">No special programs assigned yet.</p>
        )}
        {programStats?.programs.map(([name, c]) => (
          <div key={name} className="list-row">
            <strong>{name}</strong>
            <span>
              {c.active} active <span className="muted">/ {c.total}</span>
            </span>
          </div>
        ))}
      </div>

      <h2 className="section-title">Members by Health Condition</h2>
      <div className="card">
        {(!programStats || programStats.conditions.length === 0) && (
          <p className="muted center pad">No health conditions tagged yet.</p>
        )}
        {programStats?.conditions.map(([name, c]) => (
          <div key={name} className="list-row">
            <strong>⚕ {name}</strong>
            <span>
              {c.active} active <span className="muted">/ {c.total}</span>
            </span>
          </div>
        ))}
      </div>

      <p className="muted center count-note no-print">
        Excel export includes member, payment, membership and program/condition sheets. PDF uses your browser's
        print dialog.
      </p>
    </div>
  );
}

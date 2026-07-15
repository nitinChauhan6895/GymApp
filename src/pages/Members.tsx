import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { buildMemberViews } from '../data';
import { CONDITIONS } from '../types';
import { ageOf } from '../utils';
import MemberCard from '../components/MemberCard';
import PageHeader from '../components/PageHeader';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'expiring', label: 'Expiring Soon' },
  { key: 'expired', label: 'Expired' },
] as const;

const AGE_BANDS = [
  { key: '', label: 'Any age' },
  { key: 'u25', label: 'Under 25' },
  { key: '25-40', label: '25 – 40' },
  { key: '40-55', label: '40 – 55' },
  { key: '55+', label: '55+' },
] as const;

function inAgeBand(age: number | null, band: string): boolean {
  if (!band) return true;
  if (age === null) return false;
  if (band === 'u25') return age < 25;
  if (band === '25-40') return age >= 25 && age <= 40;
  if (band === '40-55') return age > 40 && age <= 55;
  return age > 55;
}

export default function Members() {
  const [params, setParams] = useSearchParams();
  const filter = params.get('filter') || 'all';
  const [q, setQ] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [gender, setGender] = useState('');
  const [ageBand, setAgeBand] = useState('');
  const [condition, setCondition] = useState('');

  const views =
    useLiveQuery(async () => {
      const [members, memberships, payments] = await Promise.all([
        db.members.toArray(),
        db.memberships.toArray(),
        db.payments.toArray(),
      ]);
      return buildMemberViews(members, memberships, payments);
    }, []) || [];

  // dropdown shows predefined conditions plus any custom ones in use
  const conditionOptions = useMemo(() => {
    const inUse = new Set<string>();
    for (const v of views) for (const c of v.member.conditions || []) inUse.add(c);
    const custom = [...inUse].filter((c) => !(CONDITIONS as readonly string[]).includes(c)).sort();
    return [...CONDITIONS, ...custom];
  }, [views]);

  const activeExtraFilters = [gender, ageBand, condition].filter(Boolean).length;

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return views
      .filter((v) => {
        if (filter === 'active' && !(v.status === 'active' || v.status === 'expiring')) return false;
        if (filter === 'expiring' && v.status !== 'expiring') return false;
        if (filter === 'expired' && v.status !== 'expired') return false;
        if (gender && (v.member.gender || '') !== gender) return false;
        if (!inAgeBand(ageOf(v.member.dob), ageBand)) return false;
        if (condition && !(v.member.conditions || []).includes(condition)) return false;
        if (term) {
          return (
            v.member.fullName.toLowerCase().includes(term) ||
            v.member.phone.includes(term) ||
            (v.member.memberCode || '').toLowerCase().includes(term) ||
            (v.member.email || '').toLowerCase().includes(term)
          );
        }
        return true;
      })
      .sort((a, b) => a.member.fullName.localeCompare(b.member.fullName));
  }, [views, filter, q, gender, ageBand, condition]);

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
        placeholder="Search ID, name, phone, email…"
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
        <button
          className={'chip' + (showFilters || activeExtraFilters ? ' chip-active' : '')}
          onClick={() => setShowFilters((s) => !s)}
        >
          ⚙ Filters{activeExtraFilters ? ` (${activeExtraFilters})` : ''}
        </button>
      </div>

      {showFilters && (
        <div className="card filter-panel">
          <div className="field-row">
            <label className="field">
              <span>Gender</span>
              <select value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="">Any</option>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
            </label>
            <label className="field">
              <span>Age</span>
              <select value={ageBand} onChange={(e) => setAgeBand(e.target.value)}>
                {AGE_BANDS.map((b) => (
                  <option key={b.key} value={b.key}>
                    {b.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            <span>Health Condition</span>
            <select value={condition} onChange={(e) => setCondition(e.target.value)}>
              <option value="">Any</option>
              {conditionOptions.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          {activeExtraFilters > 0 && (
            <button
              className="btn btn-sm"
              onClick={() => {
                setGender('');
                setAgeBand('');
                setCondition('');
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      <div className="member-list">
        {filtered.map((v) => (
          <MemberCard key={v.member.id} view={v} />
        ))}
        {filtered.length === 0 && (
          <div className="empty-state">
            <p>No members {q || activeExtraFilters ? 'match your search/filters' : 'yet'}.</p>
            {!q && !activeExtraFilters && (
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

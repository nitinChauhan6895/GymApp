import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import { logActivity } from '../data';
import { addMonths, downloadBlob, fmtISO, formatDate, money, normPhone, nowISO, todayISO } from '../utils';
import { formatMemberCode, maxMemberCodeNumber } from '../data';
import { PAYMENT_MODES, type PaymentMode } from '../types';
import PageHeader from '../components/PageHeader';

/** Column order of the standard (exhaustive) import template. */
const TEMPLATE_HEADERS = [
  'Member ID',
  'Full Name',
  'Gender',
  'Mobile',
  'Email',
  'DOB',
  'Address',
  'Emergency Contact',
  'Health Conditions',
  'Package',
  'Special Program',
  'Start Date',
  'Expiry Date',
  'Status',
  'Final Amount',
  'Discount',
  'Amount Paid',
  'Payment Mode',
  'Payment Date',
  'Reference',
  'Notes',
];

interface ImportRow {
  memberCode?: string;
  fullName: string;
  phone: string;
  email?: string;
  gender?: string;
  dob?: string;
  address?: string;
  emergencyContact?: string;
  conditions?: string[];
  packageName?: string;
  program?: string;
  startDate?: string;
  endDate?: string;
  finalAmount?: number;
  discount?: number;
  amount?: number; // amount paid
  paymentMode?: PaymentMode;
  paymentDate?: string;
  reference?: string;
  notes?: string;
  errors: string[];
  duplicateOf?: string; // reason for duplicate
  include: boolean;
}

/** Match a value to a known payment mode (case-insensitive), else undefined. */
function toPaymentMode(value: unknown): PaymentMode | undefined {
  const s = String(value ?? '').trim().toLowerCase();
  if (!s) return undefined;
  const hit = PAYMENT_MODES.find((m) => m.toLowerCase() === s);
  if (hit) return hit;
  if (s.includes('upi')) return 'UPI';
  if (s.includes('card')) return 'Card';
  if (s.includes('bank') || s.includes('transfer') || s.includes('neft') || s.includes('imps')) return 'Bank Transfer';
  if (s.includes('cash')) return 'Cash';
  return undefined;
}

function toList(value: unknown): string[] | undefined {
  const s = String(value ?? '').trim();
  if (!s) return undefined;
  const list = s.split(/[,;|]/).map((x) => x.trim()).filter(Boolean);
  return list.length ? list : undefined;
}

function toNum(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const n = Number(String(value).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? undefined : n;
}

/** Find the first matching header (case/space-insensitive contains). */
function findCol(headers: string[], candidates: string[]): number {
  const norm = headers.map((h) => (h || '').toString().toLowerCase().replace(/[^a-z]/g, ''));
  for (const c of candidates) {
    const idx = norm.findIndex((h) => h.includes(c));
    if (idx !== -1) return idx;
  }
  return -1;
}

/** Member-ID column: match "member id/code/no" or a header that is exactly "id". */
function findIdCol(headers: string[]): number {
  const norm = headers.map((h) => (h || '').toString().toLowerCase().replace(/[^a-z]/g, ''));
  const byName = norm.findIndex((h) => ['memberid', 'membercode', 'memberno', 'regno', 'regdno'].some((c) => h.includes(c)));
  if (byName !== -1) return byName;
  return norm.findIndex((h) => h === 'id');
}

function toISODate(value: unknown): string | undefined {
  if (value == null || value === '') return undefined;
  if (value instanceof Date && !isNaN(value.getTime())) return fmtISO(value);
  if (typeof value === 'number') {
    // Excel serial date
    const d = new Date(Math.round((value - 25569) * 86400000));
    return isNaN(d.getTime()) ? undefined : fmtISO(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  const s = String(value).trim();
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (dmy) {
    let y = Number(dmy[3]);
    if (y < 100) y += 2000;
    return `${y}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : fmtISO(d);
}

export default function ImportMembers() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError('');
    setDone(null);
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      if (raw.length < 2) {
        setError('The file has no data rows.');
        return;
      }
      const headers = raw[0].map(String);
      const col = {
        code: findIdCol(headers),
        name: findCol(headers, ['fullname', 'membername', 'name']),
        phone: findCol(headers, ['mobile', 'phone', 'contactno', 'contactnumber', 'contact']),
        email: findCol(headers, ['email']),
        gender: findCol(headers, ['gender', 'sex']),
        dob: findCol(headers, ['dob', 'dateofbirth', 'birth']),
        address: findCol(headers, ['address']),
        emergency: findCol(headers, ['emergencycontact', 'emergency', 'nextofkin']),
        conditions: findCol(headers, ['healthcondition', 'healthconditions', 'conditions', 'condition', 'ailment', 'medical']),
        pkg: findCol(headers, ['package', 'plan', 'membership']),
        program: findCol(headers, ['specialprogram', 'program', 'programme']),
        start: findCol(headers, ['startdate', 'joindate', 'joiningdate', 'start', 'joined']),
        end: findCol(headers, ['enddate', 'expirydate', 'expiry', 'expire', 'validtill', 'validupto', 'end']),
        finalAmount: findCol(headers, ['finalamount', 'finalprice', 'netamount', 'netprice', 'membershipamount', 'packageprice', 'totalamount']),
        discount: findCol(headers, ['discount', 'concession', 'rebate']),
        amount: findCol(headers, ['amountpaid', 'paidamount', 'amountreceived', 'paid', 'amount', 'fee', 'price']),
        mode: findCol(headers, ['paymentmode', 'paymentmethod', 'paymenttype', 'modeofpayment', 'mode']),
        payDate: findCol(headers, ['paymentdate', 'paidon', 'paydate', 'receiptdate', 'transactiondate']),
        reference: findCol(headers, ['reference', 'refno', 'receiptno', 'txnid', 'transactionid', 'referencenumber']),
        notes: findCol(headers, ['notes', 'remarks', 'remark', 'comment', 'comments']),
      };
      if (col.name === -1 || col.phone === -1) {
        setError(`Could not find Name and Phone columns. Found headers: ${headers.filter(Boolean).join(', ')}`);
        return;
      }
      // if a single "Amount" column doubles as final amount, don't read it twice
      const finalAmountCol = col.finalAmount !== -1 && col.finalAmount !== col.amount ? col.finalAmount : -1;

      const existing = await db.members.filter((m) => !m.deletedAt).toArray();
      const existingPhones = new Map(existing.map((m) => [normPhone(m.phone), m.fullName]));
      const seenInFile = new Set<string>();

      const parsed: ImportRow[] = raw.slice(1).flatMap((r) => {
        const fullName = String(r[col.name] ?? '').trim();
        const phoneRaw = String(r[col.phone] ?? '').trim().replace(/\.0$/, '');
        if (!fullName && !phoneRaw) return []; // skip blank rows
        const errors: string[] = [];
        if (!fullName) errors.push('Missing name');
        const phone = phoneRaw;
        if (!normPhone(phone)) errors.push('Missing phone');
        let duplicateOf: string | undefined;
        const np = normPhone(phone);
        if (np) {
          if (existingPhones.has(np)) duplicateOf = `Already exists: ${existingPhones.get(np)}`;
          else if (seenInFile.has(np)) duplicateOf = 'Duplicate row in file';
          else seenInFile.add(np);
        }
        const cell = (i: number) => (i !== -1 ? String(r[i] ?? '').trim() || undefined : undefined);
        const row: ImportRow = {
          memberCode: col.code !== -1 ? String(r[col.code] ?? '').trim().replace(/\.0$/, '') || undefined : undefined,
          fullName,
          phone,
          email: cell(col.email),
          gender: cell(col.gender),
          dob: col.dob !== -1 ? toISODate(r[col.dob]) : undefined,
          address: cell(col.address),
          emergencyContact: col.emergency !== -1 ? String(r[col.emergency] ?? '').trim().replace(/\.0$/, '') || undefined : undefined,
          conditions: col.conditions !== -1 ? toList(r[col.conditions]) : undefined,
          packageName: cell(col.pkg),
          program: cell(col.program),
          startDate: col.start !== -1 ? toISODate(r[col.start]) : undefined,
          endDate: col.end !== -1 ? toISODate(r[col.end]) : undefined,
          finalAmount: finalAmountCol !== -1 ? toNum(r[finalAmountCol]) : undefined,
          discount: col.discount !== -1 ? toNum(r[col.discount]) : undefined,
          amount: col.amount !== -1 ? toNum(r[col.amount]) : undefined,
          paymentMode: col.mode !== -1 ? toPaymentMode(r[col.mode]) : undefined,
          paymentDate: col.payDate !== -1 ? toISODate(r[col.payDate]) : undefined,
          reference: cell(col.reference),
          notes: cell(col.notes),
          errors,
          duplicateOf,
          include: errors.length === 0 && !duplicateOf,
        };
        return [row];
      });
      setFileName(file.name);
      setRows(parsed);
    } catch (err) {
      setError('Could not read file: ' + (err instanceof Error ? err.message : 'unknown error'));
    }
  }

  const counts = useMemo(() => {
    if (!rows) return null;
    return {
      total: rows.length,
      valid: rows.filter((r) => r.errors.length === 0 && !r.duplicateOf).length,
      dup: rows.filter((r) => r.duplicateOf).length,
      invalid: rows.filter((r) => r.errors.length > 0).length,
      selected: rows.filter((r) => r.include).length,
    };
  }, [rows]);

  async function runImport() {
    if (!rows || importing) return;
    setImporting(true);
    const toImport = rows.filter((r) => r.include);
    const packages = await db.packages.toArray();
    const settings = await db.settings.get(1);
    const prefix = settings?.memberCodePrefix || 'M';
    const upload = todayISO();
    let nextNum = await maxMemberCodeNumber();
    let count = 0;
    let paymentsAdded = 0;
    await db.transaction('rw', [db.members, db.memberships, db.payments, db.activities], async () => {
      for (const r of toImport) {
        const memberCode = r.memberCode || formatMemberCode(prefix, ++nextNum);
        const memberId = await db.members.add({
          memberCode,
          fullName: r.fullName,
          phone: r.phone,
          email: r.email,
          gender: (r.gender as never) || '',
          dob: r.dob,
          address: r.address,
          emergencyContact: r.emergencyContact,
          conditions: r.conditions,
          notes: r.notes || 'Imported from ' + fileName,
          createdAt: nowISO(),
          deletedAt: null,
        });

        // membership: create when we know the expiry (or can derive it from package + start)
        const pkgMatch = r.packageName
          ? packages.find((p) => p.name.toLowerCase() === r.packageName!.toLowerCase())
          : undefined;
        let start = r.startDate;
        let end = r.endDate;
        if (!end && start && pkgMatch) end = addMonths(start, pkgMatch.durationMonths);

        // pricing: prefer an explicit Final Amount; else package price minus discount; else amount paid
        const discount = r.discount ?? (r.finalAmount != null && pkgMatch ? Math.max(0, pkgMatch.price - r.finalAmount) : 0);
        const finalPrice =
          r.finalAmount ?? (pkgMatch ? Math.max(0, pkgMatch.price - discount) : r.amount ?? 0);

        let membershipId: number | null = null;
        if (end) {
          if (!start) start = end <= upload ? end : upload;
          membershipId = await db.memberships.add({
            memberId,
            packageId: pkgMatch?.id ?? 0,
            packageName: pkgMatch?.name || r.packageName || 'Imported plan',
            durationMonths: pkgMatch?.durationMonths ?? 0,
            startDate: start,
            endDate: end,
            discount,
            finalPrice,
            specialProgram: r.program,
            renewedFrom: null,
            createdAt: nowISO(),
          });
        }

        // payment: record the amount paid so it lands in payment history.
        // Payment date = value from file, else the upload date.
        if (r.amount != null && r.amount > 0) {
          await db.payments.add({
            memberId,
            membershipId,
            amount: r.amount,
            mode: r.paymentMode || 'Cash',
            discount,
            reference: r.reference,
            remarks: 'Imported',
            paymentDate: r.paymentDate || upload,
            createdAt: nowISO(),
          });
          paymentsAdded++;
        }
        count++;
      }
    });
    await logActivity('import', `Imported ${count} members (${paymentsAdded} payments) from ${fileName}`);
    setDone(count);
    setRows(null);
    setImporting(false);
  }

  function toggleRow(idx: number) {
    setRows((rs) => rs!.map((r, i) => (i === idx ? { ...r, include: !r.include } : r)));
  }

  async function downloadTemplate() {
    const XLSX = await import('xlsx');
    // columns, in order: Member ID, Full Name, Gender, Mobile, Email, DOB, Address,
    // Emergency Contact, Health Conditions, Package, Special Program, Start Date,
    // Expiry Date, Status, Final Amount, Discount, Amount Paid, Payment Mode, Payment Date, Reference, Notes
    const sample = [
      ['M0001', 'Rahul Sharma', 'Male', '9876543210', 'rahul@example.com', '1990-05-15', 'MG Road, Pune', '9876500000', 'Diabetes', '3 Months', 'Weight Loss', '2026-01-01', '2026-04-01', 'Active', 2700, 300, 2700, 'UPI', '2026-01-01', 'UPI-8842', 'Prefers morning batch'],
      ['M0002', 'Priya Patel', 'Female', '9123456780', '', '1995-11-02', '', '', 'Heart Disease, High Blood Pressure', '1 Month', 'Cardiac Fitness', '2026-02-01', '2026-03-01', 'Active', 1000, 0, 500, 'Cash', '2026-02-01', '', 'Balance 500 pending'],
    ];
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...sample]);
    ws['!cols'] = TEMPLATE_HEADERS.map((h) => ({ wch: Math.max(12, h.length + 2) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Members');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'gymapp-import-template.xlsx');
  }

  return (
    <div className="page">
      <PageHeader title="Import Members" back />

      {!rows && (
        <div className="card form">
          <p className="muted">
            Download the standard template for a clean import. It covers member details (ID, name,
            gender, mobile, email, DOB, address, emergency contact, health conditions), membership
            (package, special program, start &amp; expiry dates, final amount, discount) and payment
            (amount paid, mode, date, reference, notes). Only <strong>Full Name</strong> and{' '}
            <strong>Mobile</strong> are required — the import reads whatever other columns are present.
            Member IDs auto-generate when blank, and a missing payment date defaults to today. A Go Gym
            export (or any .xlsx/.csv with Name &amp; Phone columns) also works.
          </p>
          <button className="btn btn-block" onClick={downloadTemplate}>
            ⬇️ Download Standard Template
          </button>
          <label className="btn btn-primary btn-block">
            📥 Choose Excel / CSV file
            <input type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          {error && <p className="error">{error}</p>}
          {done !== null && (
            <div className="summary-box">
              <div>
                <span>Imported</span>
                <strong>{done} members ✅</strong>
              </div>
              <button className="btn btn-block" onClick={() => navigate('/members')}>
                View Members
              </button>
            </div>
          )}
        </div>
      )}

      {rows && counts && (
        <>
          <div className="card import-summary">
            <div>
              <strong>{fileName}</strong>
              <span className="muted block">
                {counts.total} rows · {counts.valid} valid · {counts.dup} duplicates · {counts.invalid} invalid
              </span>
            </div>
            <button className="btn btn-sm" onClick={() => setRows(null)}>
              Change file
            </button>
          </div>

          <div className="import-list">
            {rows.map((r, i) => (
              <label key={i} className={'card import-row' + (r.errors.length || r.duplicateOf ? ' import-problem' : '')}>
                <input type="checkbox" checked={r.include} onChange={() => toggleRow(i)} />
                <div className="import-row-body">
                  <strong>
                    {r.memberCode ? `${r.memberCode} · ` : ''}
                    {r.fullName || '(no name)'}
                  </strong>
                  <span className="muted block">
                    {r.phone || '(no phone)'}
                    {r.packageName ? ` · ${r.packageName}` : ''}
                    {r.endDate ? ` · exp ${formatDate(r.endDate)}` : ''}
                    {r.amount != null ? ` · paid ${money(r.amount)}` : ''}
                  </span>
                  {r.errors.map((e) => (
                    <span key={e} className="error tiny block">
                      ⚠ {e}
                    </span>
                  ))}
                  {r.duplicateOf && <span className="due tiny block">⚠ {r.duplicateOf}</span>}
                </div>
              </label>
            ))}
          </div>

          <div className="import-footer no-print">
            <button className="btn btn-primary btn-block" disabled={counts.selected === 0 || importing} onClick={runImport}>
              {importing ? 'Importing…' : `Import ${counts.selected} member${counts.selected === 1 ? '' : 's'}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

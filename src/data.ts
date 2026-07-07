import { db } from './db';
import type {
  Member,
  MemberView,
  Membership,
  Package,
  Payment,
  PaymentMode,
} from './types';
import { addMonths, daysUntil, nowISO, statusOf, todayISO } from './utils';

export async function logActivity(type: 'member' | 'renewal' | 'payment' | 'import' | 'other', message: string) {
  await db.activities.add({ type, message, at: nowISO() });
  // keep activity log bounded
  const count = await db.activities.count();
  if (count > 300) {
    const oldest = await db.activities.orderBy('at').limit(count - 300).toArray();
    await db.activities.bulkDelete(oldest.map((a) => a.id!));
  }
}

/** Latest membership per member id. */
export function latestMembership(memberships: Membership[]): Map<number, Membership> {
  const map = new Map<number, Membership>();
  for (const m of memberships) {
    const cur = map.get(m.memberId);
    if (!cur || m.endDate > cur.endDate || (m.endDate === cur.endDate && (m.id ?? 0) > (cur.id ?? 0))) {
      map.set(m.memberId, m);
    }
  }
  return map;
}

/**
 * Outstanding = everything ever billed (final price of all memberships)
 * minus everything ever paid, so unpaid dues carry over across renewals.
 */
export function outstandingOf(memberships: Membership[], payments: Payment[]): number {
  const billed = memberships.reduce((s, m) => s + m.finalPrice, 0);
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  return Math.max(0, billed - paid);
}

export function buildMemberViews(
  members: Member[],
  memberships: Membership[],
  payments: Payment[]
): MemberView[] {
  const latest = latestMembership(memberships);
  const billedByMember = new Map<number, number>();
  for (const m of memberships) {
    billedByMember.set(m.memberId, (billedByMember.get(m.memberId) || 0) + m.finalPrice);
  }
  const paidByMember = new Map<number, number>();
  for (const p of payments) {
    paidByMember.set(p.memberId, (paidByMember.get(p.memberId) || 0) + p.amount);
  }
  return members
    .filter((m) => !m.deletedAt)
    .map((member) => {
      const ms = latest.get(member.id!) || null;
      const outstanding = Math.max(
        0,
        (billedByMember.get(member.id!) || 0) - (paidByMember.get(member.id!) || 0)
      );
      return {
        member,
        membership: ms,
        status: statusOf(ms?.endDate),
        daysLeft: ms ? daysUntil(ms.endDate) : null,
        outstanding,
      };
    });
}

export interface NewMemberInput {
  member: Omit<Member, 'id' | 'createdAt' | 'deletedAt'>;
  packageId?: number;
  discount?: number;
  joiningDate?: string;
  amountPaid?: number;
  paymentMode?: PaymentMode;
  recordedBy?: string;
}

export async function createMember(input: NewMemberInput): Promise<number> {
  return db.transaction('rw', [db.members, db.memberships, db.payments, db.packages, db.activities], async () => {
    const memberId = await db.members.add({
      ...input.member,
      createdAt: nowISO(),
      deletedAt: null,
    });
    if (input.packageId) {
      const pkg = await db.packages.get(input.packageId);
      if (pkg) {
        const start = input.joiningDate || todayISO();
        const discount = input.discount || 0;
        const membershipId = await db.memberships.add({
          memberId,
          packageId: pkg.id!,
          packageName: pkg.name,
          durationMonths: pkg.durationMonths,
          startDate: start,
          endDate: addMonths(start, pkg.durationMonths),
          discount,
          finalPrice: Math.max(0, pkg.price - discount),
          renewedFrom: null,
          createdAt: nowISO(),
        });
        if (input.amountPaid && input.amountPaid > 0) {
          await db.payments.add({
            memberId,
            membershipId,
            amount: input.amountPaid,
            mode: input.paymentMode || 'Cash',
            discount,
            paymentDate: start,
            recordedBy: input.recordedBy,
            createdAt: nowISO(),
          });
        }
      }
    }
    await db.activities.add({
      type: 'member',
      message: `New member added: ${input.member.fullName}`,
      at: nowISO(),
    });
    return memberId;
  });
}

export interface RenewInput {
  memberId: number;
  pkg: Package;
  discount: number;
  amountPaid: number;
  paymentMode: PaymentMode;
  reference?: string;
  remarks?: string;
  recordedBy?: string;
}

/** Renew: extends from current expiry if still active, else starts today. */
export async function renewMembership(input: RenewInput): Promise<void> {
  await db.transaction('rw', [db.memberships, db.payments, db.members, db.activities], async () => {
    const member = await db.members.get(input.memberId);
    const existing = await db.memberships.where('memberId').equals(input.memberId).toArray();
    const current = existing.sort((a, b) => (a.endDate < b.endDate ? 1 : -1))[0] || null;
    const base = current && current.endDate >= todayISO() ? current.endDate : todayISO();
    const membershipId = await db.memberships.add({
      memberId: input.memberId,
      packageId: input.pkg.id!,
      packageName: input.pkg.name,
      durationMonths: input.pkg.durationMonths,
      startDate: base,
      endDate: addMonths(base, input.pkg.durationMonths),
      discount: input.discount,
      finalPrice: Math.max(0, input.pkg.price - input.discount),
      renewedFrom: current?.id ?? null,
      createdAt: nowISO(),
    });
    if (input.amountPaid > 0) {
      await db.payments.add({
        memberId: input.memberId,
        membershipId,
        amount: input.amountPaid,
        mode: input.paymentMode,
        discount: input.discount,
        reference: input.reference,
        remarks: input.remarks,
        paymentDate: todayISO(),
        recordedBy: input.recordedBy,
        createdAt: nowISO(),
      });
    }
    await db.activities.add({
      type: 'renewal',
      message: `${member?.fullName || 'Member'} renewed (${input.pkg.name})`,
      at: nowISO(),
    });
  });
}

export interface PaymentInput {
  memberId: number;
  membershipId?: number | null;
  amount: number;
  mode: PaymentMode;
  discount?: number;
  reference?: string;
  remarks?: string;
  recordedBy?: string;
}

export async function recordPayment(input: PaymentInput): Promise<void> {
  await db.transaction('rw', [db.payments, db.members, db.activities], async () => {
    const member = await db.members.get(input.memberId);
    await db.payments.add({
      memberId: input.memberId,
      membershipId: input.membershipId ?? null,
      amount: input.amount,
      mode: input.mode,
      discount: input.discount || 0,
      reference: input.reference,
      remarks: input.remarks,
      paymentDate: todayISO(),
      recordedBy: input.recordedBy,
      createdAt: nowISO(),
    });
    await db.activities.add({
      type: 'payment',
      message: `Payment of ₹${input.amount} received from ${member?.fullName || 'member'} (${input.mode})`,
      at: nowISO(),
    });
  });
}

export async function softDeleteMember(memberId: number): Promise<void> {
  const member = await db.members.get(memberId);
  await db.members.update(memberId, { deletedAt: nowISO() });
  await logActivity('member', `Member deleted: ${member?.fullName || memberId}`);
}

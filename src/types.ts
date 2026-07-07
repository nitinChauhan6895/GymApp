export type Gender = 'Male' | 'Female' | 'Other' | '';

export type PaymentMode = 'Cash' | 'UPI' | 'Card' | 'Bank Transfer';

export const PAYMENT_MODES: PaymentMode[] = ['Cash', 'UPI', 'Card', 'Bank Transfer'];

export type MemberStatus = 'active' | 'expiring' | 'expired' | 'none';

export interface Member {
  id?: number;
  fullName: string;
  phone: string;
  email?: string;
  gender?: Gender;
  dob?: string; // ISO date
  address?: string;
  emergencyContact?: string;
  photo?: string; // data URL
  notes?: string;
  createdAt: string; // ISO datetime
  deletedAt?: string | null; // soft delete
}

export interface Package {
  id?: number;
  name: string;
  durationMonths: number;
  price: number;
  description?: string;
  active: boolean;
}

export interface Membership {
  id?: number;
  memberId: number;
  packageId: number;
  packageName: string; // denormalized so history survives package edits
  durationMonths: number;
  startDate: string; // ISO date
  endDate: string; // ISO date
  discount: number;
  finalPrice: number;
  renewedFrom?: number | null; // previous membership id
  createdAt: string;
}

export interface Payment {
  id?: number;
  memberId: number;
  membershipId?: number | null;
  amount: number;
  mode: PaymentMode;
  discount: number;
  reference?: string;
  remarks?: string;
  paymentDate: string; // ISO date
  recordedBy?: string;
  createdAt: string;
}

export interface Employee {
  id?: number;
  name: string;
  role: 'Owner' | 'Employee';
  phone?: string;
}

export interface Campaign {
  id?: number;
  title: string;
  template: string;
  offer: string;
  price: string;
  dates: string;
  createdAt: string;
}

export interface Activity {
  id?: number;
  type: 'member' | 'renewal' | 'payment' | 'import' | 'other';
  message: string;
  at: string; // ISO datetime
}

export interface AppSettings {
  id: number; // always 1
  gymName: string;
  address: string;
  phone: string;
  logo?: string; // data URL
  notificationsEnabled: boolean;
  lastMorningSummary?: string; // ISO date of last browser notification
}

/** Member joined with derived membership info for lists. */
export interface MemberView {
  member: Member;
  membership: Membership | null;
  status: MemberStatus;
  daysLeft: number | null;
  outstanding: number;
}

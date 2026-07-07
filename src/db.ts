import Dexie, { Table } from 'dexie';
import type {
  Activity,
  AppSettings,
  Campaign,
  Employee,
  Member,
  Membership,
  Package,
  Payment,
} from './types';

export class GymDB extends Dexie {
  members!: Table<Member, number>;
  packages!: Table<Package, number>;
  memberships!: Table<Membership, number>;
  payments!: Table<Payment, number>;
  employees!: Table<Employee, number>;
  campaigns!: Table<Campaign, number>;
  activities!: Table<Activity, number>;
  settings!: Table<AppSettings, number>;

  constructor() {
    super('gymapp');
    this.version(1).stores({
      members: '++id, fullName, phone, deletedAt',
      packages: '++id, name, active',
      memberships: '++id, memberId, endDate, createdAt',
      payments: '++id, memberId, membershipId, paymentDate',
      employees: '++id, name',
      campaigns: '++id, createdAt',
      activities: '++id, at',
      settings: 'id',
    });
  }
}

export const db = new GymDB();

const DEFAULT_PACKAGES: Package[] = [
  { name: '1 Month', durationMonths: 1, price: 1000, description: 'Monthly membership', active: true },
  { name: '3 Months', durationMonths: 3, price: 2700, description: 'Quarterly membership', active: true },
  { name: '6 Months', durationMonths: 6, price: 5000, description: 'Half-yearly membership', active: true },
  { name: '12 Months', durationMonths: 12, price: 9000, description: 'Annual membership', active: true },
];

export async function seedDatabase() {
  const pkgCount = await db.packages.count();
  if (pkgCount === 0) {
    await db.packages.bulkAdd(DEFAULT_PACKAGES);
  }
  const settings = await db.settings.get(1);
  if (!settings) {
    await db.settings.add({
      id: 1,
      gymName: 'My Gym',
      address: '',
      phone: '',
      notificationsEnabled: false,
    });
  }
}

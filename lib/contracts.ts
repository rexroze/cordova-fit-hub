export type Role = "owner" | "staff" | "member";
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  mustChangePassword: boolean;
  memberId?: string;
}
export interface Member {
  id: string;
  memberCode: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  createdAt: string;
  qrToken?: string;
}
export interface Plan {
  id: string;
  name: string;
  durationMonths: number;
  price: number;
  active: boolean;
}
export interface Membership {
  id: string;
  memberId: string;
  planId: string;
  startsAt: string;
  expiresAt: string;
  price: number;
  paidAmount: number;
  status: "active" | "expired" | "upcoming" | "unpaid";
}
export interface Payment {
  id: string;
  memberId: string;
  membershipId: string;
  amount: number;
  method: "cash" | "gcash" | "bank_transfer";
  reference?: string;
  paidAt: string;
  recordedBy?: string;
}
export interface Attendance {
  id: string;
  memberId: string;
  checkedInAt: string;
  method: "qr" | "manual";
}
export interface Analytics {
  metrics: {
    totalMembers: number;
    activeMemberships: number;
    monthlyRevenue: number;
    todayAttendance: number;
    expiringMemberships: number;
    expiredMemberships: number;
  };
  revenueSeries: { month: string; revenue: number }[];
  attendanceSeries: { date: string; visits: number }[];
  planDistribution: { name: string; members: number }[];
  sourceDistribution: { name: string; members: number }[];
  forecast: {
    nextMonthRevenue: number;
    method: string;
    explanation: string;
    sufficientData: boolean;
  };
  recommendations: { title: string; description: string; severity: string }[];
}
export interface BootstrapData {
  user: SessionUser;
  members: Member[];
  plans: Plan[];
  memberships: Membership[];
  payments: Payment[];
  attendance: Attendance[];
  staff: SessionUser[];
  analytics: Analytics | null;
  auditLog?: unknown[];
  isDemo: true;
}

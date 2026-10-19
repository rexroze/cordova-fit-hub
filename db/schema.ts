import {
  pgTable,
  text,
  boolean,
  integer,
  timestamp,
  date,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  memberId: text("member_id"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const members = pgTable("members", {
  id: text("id").primaryKey(),
  memberCode: text("member_code").notNull().unique(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  source: text("source").notNull(),
  qrToken: text("qr_token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const plans = pgTable("plans", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  durationMonths: integer("duration_months").notNull(),
  priceCents: integer("price_cents").notNull(),
  active: boolean("active").notNull().default(true),
});
export const memberships = pgTable(
  "memberships",
  {
    id: text("id").primaryKey(),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id),
    planId: text("plan_id")
      .notNull()
      .references(() => plans.id),
    startsAt: date("starts_at").notNull(),
    expiresAt: date("expires_at").notNull(),
    priceCents: integer("price_cents").notNull(),
    renewalKey: text("renewal_key").unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("memberships_member_idx").on(t.memberId)],
);
export const payments = pgTable("payments", {
  id: text("id").primaryKey(),
  memberId: text("member_id")
    .notNull()
    .references(() => members.id),
  membershipId: text("membership_id")
    .notNull()
    .references(() => memberships.id),
  amountCents: integer("amount_cents").notNull(),
  method: text("method").notNull(),
  reference: text("reference"),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
  recordedBy: text("recorded_by")
    .notNull()
    .references(() => users.id),
});
export const attendance = pgTable(
  "attendance",
  {
    id: text("id").primaryKey(),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    manilaDate: date("manila_date").notNull(),
    method: text("method").notNull(),
  },
  (t) => [
    uniqueIndex("attendance_member_day_unique").on(t.memberId, t.manilaDate),
  ],
);
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
export const loginLimits = pgTable("login_limits", {
  key: text("key").primaryKey(),
  attempts: integer("attempts").notNull(),
  windowStartedAt: timestamp("window_started_at", {
    withTimezone: true,
  }).notNull(),
  blockedUntil: timestamp("blocked_until", { withTimezone: true }),
});
export const auditLog = pgTable("audit_log", {
  id: text("id").primaryKey(),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  detail: text("detail").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

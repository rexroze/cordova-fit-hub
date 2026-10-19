import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { Pool, type PoolClient } from "pg";
import { addMonthsClamped, manilaToday } from "../lib/dates";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const pool = new Pool({ connectionString: databaseUrl });
const id = () => randomUUID();
const cents = [50000, 135000, 480000];
const durations = [1, 3, 12];
const planNames = ["Monthly", "Quarterly", "Annual"];
const sources = [
  "Walk-in",
  "Social media",
  "Referral",
  "Corporate",
  "Community event",
];
const names = [
  "Ari",
  "Bea",
  "Carlo",
  "Dina",
  "Eli",
  "Faye",
  "Gio",
  "Hana",
  "Ivo",
  "Jules",
  "Kira",
  "Luca",
];

async function createUser(
  client: PoolClient,
  name: string,
  email: string,
  password: string,
  role: string,
  memberId: string | null = null,
) {
  await client.query(
    "INSERT INTO users(id,name,email,password_hash,role,member_id,must_change_password) VALUES($1,$2,$3,$4,$5,$6,false)",
    [
      id(),
      name,
      email.toLowerCase(),
      await bcrypt.hash(password, 12),
      role,
      memberId,
    ],
  );
}

async function insertRows(
  client: PoolClient,
  table: string,
  columns: string[],
  rows: unknown[][],
) {
  if (!rows.length) return;
  // Batch in modest chunks to remain below PostgreSQL's bind-parameter ceiling.
  const chunkSize = Math.floor(60000 / columns.length);
  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const chunk = rows.slice(offset, offset + chunkSize);
    const params: unknown[] = [];
    const values = chunk
      .map(
        (row, rowIndex) =>
          `(${row
            .map((value, columnIndex) => {
              params.push(value);
              return `$${rowIndex * columns.length + columnIndex + 1}`;
            })
            .join(",")})`,
      )
      .join(",");
    await client.query(
      `INSERT INTO ${table}(${columns.join(",")}) VALUES ${values}`,
      params,
    );
  }
}

async function main() {
  const config = [
    "DEMO_OWNER_EMAIL",
    "DEMO_OWNER_PASSWORD",
    "DEMO_STAFF_EMAIL",
    "DEMO_STAFF_PASSWORD",
  ] as const;
  const values = config.map((key) => process.env[key]);
  if (values.some((value) => !value))
    throw new Error(`Set ${config.join(", ")} in .env.local`);
  const [ownerEmail, ownerPassword, staffEmail, staffPassword] = values as [
    string,
    string,
    string,
    string,
  ];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "CREATE TABLE IF NOT EXISTS demo_seed_runs (seed_key text PRIMARY KEY, completed_at timestamptz NOT NULL DEFAULT now())",
    );
    const marker = await client.query(
      "SELECT seed_key FROM demo_seed_runs WHERE seed_key='cordova-fit-hub-demo-v1'",
    );
    if (marker.rowCount) {
      await client.query("COMMIT");
      console.info("Demo seed already completed; no changes made.");
      return;
    }
    const existing = await client.query(
      "SELECT email FROM users WHERE lower(email)=ANY($1::text[])",
      [
        [ownerEmail, staffEmail, "demo.member001@example.test"].map((email) =>
          email.toLowerCase(),
        ),
      ],
    );
    if (existing.rowCount)
      throw new Error(
        "Seed identities already exist without a completed demo marker; refusing to overwrite or duplicate partial data.",
      );

    await createUser(client, "Demo Owner", ownerEmail, ownerPassword, "owner");
    const owner = await client.query<{ id: string }>(
      "SELECT id FROM users WHERE lower(email)=$1",
      [ownerEmail.toLowerCase()],
    );
    await createUser(client, "Demo Staff", staffEmail, staffPassword, "staff");
    const ownerId = owner.rows[0].id;
    const planIds: string[] = [];
    for (let i = 0; i < planNames.length; i++) {
      const planId = id();
      planIds.push(planId);
      await client.query(
        "INSERT INTO plans(id,name,duration_months,price_cents) VALUES($1,$2,$3,$4)",
        [planId, planNames[i], durations[i], cents[i]],
      );
    }

    const today = manilaToday();
    const memberIds: string[] = [];
    const membershipByMember = new Map<
      number,
      { id: string; start: string; end: string; paid: boolean }[]
    >();
    const memberRows: unknown[][] = [];
    const memberUserRows: unknown[][] = [];
    const membershipRows: unknown[][] = [];
    const paymentRows: unknown[][] = [];
    const attendanceRows: unknown[][] = [];
    for (let i = 0; i < 72; i++) {
      const memberId = id();
      memberIds.push(memberId);
      const n = i + 1;
      const email = `demo.member${String(n).padStart(3, "0")}@example.test`;
      const phone = `+63917${String(1000000 + i).slice(-7)}`;
      const name = `${names[i % names.length]} Demo Member ${String(n).padStart(3, "0")}`;
      memberRows.push([
        memberId,
        `CFH-D${String(n).padStart(3, "0")}`,
        name,
        email,
        phone,
        sources[i % sources.length],
        randomBytes(32).toString("base64url"),
      ]);
      memberUserRows.push([
        id(),
        name,
        email,
        phone,
        await bcrypt.hash(phone, 12),
        memberId,
      ]);

      const memberPlans: {
        id: string;
        start: string;
        end: string;
        paid: boolean;
      }[] = [];
      // Member 001 starts recently, is fully paid through today, and has no check-in today.
      if (i === 0) {
        const start = addMonthsClamped(today, -1);
        const end = addMonthsClamped(start, 3);
        const membershipId = id();
        membershipRows.push([
          membershipId,
          memberId,
          planIds[1],
          start,
          end,
          cents[1],
        ]);
        paymentRows.push([
          id(),
          memberId,
          membershipId,
          cents[1],
          "gcash",
          "DEMO-SEED-001",
          `${start}T10:00:00+08:00`,
          ownerId,
        ]);
        memberPlans.push({ id: membershipId, start, end, paid: true });
      } else {
        // Older records are sequential and non-overlapping, with no start date after today.
        const ageMonths = 1 + ((i * 5) % 10);
        const count = 1 + (i % 3);
        let end = addMonthsClamped(today, -ageMonths);
        for (let j = count - 1; j >= 0; j--) {
          const planIndex = (i + j) % 3;
          const start = addMonthsClamped(end, -durations[planIndex]);
          const membershipId = id();
          const paid = !(i % 9 === 0 && j === count - 1);
          membershipRows.push([
            membershipId,
            memberId,
            planIds[planIndex],
            start,
            end,
            cents[planIndex],
          ]);
          if (paid) {
            paymentRows.push([
              id(),
              memberId,
              membershipId,
              cents[planIndex],
              ["cash", "gcash", "bank_transfer"][i % 3],
              `DEMO-${String(n).padStart(3, "0")}-${j}`,
              `${start}T10:00:00+08:00`,
              ownerId,
            ]);
          }
          memberPlans.unshift({ id: membershipId, start, end, paid });
          end = start;
        }
        // Create a present-day paid membership for a rotating cohort, with controlled expiry spread.
        if (i % 4 === 1) {
          const planIndex = i % 3;
          const duration = durations[planIndex];
          const start =
            i % 8 === 1
              ? addMonthsClamped(today, -duration)
              : new Date(
                  Date.parse(`${today}T00:00:00Z`) -
                    (duration * 30 - (2 + (i % 3))) * 86400000,
                )
                  .toISOString()
                  .slice(0, 10);
          const end = addMonthsClamped(start, duration);
          const membershipId = id();
          membershipRows.push([
            membershipId,
            memberId,
            planIds[planIndex],
            start,
            end,
            cents[planIndex],
          ]);
          paymentRows.push([
            id(),
            memberId,
            membershipId,
            cents[planIndex],
            "cash",
            `DEMO-CURRENT-${n}`,
            `${start}T10:00:00+08:00`,
            ownerId,
          ]);
          memberPlans.push({ id: membershipId, start, end, paid: true });
        }
      }
      membershipByMember.set(i, memberPlans);
    }

    await insertRows(
      client,
      "members",
      ["id", "member_code", "name", "email", "phone", "source", "qr_token"],
      memberRows,
    );
    await insertRows(
      client,
      "users",
      [
        "id",
        "name",
        "email",
        "phone",
        "password_hash",
        "role",
        "member_id",
        "must_change_password",
      ],
      memberUserRows.map(([userId, name, email, phone, hash, memberId]) => [
        userId,
        name,
        email,
        phone,
        hash,
        "member",
        memberId,
        true,
      ]),
    );
    await insertRows(
      client,
      "memberships",
      ["id", "member_id", "plan_id", "starts_at", "expires_at", "price_cents"],
      membershipRows,
    );
    await insertRows(
      client,
      "payments",
      [
        "id",
        "member_id",
        "membership_id",
        "amount_cents",
        "method",
        "reference",
        "paid_at",
        "recorded_by",
      ],
      paymentRows,
    );

    // Realistic attendance observations are always after a paid membership begins and before expiry.
    for (let i = 0; i < memberIds.length; i++) {
      const eligible = (membershipByMember.get(i) ?? []).filter(
        (membership) =>
          membership.paid && membership.start < today && membership.end > today,
      );
      const history =
        eligible[0] ??
        (membershipByMember.get(i) ?? []).find(
          (membership) => membership.paid && membership.end <= today,
        );
      if (!history) continue;
      const visits = 7 + (i % 10);
      const endDate = history.end < today ? history.end : today;
      const daySpan = Math.max(
        1,
        Math.floor(
          (Date.parse(`${endDate}T00:00:00Z`) -
            Date.parse(`${history.start}T00:00:00Z`)) /
            86400000,
        ),
      );
      for (let visit = 0; visit < visits; visit++) {
        // Historical member behavior tapers over recent periods for evidence-based risk analytics.
        const offset = Math.max(
          1,
          Math.floor(((visit + 1) * daySpan) / (visits + 2)),
        );
        const date = new Date(
          Date.parse(`${history.start}T00:00:00Z`) + offset * 86400000,
        )
          .toISOString()
          .slice(0, 10);
        if (date >= history.end || date >= today) continue;
        const checkedInAt = `${date}T${String(8 + (visit % 12)).padStart(2, "0")}:${String((i * 7 + visit * 11) % 60).padStart(2, "0")}:00+08:00`;
        attendanceRows.push([
          id(),
          memberIds[i],
          checkedInAt,
          date,
          visit % 3 ? "qr" : "manual",
        ]);
      }
    }
    await insertRows(
      client,
      "attendance",
      ["id", "member_id", "checked_in_at", "manila_date", "method"],
      attendanceRows,
    );
    await client.query(
      "INSERT INTO demo_seed_runs(seed_key) VALUES('cordova-fit-hub-demo-v1')",
    );
    await client.query("COMMIT");
    console.info("Demo seed completed.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(
    "Demo seed failed:",
    error instanceof Error ? error.message : "Unknown error",
  );
  process.exitCode = 1;
});

// Runs the real migrations in an in-process Postgres (PGlite) with a stubbed
// Supabase auth/storage, and checks constraints and RLS isolation.
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const dir = path.join(__dirname, "../migrations");
const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
let db: PGlite;
let bizA: string, bizB: string, staffA: string, svc: string, cus: string;

async function as<T>(uid: string, email: string, fn: () => Promise<T>) {
  await db.exec(`set role authenticated;
    select set_config('request.jwt.claim.sub','${uid}',false);
    select set_config('request.jwt.claims','{"email":"${email}"}',false);`);
  try { return await fn(); } finally { await db.exec("reset role"); }
}

function book(start: string, end: string, token: string, status = "confirmed") {
  return db.query(
    `insert into bookings(business_id,staff_id,service_id,customer_id,starts_at,ends_at,
       buffer_after_minutes,status,service_name,duration_minutes,price_pence,cancel_token_hash)
     values($1,$2,$3,$4,$5,$6,10,$7,'Gel',60,3000,decode(md5($8),'hex'))`,
    [bizA, staffA, svc, cus, start, end, status, token]);
}

beforeAll(async () => {
  db = new PGlite({ extensions: { btree_gist } });
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;
    grant usage on schema auth, public to authenticated, anon;
    create schema storage;
    create table storage.buckets(id text primary key, name text, public bool,
      file_size_limit int, allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated;
    grant select, insert, update, delete on storage.objects to authenticated;`);
  for (const f of fs.readdirSync(dir).sort()) {
    // pgcrypto is not bundled in PGlite; gen_random_uuid() is built in.
    await db.exec(fs.readFileSync(path.join(dir, f), "utf8").replace("create extension if not exists pgcrypto;", ""));
  }
  await db.exec(`insert into auth.users values ('${A}','a@x.com'),('${B}','b@x.com')`);
  bizA = (await as(A, "a@x.com", () => db.query<{ id: string }>(`select public.create_business('Lily Nails','lily-nails','Lily') id`))).rows[0].id;
  bizB = (await as(B, "b@x.com", () => db.query<{ id: string }>(`select public.create_business('Other','other-biz','Bob') id`))).rows[0].id;
  staffA = (await db.query<{ id: string }>(`select id from staff where business_id=$1`, [bizA])).rows[0].id;
  await db.query(`insert into services(business_id,name,duration_minutes,buffer_after_minutes) values($1,'Gel',60,10)`, [bizA]);
  svc = (await db.query<{ id: string }>(`select id from services where business_id=$1`, [bizA])).rows[0].id;
  await db.query(`insert into customers(business_id,name,email) values($1,'C','c@x.com')`, [bizA]);
  cus = (await db.query<{ id: string }>(`select id from customers`)).rows[0].id;
});

describe("double booking", () => {
  it("accepts the first booking", async () => {
    await book("2026-06-01 10:00+01", "2026-06-01 11:00+01", "1");
  });
  it("rejects an overlapping booking for the same staff", async () => {
    await expect(book("2026-06-01 10:30+01", "2026-06-01 11:30+01", "2")).rejects.toThrow(/no_double_booking/);
  });
  it("rejects a booking inside the buffer", async () => {
    await expect(book("2026-06-01 11:05+01", "2026-06-01 12:05+01", "3")).rejects.toThrow(/no_double_booking/);
  });
  it("allows a booking right after the buffer", async () => {
    await book("2026-06-01 11:10+01", "2026-06-01 12:10+01", "4");
  });
  it("frees the slot once cancelled", async () => {
    await db.exec(`update bookings set status='cancelled' where starts_at='2026-06-01 10:00+01'`);
    await book("2026-06-01 10:00+01", "2026-06-01 11:00+01", "5");
  });
});

describe("other constraints", () => {
  it("rejects overlapping working hours", async () => {
    await db.query(`insert into working_hours(business_id,staff_id,weekday,start_minute,end_minute) values($1,$2,1,540,720)`, [bizA, staffA]);
    await expect(db.query(`insert into working_hours(business_id,staff_id,weekday,start_minute,end_minute) values($1,$2,1,700,900)`, [bizA, staffA])).rejects.toThrow(/no_overlap/);
  });
  it("rejects a deposit larger than the price", async () => {
    await expect(db.query(`insert into services(business_id,name,duration_minutes,price_pence,deposit_pence) values($1,'Bad',30,1000,2000)`, [bizA])).rejects.toThrow(/check/);
  });
  it("rejects cross-tenant references", async () => {
    await expect(db.query(`insert into staff_services(business_id,staff_id,service_id) values($1,$2,$3)`, [bizB, staffA, svc])).rejects.toThrow(/foreign key/);
  });
});

describe("RLS", () => {
  it("lets a user see only their own business and bookings", async () => {
    expect((await as(A, "a@x.com", () => db.query(`select slug from businesses`))).rows).toEqual([{ slug: "lily-nails" }]);
    expect((await as(B, "b@x.com", () => db.query(`select count(*)::int n from bookings`))).rows[0]).toEqual({ n: 0 });
  });
  it("blocks cross-tenant updates", async () => {
    const r = await as(B, "b@x.com", () => db.query(`update businesses set name='hax' where id=$1 returning id`, [bizA]));
    expect(r.rows).toHaveLength(0);
  });
  it("blocks clients writing subscription or consent columns", async () => {
    await expect(as(A, "a@x.com", () => db.query(`update businesses set subscription_status='active'`))).rejects.toThrow(/permission denied/);
    await expect(as(A, "a@x.com", () => db.query(`update customers set marketing_consent=true`))).rejects.toThrow(/permission denied/);
  });
  it("gives anon no access", async () => {
    await db.exec("set role anon");
    try { await expect(db.query(`select * from businesses`)).rejects.toThrow(/permission denied/); }
    finally { await db.exec("reset role"); }
  });
  it("allows a second business only once per user", async () => {
    await expect(as(A, "a@x.com", () => db.query(`select public.create_business('X','xxx','A')`))).rejects.toThrow(/already belongs/);
  });
  it("scopes logo uploads to the owner's business folder", async () => {
    await as(A, "a@x.com", () => db.query(`insert into storage.objects(bucket_id,name) values('logos',$1)`, [`${bizA}/x.png`]));
    await expect(as(B, "b@x.com", () => db.query(`insert into storage.objects(bucket_id,name) values('logos',$1)`, [`${bizA}/y.png`]))).rejects.toThrow(/row-level security/);
    await expect(as(A, "a@x.com", () => db.query(`insert into storage.objects(bucket_id,name) values('logos','nope/z.png')`))).rejects.toThrow(/row-level security/);
  });
});

describe("set_working_hours / set_staff_services", () => {
  const S = "00000000-0000-0000-0000-00000000000c";
  let staffS: string;
  const hours = (rows: [number, number, number][]) =>
    JSON.stringify(rows.map(([weekday, start, end]) => ({ weekday, start, end })));
  const setHours = (uid: string, email: string, staff: string, rows: [number, number, number][]) =>
    as(uid, email, () => db.query(`select public.set_working_hours($1, $2::jsonb)`, [staff, hours(rows)]));
  const count = async (staff: string) =>
    (await db.query<{ n: number }>(`select count(*)::int n from working_hours where staff_id=$1`, [staff])).rows[0].n;

  beforeAll(async () => {
    await db.exec(`insert into auth.users values ('${S}','s@x.com')`);
    staffS = (await db.query<{ id: string }>(
      `insert into staff(business_id,user_id,name) values($1,$2,'Sam') returning id`, [bizA, S])).rows[0].id;
    await db.query(`insert into business_members(business_id,user_id,role) values($1,$2,'staff')`, [bizA, S]);
  });

  it("replaces the weekly hours in one go", async () => {
    await setHours(A, "a@x.com", staffA, [[1, 540, 1020], [2, 540, 1020]]);
    expect(await count(staffA)).toBe(2);
    await setHours(A, "a@x.com", staffA, [[3, 600, 900]]);
    expect(await count(staffA)).toBe(1);
  });
  it("keeps the old hours if the new set is invalid (atomic)", async () => {
    await expect(setHours(A, "a@x.com", staffA, [[4, 540, 720], [4, 700, 900]])).rejects.toThrow(/no_overlap/);
    expect(await count(staffA)).toBe(1);
  });
  it("lets a staff member edit only their own hours", async () => {
    await setHours(S, "s@x.com", staffS, [[1, 540, 1020]]);
    expect(await count(staffS)).toBe(1);
    await expect(setHours(S, "s@x.com", staffA, [[1, 0, 60]])).rejects.toThrow(/row-level security/);
    expect(await count(staffA)).toBe(1);
  });
  it("cannot touch another business's staff", async () => {
    await expect(setHours(B, "b@x.com", staffA, [[1, 540, 600]])).rejects.toThrow(/not found/);
  });
  it("assigns services, and blocks services from another business", async () => {
    await as(A, "a@x.com", () => db.query(`select public.set_staff_services($1, array[$2]::uuid[])`, [staffA, svc]));
    expect((await db.query(`select 1 from staff_services where staff_id=$1`, [staffA])).rows).toHaveLength(1);
    await db.query(`insert into services(business_id,name,duration_minutes) values($1,'Other',30)`, [bizB]);
    const foreign = (await db.query<{ id: string }>(`select id from services where business_id=$1`, [bizB])).rows[0].id;
    await expect(as(A, "a@x.com", () => db.query(`select public.set_staff_services($1, array[$2]::uuid[])`, [staffA, foreign]))).rejects.toThrow(/foreign key/);
    expect((await db.query(`select 1 from staff_services where staff_id=$1`, [staffA])).rows).toHaveLength(1);
  });
  it("only the owner can assign services", async () => {
    await expect(as(S, "s@x.com", () => db.query(`select public.set_staff_services($1, array[$2]::uuid[])`, [staffS, svc]))).rejects.toThrow(/row-level security/);
  });
});

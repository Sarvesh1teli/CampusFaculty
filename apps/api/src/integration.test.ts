import "dotenv/config";
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
test(
  "marketplace integration: privacy, isolation, quotas and manual UPI approval",
  { timeout: 240000 },
  async () => {
    const schema = "cf_test_" + randomBytes(6).toString("hex");
    const url = new URL(
      process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL!,
    );
    url.searchParams.set("schema", schema);
    const databaseUrl = url.toString();
    // Extension may live in an earlier isolated test schema. Qualify its operator
    // class in a temporary migration copy, never rewrite production migrations.
    const setup=new PrismaClient({datasources:{db:{url:(process.env.MIGRATION_DATABASE_URL||process.env.DATABASE_URL)!}}});
    const ext=await setup.$queryRawUnsafe<any[]>("SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pg_trgm'");
    await setup.$disconnect();
    const temp=fs.mkdtempSync(path.join(os.tmpdir(),'campusfaculty-integration-'));
    fs.cpSync(path.resolve('prisma'),path.join(temp,'prisma'),{recursive:true});
    if(ext[0])for(const dir of fs.readdirSync(path.join(temp,'prisma/migrations'))){const file=path.join(temp,'prisma/migrations',dir,'migration.sql');if(fs.existsSync(file))fs.writeFileSync(file,fs.readFileSync(file,'utf8').replaceAll('gin_trgm_ops','"'+ext[0].nspname.replaceAll('"','""')+'".gin_trgm_ops'));}
    execFileSync(
      process.execPath,
      [
        path.resolve("../../node_modules/prisma/build/index.js"),
        "migrate",
        "deploy",
        "--schema",path.join(temp,"prisma/schema.prisma"),
      ],
      {
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
          MIGRATION_DATABASE_URL: databaseUrl,
        },
        stdio: "pipe",
      },
    );
    const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    const pass = "Test-password-" + randomBytes(5).toString("hex");
    const salt = "test-salt";
    await db.user.create({
      data: {
        email: "test-owner@example.com",
        name: "Test Owner",
        role: "SUPER_ADMIN",
        password: salt + ":" + scryptSync(pass, salt, 64).toString("hex"),
      },
    });
    await db.plan.createMany({
      data: [
        {
          id: "free",
          name: "Free",
          amount: 0,
          credits: 3,
          jobLimit: 2,
          searchLimit: 5,
        },
        {
          id: "paid",
          name: "School",
          amount: 99900,
          credits: 15,
          jobLimit: 5,
          searchLimit: -1,
        },
      ],
    });
    for (const key of [
      "institution_job_posting_enabled",
      "candidate_job_search_enabled",
      "candidate_job_applications_enabled",
      "institution_candidate_search_enabled",
      "institution_candidate_unlock_enabled",
    ])
      await db.setting.create({ data: { key, value: true } });
    await db.setting.create({
      data: {
        key: "payment",
        value: {
          method: "MANUAL_UPI",
          upiId: "test@upi",
          payeeName: "Test",
          qrAsset: "/assets/test.png",
          enabled: true,
        },
      },
    });
    await db.$executeRawUnsafe(
      'GRANT USAGE ON SCHEMA "' + schema + '", app_private TO cf_runtime',
    );
    await db.$executeRawUnsafe(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "' +
        schema +
        '" TO cf_runtime',
    );
    await db.$executeRawUnsafe(
      'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "' +
        schema +
        '" TO cf_runtime',
    );
    const runtimeUrl = new URL(process.env.DATABASE_URL!);
    runtimeUrl.searchParams.set("schema", schema);
    const proc = spawn(process.execPath, ["dist/main.js"], {
      env: {
        ...process.env,
        DATABASE_URL: runtimeUrl.toString(),
        PORT: "3003",
      },
      stdio: "pipe",
    });
    let logs = "";
    proc.on("error", (e) => (logs += e.message));
    proc.on("exit", (code) => (logs += "Process exited " + code));
    proc.stderr.on("data", (d) => (logs += d.toString()));
    proc.stdout.on("data", (d) => (logs += d.toString()));
    const clients: Record<string, { cookie: string; csrf: string }> = {};
    async function request(
      who: string,
      endpoint: string,
      method = "GET",
      body?: any,
      expected = 200,
    ) {
      const c = clients[who] || { cookie: "", csrf: "" };
      const r = await fetch("http://127.0.0.1:3003/api/" + endpoint, {
        method,
        headers: {
          Origin: "http://localhost:5182",
          "Content-Type": "application/json",
          Cookie: c.cookie,
          "x-csrf-token": c.csrf,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await r.json();
      assert.equal(
        r.status,
        expected,
        [endpoint, JSON.stringify(data)].join(" "),
      );
      const cookie = r.headers.get("set-cookie");
      if (cookie)
        clients[who] = { cookie: cookie.split(";")[0], csrf: data.csrf };
      return data;
    }
    try {
      for (let i = 0; i < 400; i++) {
        try {
          await fetch("http://127.0.0.1:3003/api/health");
          break;
        } catch {
          await new Promise((r) => setTimeout(r, 250));
          if (i === 399) throw Error(logs);
        }
      }
      await request(
        "owner",
        "auth/login",
        "POST",
        { email: "test-owner@example.com", password: pass },
        201,
      );
      for (const name of ["A", "B"])
        await request(
          name,
          "auth/register",
          "POST",
          {
            email: name + "@example.com",
            password: pass,
            name: "Recruiter " + name,
            role: "TENANT_ADMIN",
            institution: "School " + name,
          },
          201,
        );
      await request(
        "teacher",
        "auth/register",
        "POST",
        {
          email: "teacher@example.com",
          password: pass,
          name: "Private Name",
          role: "CANDIDATE",
        },
        201,
      );
      const profile = await request("teacher", "profile");
      const fields = {
        subject: "Math",
        qualification: "BEd",
        experience: 5,
        location: "Delhi",
        salary: 40000,
        mobile: "9999999999",
        active: true,
        directoryVisible: false,
        directoryConsent: false,
      };
      await request("teacher", "profile", "PATCH", fields);
      const a = (await request("A", "institution/account")).tenant,
        b = (await request("B", "institution/account")).tenant;
      await request("owner", "admin/tenants/" + a.id, "PATCH", {
        verified: true,
      });
      await request("owner", "admin/tenants/" + b.id, "PATCH", {
        verified: true,
      });
      const job = await request(
        "A",
        "institution/jobs",
        "POST",
        {
          title: "Mathematics teacher",
          subject: "Math",
          location: "Delhi",
          salary: 40000,
          description:
            "Teach middle school mathematics with a supportive team.",
          closesAt: new Date(Date.now() + 20 * 86400000).toISOString(),
        },
        201,
      );
      await request(
        "teacher",
        "jobs/" + job.id + "/apply",
        "POST",
        { contactConsent: true },
        201,
      );
      const applications = await request("A", "institution/hiring");
      assert.equal(applications.length, 1);
      assert.equal(applications[0].candidate.mobile, undefined);
      assert.equal(applications[0].candidate.name, undefined);
      const concurrent = await Promise.all(
        Array.from({ length: 8 }, () =>
          request(
            "A",
            "institution/candidates/" + profile.id + "/unlock",
            "POST",
            {},
            201,
          ),
        ),
      );
      assert.equal(
        concurrent.reduce((n, p) => n + p.charged, 0),
        1,
      );
      assert.equal((await request("A", "institution/account")).credits, 2);
      await request(
        "B",
        "institution/candidates/" + profile.id + "/unlock",
        "POST",
        {},
        403,
      );
      await request(
        "B",
        "institution/hiring/" + applications[0].id,
        "PATCH",
        { stage: "SELECTED" },
        404,
      );
      const sub = await db.subscription.findFirstOrThrow({
        where: { tenantId: a.id },
      });
      await db.subscription.update({
        where: { id: sub.id },
        data: { endsAt: new Date(Date.now() - 1000) },
      });
      await db.creditGrant.updateMany({
        where: { tenantId: a.id },
        data: { remaining: 0 },
      });
      assert.equal(
        (
          await request(
            "A",
            "institution/candidates/" + profile.id + "/unlock",
            "POST",
            {},
            201,
          )
        ).charged,
        0,
      );
      await request(
        "A",
        "institution/jobs",
        "POST",
        {
          title: "Other teacher",
          subject: "Math",
          location: "Delhi",
          salary: 30000,
          description: "Another role with a supportive mathematics department.",
          closesAt: new Date(Date.now() + 86400000).toISOString(),
        },
        403,
      );
      let signal!: () => void;
      const held = new Promise<void>((r) => (signal = r));
      const withdrawing = db.$transaction(async (t) => {
        await t.$queryRawUnsafe(
          "SELECT pg_advisory_xact_lock(hashtext($1))::text",
          "candidate:" + profile.id,
        );
        await t.candidate.update({
          where: { id: profile.id },
          data: { active: false },
        });
        signal();
        await new Promise((r) => setTimeout(r, 300));
      });
      await held;
      await request(
        "A",
        "institution/candidates/" + profile.id + "/contact",
        "GET",
        undefined,
        403,
      );
      await withdrawing;
      await request("teacher", "profile", "PATCH", {
        ...fields,
        active: false,
      });
      await request(
        "A",
        "institution/candidates/" + profile.id + "/contact",
        "GET",
        undefined,
        403,
      );
      await request("teacher", "profile", "PATCH", {
        ...fields,
        active: true,
        directoryVisible: true,
        directoryConsent: true,
      });
      const reviewProfile = await request("teacher", "profile");
      await request(
        "owner",
        "admin/candidates/" + profile.id,
        "PATCH",
        { profileReviewed: true, revision: reviewProfile.revision - 1 },
        400,
      );
      await request("owner", "admin/candidates/" + profile.id, "PATCH", {
        profileReviewed: true,
        revision: reviewProfile.revision,
      });
      const first = await request("B", "institution/candidates?q=Math");
      assert.equal(first.items[0].mobile, undefined);
      await request(
        "B",
        "institution/candidates?q=Math&session=" + first.session + "&page=2",
      );
      assert.equal(
        (await db.subscription.findFirstOrThrow({ where: { tenantId: b.id } }))
          .searchesUsed,
        1,
      );
      assert.equal(
        (
          await request(
            "B",
            "institution/candidates/" + profile.id + "/unlock",
            "POST",
            {},
            201,
          )
        ).charged,
        1,
      );
      await request(
        "B",
        "institution/hiring",
        "POST",
        { candidateId: profile.id },
        201,
      );
      assert.equal((await request("teacher", "applications")).length, 1);
      const payment = await request(
        "A",
        "institution/payments",
        "POST",
        { planId: "paid" },
        201,
      );
      await request(
        "A",
        "institution/payments/" + payment.id + "/submit",
        "POST",
        { utr: "UPI-123456" },
        201,
      );
      assert.equal(
        (await request("A", "institution/account")).subscription,
        null,
      );
      await request(
        "owner",
        "admin/payments/" + payment.id + "/decision",
        "POST",
        {
          approve: true,
          receiptReference: "BANK-123456",
          receivedAmount: 1,
          reason: "Mismatch checked",
        },
        400,
      );
      const approved = await Promise.all(
        Array.from({ length: 5 }, () =>
          request(
            "owner",
            "admin/payments/" + payment.id + "/decision",
            "POST",
            {
              approve: true,
              receiptReference: "BANK-123456",
              receivedAmount: 99900,
              reason: "Receipt verified in bank account",
            },
            201,
          ),
        ),
      );
      assert.equal(approved.length, 5);
      assert.equal(
        await db.subscription.count({ where: { paymentId: payment.id } }),
        1,
      );
      assert.equal(
        await db.invoice.count({ where: { paymentId: payment.id } }),
        1,
      );
      assert.equal((await request("A", "institution/account")).credits, 15);
      const other = await request(
        "B",
        "institution/payments",
        "POST",
        { planId: "paid" },
        201,
      );
      await request(
        "B",
        "institution/payments/" + other.id + "/submit",
        "POST",
        { utr: "BANK-123456" },
        201,
      );
      await request(
        "owner",
        "admin/payments/" + other.id + "/decision",
        "POST",
        {
          approve: true,
          receiptReference: "BANK-123456",
          receivedAmount: 99900,
          reason: "Duplicate receipt",
        },
        400,
      );
      await request(
        "owner",
        "admin/payments/" + other.id + "/decision",
        "POST",
        {
          approve: true,
          receiptReference: "BANK-OTHER-RECEIPT",
          receivedAmount: 99900,
          reason: "Different receipt verified",
        },
        201,
      );
      const upgraded = await request("B", "institution/account");
      assert.equal(upgraded.subscription.snapshot.name, "School");
      assert.equal(upgraded.credits, 15);
      // Database defense in depth: pooled connections must not inherit another tenant's context.
      const restricted = new PrismaClient({
        datasources: { db: { url: runtimeUrl.toString() } },
      });
      try {
        assert.equal(await restricted.paymentRequest.count(), 0);
        await restricted.$transaction(async (t) => {
          await t.$queryRawUnsafe(
            "SELECT set_config('app.role','TENANT_ADMIN',true),set_config('app.tenant',$1,true)",
            a.id,
          );
          assert.equal(
            await t.paymentRequest.count({ where: { tenantId: b.id } }),
            0,
          );
          assert.ok(
            (await t.paymentRequest.count({ where: { tenantId: a.id } })) > 0,
          );
        });
        assert.equal(await restricted.paymentRequest.count(), 0);
      } finally {
        await restricted.$disconnect();
      }
      const ownApplications = await request("teacher", "applications");
      await request(
        "teacher",
        "applications/" + ownApplications[0].id,
        "PATCH",
        { withdraw: true },
      );
      const withdrewAt = (await request("teacher", "applications"))[0].closedAt;
      await request(
        "teacher",
        "applications/" + ownApplications[0].id,
        "PATCH",
        { withdraw: true },
      );
      assert.equal(
        (await request("teacher", "applications"))[0].closedAt,
        withdrewAt,
      );
      await request("teacher", "profile", "PATCH", {
        ...fields,
        directoryVisible: true,
        directoryConsent: false,
      });
      await request(
        "A",
        "institution/candidates/" + profile.id + "/contact",
        "GET",
        undefined,
        403,
      );
      await request(
        "A",
        "institution/hiring/" + applications[0].id,
        "PATCH",
        { stage: "SELECTED" },
        400,
      );
      await request("A", "institution/hiring/" + applications[0].id, "PATCH", {
        stage: "WITHDRAWN",
        note: "Retained internal note",
      });
      assert.equal(
        (await request("teacher", "applications"))[0].status,
        "WITHDRAWN",
      );
      // New simple commerce runs in the same isolated test schema.
      const simple = {
        enabled: true,
        profileFee: 0,
        applicationFee: 0,
        jobFee: 0,
        unlockPaid: true,
        packPrice: 20000,
        packCredits: 5,
        validityDays: 365,
      };
      await request("owner", "admin/settings/simple_pricing", "PATCH", {
        value: simple,
      });
      const beforePack = (await request("A", "institution/account")).credits;
      const pack = await request(
        "A",
        "commerce/orders",
        "POST",
        { kind: "UNLOCK_PACK", quantity: 2 },
        201,
      );
      assert.equal(pack.amount, 40000);
      assert.equal(pack.snapshot.credits, 10);
      await request(
        "B",
        "commerce/orders/" + pack.id + "/submit",
        "POST",
        { utr: "FAKE-OTHER", amount: 40000 },
        404,
      );
      assert.equal(
        (await request("B", "commerce/orders")).some(
          (o: any) => o.id === pack.id,
        ),
        false,
      );
      await request(
        "A",
        "admin/commerce/" + pack.id + "/discount",
        "PATCH",
        { discount: 5000, reason: "Test discount" },
        403,
      );
      await request(
        "owner",
        "admin/commerce/" + pack.id + "/discount",
        "PATCH",
        { discount: 5000, reason: "Test discount" },
      );
      await request(
        "A",
        "commerce/orders/" + pack.id + "/submit",
        "POST",
        { utr: "FAKE-PACK-1", amount: 40000 },
        400,
      );
      await request(
        "A",
        "commerce/orders/" + pack.id + "/submit",
        "POST",
        { utr: "FAKE-PACK-1", amount: 35000 },
        201,
      );
      assert.equal(
        (await request("A", "institution/account")).credits,
        beforePack,
      );
      await request(
        "owner",
        "admin/commerce/" + pack.id + "/discount",
        "PATCH",
        { discount: 4000, reason: "Too late discount" },
        400,
      );
      await request(
        "owner",
        "admin/commerce/" + pack.id + "/decision",
        "POST",
        {
          approve: true,
          receivedAmount: 40000,
          receiptReference: "FAKE-PACK-1",
          reason: "Incorrect amount",
        },
        400,
      );
      await Promise.all(
        Array.from({ length: 4 }, () =>
          request(
            "owner",
            "admin/commerce/" + pack.id + "/decision",
            "POST",
            {
              approve: true,
              receivedAmount: 35000,
              receiptReference: "FAKE-PACK-1",
              reason: "Isolated test receipt",
            },
            201,
          ),
        ),
      );
      assert.equal(
        (await request("A", "institution/account")).credits,
        beforePack + 10,
      );
      assert.equal(
        await db.creditTransaction.count({ where: { reference: pack.id } }),
        1,
      );
      await request("owner", "admin/settings/simple_pricing", "PATCH", {
        value: { ...simple, packPrice: 30000, packCredits: 4 },
      });
      const saved = (await request("A", "commerce/orders")).find(
        (o: any) => o.id === pack.id,
      );
      assert.equal(saved.amount, 35000);
      assert.equal(saved.snapshot.credits, 10);
      await request("owner", "admin/settings/simple_pricing", "PATCH", {
        value: {
          ...simple,
          profileFee: 1000,
          jobFee: 2000,
          applicationFee: 500,
        },
      });
      await request('teacher','profile','PATCH',fields); // free activations remain valid
      await request('teacherPaid','auth/register','POST',{email:'paid-teacher@example.com',password:pass,name:'Paid Teacher',role:'CANDIDATE'},201);
      await request("teacherPaid", "profile", "PATCH", fields, 403);
      async function purchase(who: string, kind: string, target = "") {
        const o = await request(
          who,
          "commerce/orders",
          "POST",
          { kind, target },
          201,
        );
        await request(
          who,
          "commerce/orders/" + o.id + "/submit",
          "POST",
          { utr: "FAKE-" + o.id, amount: o.amount },
          201,
        );
        await request(
          "owner",
          "admin/commerce/" + o.id + "/decision",
          "POST",
          {
            approve: true,
            receivedAmount: o.amount,
            receiptReference: "FAKE-" + o.id,
            reason: "Isolated test only",
          },
          201,
        );
        return o;
      }
      await purchase("teacherPaid", "PROFILE");
      await request("teacherPaid", "profile", "PATCH", fields);
      await request("teacherPaid", "profile", "PATCH", fields); // activation is not charged per edit
      const paidJobFields = {
        title: "Paid posting test",
        subject: "Math",
        location: "Delhi",
        salary: 40000,
        description: "A paid posting entitlement test description.",
        closesAt: new Date(Date.now() + 86400000).toISOString(),
      };
      await request("A", "institution/jobs", "POST", paidJobFields, 403);
      await purchase("A", "JOB");
      const paidJob = await request(
        "A",
        "institution/jobs",
        "POST",
        paidJobFields,
        201,
      );
      await request("A", "institution/jobs", "POST", paidJobFields, 403); // exactly one posting
      await request(
        "teacher",
        "jobs/" + paidJob.id + "/apply",
        "POST",
        { contactConsent: true },
        403,
      );
      const appFee = await purchase("teacher", "APPLICATION", paidJob.id);
      await request(
        "teacher",
        "jobs/" + paidJob.id + "/apply",
        "POST",
        { contactConsent: true },
        201,
      );
      await request(
        "teacher",
        "jobs/" + paidJob.id + "/apply",
        "POST",
        { contactConsent: true },
        201,
      ); // idempotent
      assert.ok(
        (await db.commerceOrder.findUniqueOrThrow({ where: { id: appFee.id } }))
          .consumedAt,
      );
      await request("owner", "admin/settings/simple_pricing", "PATCH", {
        value: simple,
      });
      await request("A", "institution/jobs", "POST", paidJobFields, 201); // default free has no subscription quota
      assert.ok((await request("A", "institution/candidates?q=Math")).items);
      // Closed paid application keeps its approved fee available for manual refund resolution.
      const closedJob = await request(
        "A",
        "institution/jobs",
        "POST",
        paidJobFields,
        201,
      );
      await request("owner", "admin/settings/simple_pricing", "PATCH", {
        value: { ...simple, applicationFee: 500 },
      });
      const closedFee = await purchase("teacher", "APPLICATION", closedJob.id);
      await request(
        "A",
        "institution/jobs/" + closedJob.id + "/close",
        "PATCH",
        {},
      );
      await request(
        "teacher",
        "jobs/" + closedJob.id + "/apply",
        "POST",
        { contactConsent: true },
        400,
      );
      assert.equal(
        (
          await db.commerceOrder.findUniqueOrThrow({
            where: { id: closedFee.id },
          })
        ).consumedAt,
        null,
      );
      await request("owner", "admin/settings/simple_pricing", "PATCH", {
        value: simple,
      });

      await request(
        "owner",
        "admin/commerce/" + closedFee.id + "/refund",
        "POST",
        {
          reference: "FAKE-REFUND",
          reason: "Closed job fee reimbursed externally",
          confirmedReimbursed: true,
        },
        201,
      );
      assert.equal(
        (
          await db.commerceOrder.findUniqueOrThrow({
            where: { id: closedFee.id },
          })
        ).status,
        "REFUNDED",
      );
      await request(
        "owner",
        "admin/commerce/" + appFee.id + "/refund",
        "POST",
        {
          reference: "FAKE-REFUND2",
          reason: "Cannot refund consumed fee",
          confirmedReimbursed: true,
        },
        400,
      );
      await request('teacherPaid','profile','PATCH',{...fields,directoryVisible:true,directoryConsent:true});
      const newProfile=await request('teacherPaid','profile');
      await request('owner','admin/candidates/'+newProfile.id,'PATCH',{profileReviewed:true,revision:newProfile.revision});
      await db.creditGrant.updateMany({where:{tenantId:a.id,NOT:{subscriptionId:{startsWith:'pack:'}}},data:{expiresAt:new Date(Date.now()-1000)}});
      const packBalance=(await request('A','institution/account')).credits;
      const packUnlocks=await Promise.all(Array.from({length:4},()=>request('A','institution/candidates/'+newProfile.id+'/unlock','POST',{},201)));
      assert.equal(packUnlocks.reduce((n:number,r:any)=>n+r.charged,0),1);
      assert.equal((await request('A','institution/account')).credits,packBalance-1);
      await request('owner','admin/settings/simple_pricing','PATCH',{value:{...simple,unlockPaid:false}});
      assert.equal((await request('B','institution/candidates/'+newProfile.id+'/unlock','POST',{},201)).charged,0);
      await request('owner','admin/settings/simple_pricing','PATCH',{value:simple});
      await request('C','auth/register','POST',{email:'C@example.com',password:pass,name:'New Recruiter',role:'TENANT_ADMIN',institution:'New Simple School'},201);
      assert.equal((await request('C','institution/account')).credits,0);
      assert.equal((await request('C','institution/account')).subscription,null);
      await request('owner','admin/settings/teacher_auto_approve_enabled','PATCH',{value:false});
      await request('teacherPaid','profile','PATCH',{...fields,directoryVisible:true,directoryConsent:true});
      assert.equal((await request('teacherPaid','profile')).profileReviewed,true);
      await request('autoTeacher','auth/register','POST',{email:'auto@example.com',password:pass,name:'Auto Teacher',role:'CANDIDATE'},201);
      await request('autoTeacher','profile','PATCH',fields);
      assert.equal((await request('autoTeacher','profile')).profileReviewed,false);
      await request('owner','admin/settings/teacher_auto_approve_enabled','PATCH',{value:true});
      assert.equal((await request('autoTeacher','profile')).profileReviewed,true);
      await request('autoNew','auth/register','POST',{email:'autonew@example.com',password:pass,name:'Auto New',role:'CANDIDATE'},201);
      await request('autoNew','profile','PATCH',fields);
      assert.equal((await request('autoNew','profile')).profileReviewed,true);
      await request('owner','admin/settings/teacher_auto_approve_enabled','PATCH',{value:false});
      await request('autoNew','profile','PATCH',fields);
      assert.equal((await request('autoNew','profile')).profileReviewed,true);
      // Unavailability reports: ownership, paid-only replacement, atomic review and availability.
      const reportPath='institution/candidates/'+newProfile.id+'/unavailable-report';
      await request('C',reportPath,'POST',{reason:'Candidate already placed and not seeking'},403);
      const reportA=await request('A',reportPath,'POST',{reason:'Candidate already placed and not seeking'},201);
      await request('A',reportPath,'POST',{reason:'Duplicate unavailable report'},400);
      await request('A','admin/unavailable-reports','GET',undefined,403);
      await request('teacherPaid','admin/unavailable-reports','GET',undefined,403);
      const reportB=await request('B',reportPath,'POST',{reason:'Candidate confirmed not seeking'},201);
      await request('owner','admin/unavailable-reports/'+reportB.id+'/decision','POST',{restoreCredit:true,markUnavailable:false,reason:'Review free unlock'},400);
      const beforeA=(await request('A','institution/account')).credits;
      const beforeB=(await request('B','institution/account')).credits;
      const decision={restoreCredit:true,markUnavailable:true,reason:'Confirmed with candidate already placed',validityDays:30};
      const reviews=await Promise.all([1,2].map(()=>fetch('http://127.0.0.1:3003/api/admin/unavailable-reports/'+reportA.id+'/decision',{method:'POST',headers:{Origin:'http://localhost:5182','Content-Type':'application/json',Cookie:clients.owner.cookie,'x-csrf-token':clients.owner.csrf},body:JSON.stringify(decision)})));
      assert.deepEqual(reviews.map(r=>r.status).sort(),[201,400]);
      assert.equal((await request('A','institution/account')).credits,beforeA+1);
      assert.equal((await request('B','institution/account')).credits,beforeB);
      assert.equal((await request('teacherPaid','profile')).jobSeeking,false);
      assert.equal((await request('A','institution/candidates?q=')).items.some((c:any)=>c.id===newProfile.id),false);
      await request('C','institution/candidates/'+newProfile.id+'/unlock','POST',{},403);
      assert.equal(await db.creditTransaction.count({where:{reference:'replacement:'+reportA.unlockId}}),1);
      await request('owner','admin/unavailable-reports/'+reportB.id+'/decision','POST',{restoreCredit:false,markUnavailable:false,reason:'Free unlock, no credit loss'},201);
      await request('teacherPaid','profile','PATCH',{...fields,jobSeeking:true,directoryVisible:true,directoryConsent:true});
      assert.equal((await request('teacherPaid','profile')).jobSeeking,true);
      assert.equal((await request('A','institution/candidates?q=')).items.some((c:any)=>c.id===newProfile.id),true);
      assert.equal(await db.audit.count({where:{action:'REPLACEMENT_CREDIT_GRANTED',entityId:reportA.id}}),1);
      // Pharmacy: profession segregation, private registration, location order and jobs.
      await db.geoPlace.createMany({data:[{id:'test-origin',name:'Test origin',district:'Test district',state:'Karnataka',aliases:'Origin',latitude:17,longitude:75},{id:'test-near',name:'Test nearby',district:'Test district',state:'Karnataka',aliases:'Nearby',latitude:17.01,longitude:75},{id:'test-far',name:'Test farther',district:'Test district',state:'Karnataka',aliases:'Farther',latitude:17.2,longitude:75}]});
      const pharmacyFields={...fields,directoryVisible:true,directoryConsent:true,subject:'Pharmacist',qualification:'D.Pharm',currentPlaceId:'test-near',preferredPlaceIds:['test-origin'],education:[{degree:'D.Pharm',institution:'Test Pharmacy College',year:2024,resultType:'Percentage',result:'78.5',highest:true}],pharmacyDetails:{registered:'Yes',council:'Test state council',registrationNumber:'PRIVATE-REG-123',workType:'Both',expectedPay:null}};
      await request('pharma1','auth/register','POST',{email:'pharma1@example.com',password:pass,name:'Pharmacy One',role:'CANDIDATE',profession:'PHARMACIST'},201);
      await request('pharma1','profile','PATCH',pharmacyFields);
      const pharma1=await request('pharma1','profile');assert.equal(pharma1.profession,'PHARMACIST');assert.match(pharma1.displayId,/^PH/);
      await request('owner','admin/candidates/'+pharma1.id,'PATCH',{profileReviewed:true,revision:pharma1.revision});
      await request('pharma1','profile','PATCH',{...pharmacyFields,education:[{...pharmacyFields.education[0],result:'101'}]},400);
      assert.equal((await request('A','institution/candidates?q=')).items.some((c:any)=>c.id===pharma1.id),false);
      await request('A','institution/candidates/'+pharma1.id+'/details','GET',undefined,403);
      await request('A','institution/candidates/'+pharma1.id+'/unlock','POST',{},403);
      const employerProfile={name:'New Simple School',type:'Medical shop',address:'Test',contactPerson:'Tester',officialEmail:'C@example.com',mobile:'',website:'',registrationDetails:'',recruitingProfessions:['PHARMACIST']};
      await request('C','institution/profile','PATCH',employerProfile);
      const pharmaOnly=await request('C','institution/candidates?q=');assert.ok(pharmaOnly.items.length);assert.ok(pharmaOnly.items.every((c:any)=>c.profession==='PHARMACIST'));
      const lockedPharma=await request('C','institution/candidates/'+pharma1.id+'/details');assert.equal(lockedPharma.contactUnlocked,false);assert.equal(lockedPharma.pharmacyDetails,undefined);assert.ok(!JSON.stringify(lockedPharma).includes('PRIVATE-REG-123'));
      await request('pharma2','auth/register','POST',{email:'pharma2@example.com',password:pass,name:'Pharmacy Two',role:'CANDIDATE',profession:'PHARMACIST'},201);
      await request('pharma2','profile','PATCH',{...pharmacyFields,currentPlaceId:'test-far'});const pharma2=await request('pharma2','profile');await request('owner','admin/candidates/'+pharma2.id,'PATCH',{profileReviewed:true,revision:pharma2.revision});
      const nearSearch=await request('C','institution/candidates?profession=PHARMACIST&near=test-origin&radius=50');assert.deepEqual(nearSearch.items.map((c:any)=>c.id),[pharma1.id,pharma2.id]);assert.ok(nearSearch.items[0].distanceKm<nearSearch.items[1].distanceKm);
      const preferredSearch=await request('C','institution/candidates?profession=PHARMACIST&near=test-origin&radius=25&locationMode=preferred');assert.equal(preferredSearch.items.length,2);assert.equal(preferredSearch.items[0].distanceKm,0);
      await request('C','institution/candidates?profession=TEACHER','GET',undefined,403);
      await request('C','institution/profile','PATCH',{...employerProfile,recruitingProfessions:['PHARMACIST','TEACHER']});
      const mixed=await request('C','institution/candidates?q=');assert.ok(mixed.items.some((c:any)=>c.profession==='TEACHER'));assert.ok(mixed.items.some((c:any)=>c.profession==='PHARMACIST'));
      await request('owner','admin/settings/simple_pricing','PATCH',{value:{...simple,jobFee:0}});
      const pharmacyJob=await request('C','institution/jobs','POST',{profession:'PHARMACIST',title:'Registered pharmacist',subject:'Pharmacy',location:'Test origin',salary:20000,description:'Full-time registered pharmacist required for medical shop.',closesAt:new Date(Date.now()+86400000).toISOString()},201);
      assert.ok((await request('pharma1','jobs')).every((j:any)=>j.profession==='PHARMACIST'));
      await request('teacher','jobs/'+pharmacyJob.id+'/apply','POST',{contactConsent:true},403);
      assert.ok(!(await request('teacher','jobs')).some((j:any)=>j.id===pharmacyJob.id));
      // Verify CSRF and role checks explicitly.
      const r = await fetch("http://127.0.0.1:3003/api/admin/tenants/" + a.id, {
        method: "PATCH",
        headers: {
          Origin: "http://localhost:5182",
          "Content-Type": "application/json",
          Cookie: clients.owner.cookie,
        },
        body: JSON.stringify({ blocked: true }),
      });
      assert.equal(r.status, 403);
      await request("teacher", "admin/overview", "GET", undefined, 403);
      console.log("Integration checks passed in isolated schema " + schema);
    } finally {
      proc.kill();
      await db.$disconnect();
    }
  },
);

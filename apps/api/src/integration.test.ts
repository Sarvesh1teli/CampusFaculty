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
    const runtimeRole=new URL(process.env.DATABASE_URL!).username;assert.match(runtimeRole,/^[a-z_][a-z0-9_]*$/);
    await db.$executeRawUnsafe(
      'GRANT USAGE ON SCHEMA "' + schema + '", app_private TO ' + runtimeRole,
    );
    await db.$executeRawUnsafe(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "' +
        schema +
        '" TO ' + runtimeRole,
    );
    await db.$executeRawUnsafe(
      'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "' +
        schema +
        '" TO ' + runtimeRole,
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
      await db.setting.create({data:{key:'simple_pricing',value:{enabled:false}}});
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
      const pharmaOnly=await request('C','institution/candidates?q=');assert.ok(pharmaOnly.items.every((c:any)=>Array.isArray(c.preferredLocations)));assert.ok(pharmaOnly.items.find((c:any)=>c.id===pharma1.id).preferredLocations.includes('Test origin'));assert.ok(pharmaOnly.items.length);assert.ok(pharmaOnly.items.every((c:any)=>c.profession==='PHARMACIST'));
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
      await request('nurse','auth/register','POST',{email:'nurse@example.com',password:pass,name:'Nurse Test',role:'CANDIDATE',profession:'NURSE'},201);
      const nurseFields={...pharmacyFields,pharmacyDetails:undefined,subject:'Nurse',qualification:'GNM / Diploma Nursing',education:[{...pharmacyFields.education[0],degree:'GNM / Diploma Nursing'}],nursingDetails:{registered:'Yes',council:'Test nursing council',registrationNumber:'PRIVATE-NURSE-123',workType:'Both',expectedPay:25000,department:'ICU',nightShift:'Yes',description:'Experienced ICU nurse'}};
      await request('nurse','profile','PATCH',nurseFields);
      const nurse=await request('nurse','profile');assert.equal(nurse.profession,'NURSE');assert.match(nurse.displayId,/^NU/);assert.equal(nurse.nursingDetails.nightShift,'Yes');
      await request('nurse','profile','PATCH',{...nurseFields,nursingDetails:{...nurseFields.nursingDetails,nightShift:'invalid'}},400);
      await request('owner','admin/candidates/'+nurse.id,'PATCH',{profileReviewed:true,revision:nurse.revision});
      await request('A','institution/candidates/'+nurse.id+'/details','GET',undefined,403);
      await request('C','institution/profile','PATCH',{...employerProfile,recruitingProfessions:['PHARMACIST','TEACHER','NURSE']});
      const nurses=await request('C','institution/candidates?profession=NURSE');assert.equal(nurses.items.length,1);assert.equal(nurses.items[0].nursingSummary.nightShift,'Yes');assert.equal(nurses.items[0].nursingSummary.description,'Experienced ICU nurse');assert.ok(!JSON.stringify(nurses).includes('PRIVATE-NURSE-123'));
      const lockedNurse=await request('C','institution/candidates/'+nurse.id+'/details');assert.equal(lockedNurse.nursingDetails,undefined);assert.ok(!JSON.stringify(lockedNurse).includes('PRIVATE-NURSE-123'));
      const nurseJob=await request('C','institution/jobs','POST',{profession:'NURSE',title:'ICU nurse',subject:'Nursing',location:'Test origin',salary:25000,description:'Nurse required for ICU and night shift.',closesAt:new Date(Date.now()+86400000).toISOString()},201);
      assert.ok((await request('nurse','jobs')).every((j:any)=>j.profession==='NURSE'));
      await request('teacher','jobs/'+nurseJob.id+'/apply','POST',{contactConsent:true},403);
      await request('pharma1','jobs/'+nurseJob.id+'/apply','POST',{contactConsent:true},403);
      const institutionDirectory=await request('owner','admin/institutions');assert.ok(institutionDirectory.tenants.some((t:any)=>t.id===a.id));assert.ok(institutionDirectory.tenants.every((t:any)=>'contactPerson' in t&&'officialEmail' in t));await request('teacher','admin/institutions','GET',undefined,403);
      await request('owner','admin/tenants/'+(await request('C','institution/account')).tenant.id,'PATCH',{verified:true});
      // Independent profession pack prices, grants, balances and unlock debits.
      const teacherBefore=await request('owner','commerce/config');
      for(const profession of ['PHARMACIST','NURSE'])await request('owner','admin/settings/credit_pricing:'+profession,'PATCH',{value:{enabled:true,unlockPaid:true,packPrice:profession==='NURSE'?30000:25000,packCredits:profession==='NURSE'?4:3,validityDays:180}});
      assert.equal((await request('owner','commerce/config')).packPrice,teacherBefore.packPrice);
      await request('A','commerce/orders','POST',{kind:'UNLOCK_PACK',profession:'NURSE'},403);
      const teacherCreditsBefore=(await request('C','institution/account')).credits;
      for(const profession of ['PHARMACIST','NURSE']){
        if(profession==='NURSE')await request('C','institution/candidates/'+nurse.id+'/unlock','POST',{},403);
        const order=await request('C','commerce/orders','POST',{kind:'UNLOCK_PACK',profession},201);assert.equal(order.snapshot.profession,profession);assert.equal(order.amount,profession==='NURSE'?30000:25000);
        await request('C','commerce/orders/'+order.id+'/submit','POST',{utr:'TEST-'+profession+'-CREDIT',amount:order.amount},201);
        await request('owner','admin/commerce/'+order.id+'/decision','POST',{approve:true,receivedAmount:order.amount,receiptReference:'TEST-'+profession+'-CREDIT',reason:'Integration profession pack'},201);
      }
      let professionAccount=await request('C','institution/account');const balances=(a:any)=>Object.fromEntries(a.professionBalances.map((g:any)=>[g.profession,g._sum.remaining]));assert.equal(balances(professionAccount).PHARMACIST,3);assert.equal(balances(professionAccount).NURSE,4);assert.equal(professionAccount.credits,teacherCreditsBefore);
      await request('C','institution/candidates/'+pharma1.id+'/unlock','POST',{},201);
      professionAccount=await request('C','institution/account');assert.equal(balances(professionAccount).PHARMACIST,2);assert.equal(balances(professionAccount).NURSE,4);
      await request('C','institution/candidates/'+nurse.id+'/unlock','POST',{},201);
      professionAccount=await request('C','institution/account');assert.equal(balances(professionAccount).NURSE,3);assert.equal(balances(professionAccount).PHARMACIST,2);assert.equal(professionAccount.credits,teacherCreditsBefore);
      assert.ok(professionAccount.invoices.length>=2);
      await request('C','institution/candidates/'+nurse.id+'/unlock','POST',{},201);assert.equal(balances(await request('C','institution/account')).NURSE,3);
      const nurseReport=await request('C','institution/candidates/'+nurse.id+'/unavailable-report','POST',{reason:'Test nurse unavailable after contact'},201);
      await request('owner','admin/unavailable-reports/'+nurseReport.id+'/decision','POST',{restoreCredit:true,markUnavailable:false,reason:'Test nursing replacement',validityDays:30},201);
      professionAccount=await request('C','institution/account');assert.equal(balances(professionAccount).NURSE,4);assert.equal(balances(professionAccount).PHARMACIST,2);
      const edits=[['A',job],['C',pharmacyJob],['C',nurseJob]] as const;
      for(const [who,j] of edits){const beforeApplications=await db.application.count({where:{jobId:j.id}}),beforeOrders=await db.commerceOrder.count({where:{kind:'JOB'}});const edit={title:j.title+' updated',subject:j.subject,location:j.location,salary:2000,salaryMax:30000,description:j.description+' Updated requirements.',closesAt:new Date(Date.now()+30*86400000).toISOString()};const edited=await request(who,'institution/jobs/'+j.id,'PATCH',edit);assert.equal(edited.salary,2000);assert.equal(edited.salaryMax,30000);assert.equal(edited.profession,j.profession);assert.equal(await db.application.count({where:{jobId:j.id}}),beforeApplications);assert.equal(await db.commerceOrder.count({where:{kind:'JOB'}}),beforeOrders);await request('B','institution/jobs/'+j.id,'PATCH',edit,404);await request('teacher','institution/jobs/'+j.id,'PATCH',edit,403);await request(who,'institution/jobs/'+j.id,'PATCH',{...edit,salaryMax:1000},400);await request(who,'institution/jobs/'+j.id,'PATCH',{...edit,profession:'NURSE'},400);await request(who,'institution/jobs/'+j.id,'PATCH',{...edit,closesAt:new Date(0).toISOString()},400);}
      await request('C','institution/jobs/'+nurseJob.id+'/close','PATCH',{});await request('C','institution/jobs/'+nurseJob.id,'PATCH',{title:'Closed test',subject:'Nursing',location:'Test',salary:1000,salaryMax:2000,description:'Closed vacancy cannot be edited.',closesAt:new Date(Date.now()+86400000).toISOString()},400);
      // General is independent of legacy Teacher, Pharmacy and Nursing.
      const generalCfg=await request('owner','public/general-config');assert.ok(generalCfg.categories.some((v:any)=>v.id==='teaching'));
      await request('teacher','admin/general-config','PATCH',generalCfg,403);
      await request('owner','admin/general-config','PATCH',{...generalCfg,profileFee:0,applicationFee:0,jobFee:0});
      await request('generalEmployer','auth/register','POST',{email:'general-employer@example.com',password:pass,name:'General Owner',role:'TENANT_ADMIN',institution:'General Employer',recruitingProfessions:['GENERAL'],generalCategories:['teaching','banking']},201);
      const ge=(await request('generalEmployer','institution/account')).tenant;await request('owner','admin/tenants/'+ge.id,'PATCH',{verified:true});
      await request('general1','auth/register','POST',{email:'general1@example.com',password:pass,name:'General Candidate',role:'CANDIDATE',profession:'GENERAL'},201);
      const generalFields={...fields,preferredLocations:['Unlisted village','Another custom town'],preferredPlaceIds:['test-origin'],directoryVisible:true,directoryConsent:true,subject:'Commerce',qualification:'B.Com',jobInterests:['teaching','banking'],personalDetails:{firstName:'Test',lastName:'General',currentJobRole:'Accountant',employmentStatus:'Currently working'},generalDetails:{description:'General accounts and teaching interest',categoryDetails:{'teaching:Subjects':'Commerce'}},education:[{degree:'B.Com',institution:'Test College',year:2024,resultType:'Percentage',result:'75',highest:false},{degree:'M.Com',institution:'Test University',year:2025,resultType:'Percentage',result:'68',highest:true}]};
      await request('general1','profile','PATCH',generalFields);let g1=await request('general1','profile');assert.deepEqual(new Set(g1.preferredLocations),new Set(['Unlisted village','Another custom town','Test origin']));assert.equal(g1.profession,'GENERAL');assert.match(g1.displayId,/^GN/);await request('owner','admin/candidates/'+g1.id,'PATCH',{profileReviewed:true,revision:g1.revision});
      const gj=await request('generalEmployer','institution/jobs','POST',{profession:'GENERAL',category:'teaching',requirements:{acceptedDegrees:['B.Com','B.Sc'],requiredDegrees:['B.Ed'],anyGraduate:false,minExperience:0,categoryDetails:{Subjects:'Commerce'}},title:'General Commerce Teacher',subject:'Commerce',location:'Bijapur',salary:20000,salaryMax:30000,description:'Teach commerce with a supportive school team.',closesAt:new Date(Date.now()+86400000).toISOString()},201);
      let generalJobs=await request('general1','jobs');assert.ok(generalJobs.every((j:any)=>j.profession==='GENERAL'));assert.equal(generalJobs.find((j:any)=>j.id===gj.id).eligibility.eligible,false);await request('general1','jobs/'+gj.id+'/apply','POST',{contactConsent:true},403);
      await request('general1','profile','PATCH',{...generalFields,education:[...generalFields.education,{degree:'B.Ed',institution:'Education College',year:2025,resultType:'Percentage',result:'70',highest:false}]});g1=await request('general1','profile');await request('owner','admin/candidates/'+g1.id,'PATCH',{profileReviewed:true,revision:g1.revision});
      generalJobs=await request('general1','jobs');assert.equal(generalJobs.find((j:any)=>j.id===gj.id).eligibility.eligible,true);await request('general1','jobs/'+gj.id+'/apply','POST',{contactConsent:true},201);
      await request('teacher','jobs/'+gj.id+'/apply','POST',{contactConsent:true},403);assert.ok(!(await request('teacher','jobs')).some((j:any)=>j.id===gj.id));
      const mcomSearch=await request('generalEmployer','institution/candidates?profession=GENERAL&degree=M.Com');assert.ok(mcomSearch.items.some((c:any)=>c.id===g1.id));assert.equal(mcomSearch.items.find((c:any)=>c.id===g1.id).educationResult,'68');
      const currentRoleSearch=await request('generalEmployer','institution/candidates?profession=GENERAL&q=accountant');assert.ok(currentRoleSearch.items.some((c:any)=>c.id===g1.id));assert.equal(currentRoleSearch.items.find((c:any)=>c.id===g1.id).generalSummary.currentJobRole,'Accountant');
      await db.candidate.update({where:{id:g1.id},data:{profileReviewed:false}});assert.ok(!(await request('generalEmployer','institution/candidates?profession=GENERAL')).items.some((c:any)=>c.id===g1.id));await db.candidate.update({where:{id:g1.id},data:{profileReviewed:true}});
      const generalSearch=await request('generalEmployer','institution/candidates?profession=GENERAL&degree=B.Ed&subject=Commerce&category=teaching');assert.equal(generalSearch.items[0].id,g1.id);assert.ok(generalSearch.items[0].preferredLocations.includes('Unlisted village'));assert.ok(generalSearch.items[0].preferredLocations.includes('Test origin'));await request('A','institution/candidates/'+g1.id+'/details','GET',undefined,403);
      assert.equal((await request('generalEmployer','institution/candidates?profession=GENERAL&degree=M.Sc')).items.length,0);
      const generalPack=await request('generalEmployer','commerce/orders','POST',{kind:'UNLOCK_PACK',profession:'GENERAL'},201);assert.equal(generalPack.snapshot.profession,'GENERAL');await request('generalEmployer','commerce/orders/'+generalPack.id+'/submit','POST',{utr:'GENERAL-PACK-TEST',amount:generalPack.amount},201);await request('owner','admin/commerce/'+generalPack.id+'/decision','POST',{approve:true,receivedAmount:generalPack.amount,receiptReference:'GENERAL-PACK-TEST',reason:'General pack test'},201);
      await request('generalEmployer','institution/candidates/'+g1.id+'/unlock','POST',{},201);assert.equal((await request('generalEmployer','institution/account')).credits,0);
      await request('owner','admin/general-config','PATCH',{...generalCfg,categories:generalCfg.categories.map((c:any)=>c.id==='teaching'?{...c,active:false}:c)});
      await request('generalEmployer','institution/jobs','POST',{profession:'GENERAL',category:'teaching',requirements:{},title:'Inactive category vacancy',subject:'Math',location:'Test',salary:1000,description:'Inactive category should reject this new job.',closesAt:new Date(Date.now()+86400000).toISOString()},400);
      await request('owner','admin/general-config','PATCH',generalCfg);
      // Owner cash payments allocate atomically into matching profession balances.
      const cashDate=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
      await db.tenant.update({where:{id:ge.id},data:{recruitingProfessions:['GENERAL','TEACHER','PHARMACIST','NURSE']}});
      const cashConfig=await request('owner','commerce/config');
      const cashPayload=(profession:string,reference:string,mode='CASH')=>{const c=cashConfig.professionPricing[profession];return {tenantId:ge.id,profession,mode,quantity:2,receiptReference:reference,paymentDate:cashDate,note:mode==='COMPLIMENTARY'?'Goodwill adjustment':'Cash received at office',expectedPackPrice:c.packPrice,expectedPackCredits:c.packCredits,expectedValidityDays:c.validityDays}};
      await request('generalEmployer','admin/cash-credits','POST',cashPayload('GENERAL','DENIED-CASH'),403);
      await request('teacher','admin/cash-credits','POST',cashPayload('GENERAL','DENIED-TEACHER'),403);
      await request('owner','admin/cash-credits','POST',{...cashPayload('GENERAL','STALE-CASH'),expectedPackPrice:1},400);
      for(const profession of ['GENERAL','TEACHER','PHARMACIST','NURSE']){
        const before=await db.creditGrant.aggregate({where:{tenantId:ge.id,profession},_sum:{remaining:true}});
        const result=await request('owner','admin/cash-credits','POST',cashPayload(profession,'CASH-'+profession),201);
        assert.equal(result.order.amount,cashConfig.professionPricing[profession].packPrice*2);assert.equal(result.order.snapshot.paymentMethod,'CASH');assert.ok(result.invoice.id);assert.equal(result.credits,cashConfig.professionPricing[profession].packCredits*2);
        const after=await db.creditGrant.aggregate({where:{tenantId:ge.id,profession},_sum:{remaining:true}});assert.equal(after._sum.remaining,(before._sum.remaining||0)+result.credits);
        await request('owner','admin/cash-credits','POST',cashPayload(profession,'cash-'+profession.toLowerCase()),400);
      }
      const comp=await request('owner','admin/cash-credits','POST',cashPayload('NURSE','GOODWILL-001','COMPLIMENTARY'),201);assert.equal(comp.order.amount,0);assert.equal(comp.invoice,null);assert.equal(comp.order.snapshot.paymentMethod,'COMPLIMENTARY');
      await request('owner','admin/cash-credits','POST',cashPayload('GENERAL','GOODWILL-001'),400);
      await request('owner','admin/cash-credits','POST',{...cashPayload('GENERAL','FUTURE-CASH'),paymentDate:'2099-01-01'},400);
      await db.tenant.update({where:{id:ge.id},data:{blocked:true}});await request('owner','admin/cash-credits','POST',cashPayload('GENERAL','BLOCKED-CASH'),400);await db.tenant.update({where:{id:ge.id},data:{blocked:false,recruitingProfessions:['GENERAL']}});
      await request('owner','admin/cash-credits','POST',cashPayload('NURSE','WRONG-PROF'),400);
      const race=await Promise.allSettled([request('owner','admin/cash-credits','POST',cashPayload('GENERAL','RACE-CASH'),201),request('owner','admin/cash-credits','POST',cashPayload('GENERAL','RACE-CASH'),201)]);assert.equal(race.filter(r=>r.status==='fulfilled').length,1);assert.equal(await db.commerceOrder.count({where:{receiptKey:'CASH:RACE-CASH'}}),1);
      const cashInvoice=await db.invoice.findFirstOrThrow({where:{tenantId:ge.id,number:{startsWith:'TC-CASH-'}}});
      const pdf=await fetch('http://127.0.0.1:3003/api/institution/invoices/'+cashInvoice.id+'/pdf',{headers:{Cookie:clients.generalEmployer.cookie}});assert.equal(pdf.status,200);assert.match(pdf.headers.get('content-type')||'',/application\/pdf/);assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0,4).toString(),'%PDF');
      const deniedReceipt=await fetch('http://127.0.0.1:3003/api/institution/invoices/'+cashInvoice.id+'/pdf',{headers:{Cookie:clients.A.cookie}});assert.equal(deniedReceipt.status,404);
      await assert.rejects(()=>db.commerceOrder.create({data:{userId:(comp.order as any).userId,tenantId:ge.id,kind:'UNLOCK_PACK',snapshot:{},subtotal:0,amount:0,payeeSnapshot:{},status:'APPROVED'}}));
      const cashHistory=await request('generalEmployer','commerce/orders');assert.ok(cashHistory.some((o:any)=>o.snapshot.paymentMethod==='CASH'));assert.ok(cashHistory.some((o:any)=>o.snapshot.paymentMethod==='COMPLIMENTARY'));assert.ok(await db.audit.count({where:{action:'CASH_PAYMENT_CREDITS_ADDED',tenantId:ge.id}})>=4);
      const settingsView=await request('owner','admin/settings-view');assert.ok(Array.isArray(settingsView.settings));assert.equal(settingsView.tenants,undefined);assert.equal(settingsView.payments,undefined);assert.equal(settingsView.settings.find((s:any)=>s.key==='general_auto_approve_enabled').value,(await request('owner','admin/overview')).settings.find((s:any)=>s.key==='general_auto_approve_enabled').value);
      const paymentsView=await request('owner','admin/payments-view');assert.ok(Array.isArray(paymentsView.payments));assert.ok(Array.isArray(paymentsView.tenants));assert.equal(paymentsView.settings,undefined);
      await request('teacher','admin/settings-view','GET',undefined,403);await request('A','admin/payments-view','GET',undefined,403);
      await new Promise(r=>setTimeout(r,61000));
      // Missing configuration after a clean reset uses credit-pack defaults, not a Starter plan.
      const savedPricing=await db.setting.findUnique({where:{key:'simple_pricing'}});await db.setting.deleteMany({where:{key:'simple_pricing'}});await db.plan.deleteMany({where:{id:'free'}});
      for(const profession of ['GENERAL','PHARMACIST','NURSE','TEACHER']){
        await request('resetEmployer'+profession,'auth/register','POST',{email:'reset-employer-'+profession.toLowerCase()+'@example.invalid',password:pass,name:'Reset Employer Test',role:'TENANT_ADMIN',institution:'Reset '+profession+' Employer',recruitingProfessions:[profession],...(profession==='GENERAL'?{generalCategories:['retail']}:{})},201);
        const resetAccount=await request('resetEmployer'+profession,'institution/account');assert.equal(resetAccount.credits,0);assert.equal(await db.creditGrant.count({where:{tenantId:resetAccount.tenant.id}}),0);assert.equal(await db.subscription.count({where:{tenantId:resetAccount.tenant.id}}),0);
        assert.equal((await request('resetEmployer'+profession,'commerce/config')).enabled,true);
      }
      if(savedPricing)await db.setting.create({data:{key:'simple_pricing',value:savedPricing.value!}});
      // Approval checks share the fresh test rate-limit window.
      // Auto approval is independent, applies only to saved active profiles and preserves consent.
      for(const key of ['teacher_auto_approve_enabled','pharmacist_auto_approve_enabled','nurse_auto_approve_enabled','general_auto_approve_enabled'])await request('owner','admin/settings/'+key,'PATCH',{value:false});
      const approvals:any={};
      for(const profession of ['TEACHER','GENERAL','PHARMACIST','NURSE']){const user=await db.user.create({data:{email:'approval-'+profession.toLowerCase()+'@example.invalid',password:'disabled-test',role:'CANDIDATE',name:'Approval Test'}});const candidate=await db.candidate.create({data:{userId:user.id,displayId:'APPROVAL-'+profession,profession,subject:'Test role',qualification:'B.Com',location:'Test',directoryVisible:true,directoryConsent:false,profileReviewed:false}});await db.setting.create({data:{key:'profile-activation:'+user.id,value:true}});approvals[profession]=candidate;}
      const unsavedUser=await db.user.create({data:{email:'approval-unsaved@example.invalid',password:'disabled-test',role:'CANDIDATE',name:'Unsaved Test'}});const unsaved=await db.candidate.create({data:{userId:unsavedUser.id,displayId:'APPROVAL-UNSAVED',profession:'GENERAL',subject:'Not specified',qualification:'Not specified',location:'Not specified',profileReviewed:false}});
      await request('owner','admin/settings/teacher_auto_approve_enabled','PATCH',{value:true});assert.equal((await db.candidate.findUniqueOrThrow({where:{id:approvals.TEACHER.id}})).profileReviewed,true);for(const p of ['GENERAL','PHARMACIST','NURSE'])assert.equal((await db.candidate.findUniqueOrThrow({where:{id:approvals[p].id}})).profileReviewed,false);
      await db.candidate.update({where:{id:pharma1.id},data:{profileReviewed:false}});await request('pharma1','profile','PATCH',pharmacyFields);assert.equal((await db.candidate.findUniqueOrThrow({where:{id:pharma1.id}})).profileReviewed,false);
      await request('owner','admin/settings/pharmacist_auto_approve_enabled','PATCH',{value:true});assert.equal((await db.candidate.findUniqueOrThrow({where:{id:approvals.PHARMACIST.id}})).profileReviewed,true);assert.equal((await db.candidate.findUniqueOrThrow({where:{id:approvals.NURSE.id}})).profileReviewed,false);
      await db.candidate.update({where:{id:pharma1.id},data:{profileReviewed:false}});await request('pharma1','profile','PATCH',pharmacyFields);assert.equal((await db.candidate.findUniqueOrThrow({where:{id:pharma1.id}})).profileReviewed,true);
      await request('owner','admin/settings/nurse_auto_approve_enabled','PATCH',{value:true});await db.candidate.update({where:{id:nurse.id},data:{profileReviewed:false}});await request('nurse','profile','PATCH',nurseFields);assert.equal((await db.candidate.findUniqueOrThrow({where:{id:nurse.id}})).profileReviewed,true);
      await request('owner','admin/settings/general_auto_approve_enabled','PATCH',{value:true});assert.equal((await request('owner','public/general-config')).approvalRequired,false);assert.equal((await db.candidate.findUniqueOrThrow({where:{id:approvals.GENERAL.id}})).profileReviewed,true);assert.equal((await db.candidate.findUniqueOrThrow({where:{id:unsaved.id}})).profileReviewed,false);assert.equal((await db.candidate.findUniqueOrThrow({where:{id:approvals.GENERAL.id}})).directoryConsent,false);
      assert.equal((await request('owner','admin/overview')).settings.find((s:any)=>s.key==='general_auto_approve_enabled').value,true);
      await request('owner','admin/general-config','PATCH',{...generalCfg,approvalRequired:true});assert.equal((await request('owner','admin/overview')).settings.find((s:any)=>s.key==='general_auto_approve_enabled').value,false);assert.equal((await db.candidate.findUniqueOrThrow({where:{id:approvals.GENERAL.id}})).profileReviewed,true);
      await db.setting.create({data:{key:'profile-activation:'+unsavedUser.id,value:true}});await request('owner','admin/general-config','PATCH',{...generalCfg,approvalRequired:false});assert.equal((await db.candidate.findUniqueOrThrow({where:{id:unsaved.id}})).profileReviewed,true);
      await request('generalEmployer','admin/settings/general_auto_approve_enabled','PATCH',{value:true},403);
      for(const key of ['teacher_auto_approve_enabled','pharmacist_auto_approve_enabled','nurse_auto_approve_enabled'])await request('owner','admin/settings/'+key,'PATCH',{value:false});await request('owner','admin/general-config','PATCH',generalCfg);
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


import { test } from "node:test";
import { strict as assert } from "node:assert";
import { canReapply, contactAllowed, anonymous, renewalStart } from "./policy";
test("private fields never enter anonymous previews", () => {
  assert.deepEqual(
    anonymous({
      id: "c",
      displayId: "TC1",
      profileReviewed: true,
      subject: "Math",
      qualification: "BEd",
      experience: 2,
      location: "Delhi",
      salary: 30000,
      active: true,
      mobile: "123",
      user: { name: "Secret", email: "private" },
    }),
    {
      id: "c",
      displayId: "TC1",
      subject: "Math",
      qualification: "BEd",
      experience: 2,
      location: "Delhi",
      salary: 30000,
      active: true,
    },
  );
});
test("hidden directory candidate may use application consent, inactive may not", () => {
  assert.equal(contactAllowed(true, false, true), true);
  assert.equal(contactAllowed(false, true, true), false);
  assert.equal(contactAllowed(true, false, false), false);
});
test("reapplication requires terminal state and elapsed closed-at wait", () => {
  const now = new Date("2026-10-09");
  assert.equal(canReapply("REJECTED", new Date("2026-09-09"), now), true);
  assert.equal(canReapply("APPLIED", new Date("2026-09-01"), now), false);
  assert.equal(canReapply("WITHDRAWN", new Date("2026-10-01"), now), false);
});
test("early renewal queues while expired renewal starts now", () => {
  const now = new Date("2026-10-09");
  assert.equal(
    renewalStart(new Date("2026-10-15"), now).toISOString(),
    new Date("2026-10-15").toISOString(),
  );
  assert.equal(renewalStart(new Date("2026-10-01"), now), now);
});

test("unreviewed identifying text is suppressed from anonymous views", () => {
  const preview = anonymous({
    id: "c",
    displayId: "TC2",
    active: true,
    subject: "My name is Example Person",
    qualification: "Contact Example Person",
    location: "Private address",
    mobile: "12345678",
    profileReviewed: false,
  });
  assert.equal(JSON.stringify(preview).includes("Example Person"), false);
  assert.equal(preview.subject, "Awaiting profile review");
});

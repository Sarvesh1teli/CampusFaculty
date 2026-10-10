# CampusFaculty — Option 2 end-to-end test

Open http://localhost:5182. Use separate browser profiles or sign out between roles. The existing local role accounts were supplied in this chat; owner credentials are also in apps/api/.env and institution credentials in .local/demo-credentials.env.

## 1. Leave both workflows enabled

You can test Option 2 while Option 1 remains enabled. All five controls are enabled. Do not post a job or apply to a job during this test. Super Admin Settings should have Search candidates and Unlock contact details On. No switch changes are required.

## 2. Teacher: prepare a discoverable profile

Sign in as the job seeker. Open Profile; use the Basics, Background, Preferences and Privacy tabs. Enter Mathematics, BEd, Delhi, experience, expected salary and mobile number. Add education/experience/skills as required. In the Privacy tab, enable My profile is active, Show my anonymous profile in institution searches, and Allow verified institutions to unlock my contact details from search. Click Save profile.

Expected: a saved profile; no school selection and no job application. Directory consent authorizes contact disclosure only after an institution unlock. Initial approval is required unless auto-approval is enabled; later edits keep approval.

## 3. Super Admin: review the profile and institution

Candidates → find the demo teacher, inspect all text for identifying content, and approve the current profile revision. Do not approve a preview containing names, email, phone, school/employer names or other identifying text. Approval is required only once.

Institutions → find Demo Institution and verify it. Ensure it is not blocked. New institutions receive no free pack credits. Existing demo credits from earlier subscriptions are preserved until their purchased expiry. If the balance is insufficient, buy the standard pack under Account and await verified payment approval.

Expected: teacher is reviewed, institution is verified. A pending institution cannot perform a new contact unlock.

## 4. Institution: search and source

Sign in as the school/college admin. Candidates → search for Mathematics / Delhi using the available filters. Search is free in the simple model; paging retains institution scope.

Expected: anonymous teacher identifier and approved professional details; no name, email or mobile before unlock. Select the teacher's hiring action to add them to Hiring (the button is labeled Shortlist). No job application is created. Open Hiring to view the sourced entry.

## 5. Institution: unlock contact

Record Account's credit balance. Candidates → choose the teacher → Contact → Confirm unlock.

Expected: name/email/mobile appear; exactly one credit is deducted. Access the same teacher again (including from Hiring): no additional credit is deducted. All recruiters belonging to the same institution share the unlock.

## 6. Institution: finish the hiring workflow

Hiring → use the stage controls to shortlist, schedule a basic interview with a future date, enter private notes and move to the appropriate final stage (Hired or Rejected). Open View basic reports from Hiring to inspect counts.

Expected: direct sourcing stays separate from job applications. Institution notes remain private; teacher receives the supported in-app interview/stage notifications. No automatic application is generated.

## 7. Teacher: test consent withdrawal

Profile → Privacy → turn off directory contact consent → Save. Institution → retry contact access.

Expected: contact details are blocked despite a previous unlock, provided there is no separate consent-bearing job application to that institution. This Option 2 test must not create one. Turning off Active profile also blocks contact access. Turning off directory visibility removes discovery. Restore the desired settings, save and keep the existing approval when searching again.

## 8. Super Admin: test the shared switch

Turn Unlock contact details Off. Institution → attempt to unlock a DIFFERENT, consented, reviewed candidate.

Expected: a new unlock is blocked and no credit is deducted. Previously unlocked candidates remain accessible only while consent and active status permit. Turn the switch back On afterward.

## 9. Isolation and credit limits

Register a second institution to confirm it cannot view the first institution's contacts, private notes or Hiring entries. Its own first unlock of a teacher costs its own credit. An expired subscription or zero credit balance blocks NEW unlocks. Existing unlocks remain governed by live consent.

## 10. Optional subscription renewal test

Use available existing credits or buy a configurable standard pack. Real UPI collections remain disabled until a verified payee and QR are configured. For a real renewal: configure payment details, institution selects pack quantity under Account, pays externally, submits its real UTR, then Super Admin verifies actual bank receipt and approves. Before approval, no credits are allocated; repeated approval cannot allocate twice.

Do not send money merely to test the UI and do not approve made-up UTRs as real receipts. Payment idempotency and credit allocation are covered by the automated integration suite in an isolated test schema.

## Mobile visual check

At 390px width: Settings groups stack vertically, descriptions wrap, switches stay beside labels, no horizontal scrolling, navigation is fixed at the bottom and Log out remains visible in the header. Scroll each page to its last action and check that the bottom navigation does not prevent access.

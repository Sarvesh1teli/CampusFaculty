# Multi-profession recruitment plan

Recorded: 2026-10-11. Status: Pharmacy is being released alongside the existing Teacher form; Electrician and Nursing remain proposals / Coming soon. See the Pharmacy release in REQUIREMENTS.md for implemented scope.

## Shared account and QR flow
One application and login at https://faculty.telicampus.in/. QR/campaign links open profession selection. Teacher opens the existing form. Future enabled professions open their own form using the same account system; preserve campaign attribution. Registration creates the account, with the same email/password used for subsequent login. Avoid duplicate accounts when an existing user adds another professional profile.

Employer registration/edit asks Which professionals do you recruit? with multiple selections: Teachers, Pharmacists, Electricians, Nursing. Collect organization type separately (school/college, medical shop/hospital, electrical contractor/company, hospital/clinic/home-care agency). Candidate list is limited to selected professions, with All and individual profession filters. Each professional profile has its own qualifications and availability; do not overwrite teacher data when another profession is added. Candidate IDs should remain stable and unique; profession badges identify profile type. A future multi-profile account requires an explicit data-model migration.

## Pharmacy — agreed design
Personal/contact details; optional address; education D.Pharm, B.Pharm, M.Pharm, Pharm.D or Other with college, passing year and percentage/grade; experience years/months; current place; multiple preferred job places; job availability; full-time/part-time preferences; optional expected monthly pay.
Registration is separate from degree: registered pharmacist Yes/No, council and registration number where applicable. Use Declared/Pending verification/Verified rather than automatically treating submitted details as verified. Use Registered pharmacist available for full-time / part-time work only for candidates declaring registration. Do not offer certificate-rental fields or certificate-only arrangements. Optional registration evidence is private and access controlled. Personal supervision requirements are described in the CDSCO Drugs Rules: https://www.cdsco.gov.in/opencms/resources/UploadCDSCOWeb/2022/drug_rules/Drugs%20Rules1945n.pdf.
Candidate table: ID, Degree, Percentage/grade, Current place, Work type, Registration status, Expected pay, View. View displays education, experience, preferred places and availability; contact/document access remains protected.

## Electricians — proposed design
Role/title: Electrician, Electrical technician, Apprentice/helper (separate role labels). Personal/contact details; optional address; education ITI Electrician, Diploma, degree or Other, institution/year and optional percentage/grade; years/months experience; skills (house wiring, commercial wiring, industrial maintenance, panels, motors, solar/inverter and Other); current place and multiple preferred work places; full-time, part-time or contract work; looking/not-looking status.
Optional expected monthly pay. For contract work allow optional daily rate with a clear rate unit rather than mixing daily and monthly amounts. Optional licence/permit details where relevant to the role and work location; status must distinguish declared from independently verified. Availability to travel and own-tools declaration can be optional. Do not collect sensitive documents in public previews.
Employer types: electrical contractor, maintenance company, factory, builder or other organization.
Candidate table: ID, Qualification, Skills, Experience, Place, Work type, Expected pay/rate, View. View shows complete skills, employment history, preferred places and licence status where provided.

## Nursing - detailed proposed design

Updated: 2026-10-11. Planning only; no nursing form, verification service or employer screen is enabled by this document.

### Registration flow
Scan campaign QR -> Choose Nursing -> create account or sign into an existing account -> select role -> complete personal, education, registration, experience, preferences and consent sections -> review and submit. Keep the campaign attribution. Explain on completion that the same email/password works at https://faculty.telicampus.in/. Do not create another account for a candidate who already has one.

### Role and qualification are separate
Role sought: Nurse, Nursing assistant, Caregiver or Student/trainee. Qualification records what the candidate studied; a role label or qualification alone does not make someone a verified registered nurse. Assistant, caregiver and trainee forms must not require nurse-registration details from every applicant.

### Nursing qualification dropdown
| Stored choice | Display label | Additional field |
| --- | --- | --- |
| ANM | ANM - Auxiliary Nursing & Midwifery | None |
| GNM | GNM - Diploma in General Nursing & Midwifery | None |
| BSC_NURSING | B.Sc Nursing | None |
| POST_BASIC_BSC_NURSING | Post Basic B.Sc Nursing | None |
| MSC_NURSING | M.Sc Nursing | Optional specialty |
| POST_BASIC_DIPLOMA_NURSING | Post Basic Diploma in Nursing | Exact specialty required |
| OTHER | Other nursing / care qualification | Exact qualification name required |

GNM is a diploma programme. Avoid a duplicate generic Diploma Nursing option beside GNM; use Other for a differently named diploma and retain its exact certificate title. INC lists ANM, GNM and post-basic specialty diploma programmes: [Indian Nursing Council nursing programmes](https://www.indiannursingcouncil.org/nursingprograms), [programme guidelines](https://www.indiannursingcouncil.org/nursing-programs-guidelines). These links support qualification naming; they do not establish a particular applicant's registration or eligibility.

Allow multiple education entries and one highest qualification, for example GNM followed by Post Basic B.Sc Nursing. For each entry collect exact qualification, college/institution, examining board/university, passing year and result format (Percentage/Grade/CGPA). Result value may be optional; validate percentages within 0-100 and do not convert grade/CGPA into a fabricated percentage. For current students offer Pursuing and expected completion year instead of requiring a completed qualification. Optional ANM/GNM specialty diploma details are separate education entries, not replacements for the original qualification.

### Personal details
First/middle/last name, email, mobile, date of birth, gender and optional address. Reuse existing contact validation and verification. Aadhaar, if retained from the shared basic form, stays optional, protected and excluded from search previews and audit details. Current town/village, district and state use the shared canonical location selector. Exact home address is not a public search field.

### Nursing registration and verification
Registration declaration: Registered, Registration pending, Not registered or Not applicable to selected role. When registered, collect council/state and registration number; collect validity/renewal date where applicable. Optional supporting registration evidence is private. Registration declaration and platform verification are different fields.
Platform verification: Not submitted, Pending verification, Verified or Needs correction. Admin must review supporting evidence before marking Verified; record verifier, time and a non-sensitive review reason in the audit log. A pending/not-registered applicant must never show a Verified badge. Changing verified registration details returns verification to Pending. Expiry, where supplied and applicable, should be visible to authorized reviewers and prevent misleading current-verification badges. Qualification recognition, registration and suitability for an advertised role require their own checks; avoid automatically claiming that a course title grants eligibility.

### Experience and skills
Experience years and months (0-11); Fresher/Previously worked/Currently working. Repeated experience entries include role, work setting, dates or duration, department and responsibilities. Search previews must not reveal employer names that identify the candidate.
Optional areas: general ward, ICU, emergency, operation theatre, paediatrics, maternity, elderly care and home care. Optional skills: patient care, patient monitoring, documentation, infection-control practices and other relevant skills. Label these as candidate-declared experience/skills; do not infer clinical competence or authorize duties from a checkbox. Optional additional certifications include exact certificate name, issuer, issue date and expiry where present. Do not combine these with council registration.

### Job and location preferences
Multiple preferred towns/places, willingness to relocate or commute, work setting (hospital/clinic/nursing home/home care), full-time/part-time/contract preference and day/night/rotating shift preference. Preferred shift is a filterable preference, not an automatic assignment. Optional expected monthly pay; if a daily/visit rate is introduced for contract/home-care work, require an explicit rate unit. Notice period and available-from date may be optional.
Job availability: Looking for a job or Not currently looking. Not-looking profiles disappear from new searches and cannot be newly unlocked; keep existing applications, hiring history and authorized contacts. Candidate can later reactivate availability. No certificate-rental option.

### Employer registration, filters and candidate table
Employer types: hospital, clinic, nursing home or home-care agency. Recruit professions uses multiple selections, independently of organization type. An employer selecting Nursing sees nursing profiles; selecting Nursing plus Teachers/Pharmacists sees those selected professions with All/individual filters. Enforce this scope in API access as well as UI.
Filters: role sought, qualification, registration declaration, verified status, specialty, experience range, current/preferred place, nearby radius, work type and shift. Do not merge caregiver results into registered-nurse results without a distinct role label.
Default table: Candidate ID, Role, Qualification, Experience, Current place, Registration status, Work/shift preference, Action (View). Qualification result may be an optional column; keep the default mobile table compact with scrolling confined to the table. Light-blue header row, pagination and View details follow the current application design.
View displays all education entries, results, specialties, experience, preferred places, expected pay, availability and clearly labelled registration declaration/verification. Anonymous preview excludes name, phone, email, exact address, registration number and uploaded evidence. Existing credit unlock and consent rules protect contact details. Decide a separate, explicit permission for registration-document access; contact unlock must not automatically expose every sensitive document.

### Employer job posting and hiring
Nursing vacancy fields: role, required qualification(s), registration requirement, work setting/department, experience range, work type, shift, location, salary/range if supplied, description and closing date. Candidates apply through the shared application flow; reuse first-view tracking, notes, interviews and stage changes. Employer sets requirements rather than the system inventing eligibility rules. Unavailable reports and admin-approved replacement credits reuse the existing safeguards, including paid-unlock verification and one replacement per unlock.

### Implementation acceptance checks
- GNM appears clearly as a diploma; Other requires the exact qualification name.
- Multiple qualifications and Pursuing status survive save/reload; result validation handles optional marks and distinct result formats.
- Nurse, assistant, caregiver and trainee roles remain distinct in forms, searches and previews.
- Self-declared registration cannot produce a Verified badge; relevant edits reset verification.
- Exact contact/registration/document details stay protected before authorized access.
- Employer profession preferences are enforced by backend access checks.
- Current-location proximity and preferred-work-location matching remain separate; missing coordinates never yield invented distances.
- Not-looking candidates are excluded from new searches/unlocks while prior history remains.
- Existing teacher/pharmacy/electrician profiles, pricing and other cloud apps remain unaffected.

## Location search for all professions
Use searchable, canonical town/village records with district/state and coordinates; support spelling aliases (e.g. Bijapur/Vijayapura), avoid plain free-text matching alone. Current location and preferred work locations are distinct. Offer Living nearby and Willing to work here modes, radius 25/50/100 km, and Nearest first ordering. Initial distances are approximate straight-line distances, labelled as such, not road travel estimates. Do not fabricate distances for locations without coordinates; ask for a resolved location or show distance unavailable.
For Zalki, calculate the actual order for Ballolli, Horti, Indi, Chadachan and Bijapur; do not hard-code that order. Preferred-location matching must include candidates willing to work in Zalki even if currently living farther away. Use town-level location in search previews; exact addresses remain private.

## Reuse and rollout
Reuse existing consent, credit unlocks, hiring stages, application views, unavailable reports, replacement credits, notifications and audit logs. Profession selection and document access must be enforced in backend authorization, not only hidden by the UI. Employer preference changes must preserve existing hiring/application history. Candidate not-looking status blocks new search discovery and new unlocks while retaining existing history and authorized access.
Suggested rollout: profession/profile foundation and employer preferences, Pharmacy, Electricians, Nursing, then canonical location/radius search (shared across professions). Location search can ship alongside the first profession if a verified place dataset is ready. Document retention, verification workflow, location dataset and any geocoding costs require explicit design before implementation. Do not change existing credit pricing or charge twice for the same identity without an agreed billing rule.

Pharmacy implementation status (2026-10-11): see REQUIREMENTS.md Pharmacy release. Teacher and Pharmacist enabled; Nursing/Electrician remain planned. This release retains one candidate profession per account; employer multi-select is implemented. Registration remains self-declared, with no evidence upload or independent verification workflow yet.

Nursing scope clarification: the agreed first Nursing release is Nurses only. Assistant/Caregiver/Trainee options described above are future possibilities, not first-release scope. Add Ready for night shifts? with Yes / No / Open to discussion; show it in View details and employer filters, separately from full-time/part-time work preference.

Deployment successful: Pharmacy released at https://faculty.telicampus.in/. Migration 20261011090000_pharmacy applied to campusfaculty_db, Prisma regenerated and 31,399 place records imported. API/frontend backups and private PostgreSQL dump retained at /tmp/ubuntu/campus-faculty/.deployment/pharmacy-backup-20261010-191115 (server timestamp). Only campusfaculty-api and campusfaculty-worker restarted; all five application services confirmed active. Live HTTPS root, API health, Zalki and Ballolli place searches returned 200. No other application, database or nginx configuration was changed. Employers enable Pharmacists in Account > Edit institution; candidates choose Pharmacist in registration or the campaign QR profession chooser. Nursing remains Coming soon.

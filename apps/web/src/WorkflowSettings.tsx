import { useState } from "react";
import { Button } from "./components/ui/button";
const groups = [
 {title:"Teacher approval",description:"Approve once. Later profile edits retain approval.",items:[["teacher_auto_approve_enabled","Auto-approve teacher profiles","Approve saved new and pending profiles automatically. Turning off requires manual approval for future profiles."]]},
 {title:"General Jobs approval",description:"Synced with Require profile review in General Jobs Settings.",items:[["general_auto_approve_enabled","Auto-approve General Jobs profiles","Approve saved General profiles automatically. Does not change contact privacy or fees."]]},
 {title:"Pharmacy approval",description:"Independent approval for pharmacist profiles.",items:[["pharmacist_auto_approve_enabled","Auto-approve pharmacist profiles","Approve saved Pharmacy profiles automatically. Registration remains self-declared."]]},
 {title:"Nursing approval",description:"Independent approval for nurse profiles.",items:[["nurse_auto_approve_enabled","Auto-approve nurse profiles","Approve saved Nursing profiles automatically. Registration remains self-declared."]]},
  {
    title: "Option 1 · Job-driven",
    description: "Institutions post vacancies. Teachers find jobs and apply.",
    items: [
      [
        "institution_job_posting_enabled",
        "Post jobs",
        "Allow institutions to publish vacancies.",
      ],
      [
        "candidate_job_search_enabled",
        "Find jobs",
        "Let teachers browse published jobs.",
      ],
      [
        "candidate_job_applications_enabled",
        "Apply to jobs",
        "Let teachers submit job applications.",
      ],
    ],
  },
  {
    title: "Option 2 · Search-driven",
    description:
      "Institutions discover teachers directly. No job or application is needed.",
    items: [
      [
        "institution_candidate_search_enabled",
        "Search candidates",
        "Find visible, reviewed teacher profiles.",
      ],
    ],
  },
  {
    title: "Shared contact access",
    description:
      "One unlock record per institution and teacher, across both workflows.",
    items: [
      [
        "institution_candidate_unlock_enabled",
        "Unlock contact details",
        "Allow new contact unlocks using credits and current consent. Existing unlocks remain subject to consent.",
      ],
    ],
  },
];
export function WorkflowSettings({
  data,
  busy,
  superAdmin,
  action,
  setModal,
}: any) {
  const [tab,setTab]=useState("Recruitment");
  const settings = data.settings;
  const option2 =
    settings.find((s: any) => s.key === "institution_candidate_search_enabled")
      ?.value === true &&
    [
      "institution_job_posting_enabled",
      "candidate_job_search_enabled",
      "candidate_job_applications_enabled",
    ].every((k) => settings.find((s: any) => s.key === k)?.value === false);
  return (
    <div className={"settings-layout"+(tab==="Profile Approval"?" approval-settings-layout":"")}>
      <div className="settings-tabs" role="tablist" aria-label="Settings sections">{["Recruitment","Profile Approval","Payments","Policies"].map(v=><button type="button" role="tab" aria-selected={tab===v} className={tab===v?"active":""} key={v} onClick={()=>setTab(v)}>{v}</button>)}</div>
      <div role="tabpanel" aria-label={tab}>{tab!=="Profile Approval"&&<section className="settings-intro">
        <h2>{tab=== "Recruitment"?"Recruitment workflows":tab}</h2>
        <p>Choose how job seekers and employers connect.</p>
        <span className="settings-mode">
          {option2 ? "Search-driven only" : "Custom workflow settings"}
        </span>
      </section>}
      <div className="workflow-grid">
        {groups.filter(g=>tab==="Recruitment"?!g.title.endsWith("approval"):tab==="Profile Approval"?g.title.endsWith("approval"):false).map((g) => (
          <section className="workflow-card" key={g.title}>
            <div className="workflow-heading">
              <h3>{g.title}</h3>
              <p>{g.description}</p>
            </div>
            {g.items.map(([key, label, description]) => {
              const enabled =
                settings.find((s: any) => s.key === key)?.value === true;
              return (
                <div className="setting-row" key={key}>
                  <div>
                    <strong>{label}</strong>
                    <p>{description}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-label={label}
                    aria-checked={enabled}
                    disabled={!superAdmin || busy}
                    className="setting-switch"
                    onClick={() => action(() => fetchSetting(key, !enabled))}
                  >
                    <span className="switch-track">
                      <span />
                    </span>
                    <span className="switch-status">
                      {enabled ? "On" : "Off"}
                    </span>
                  </button>
                </div>
              );
            })}
          </section>
        ))}
      </div>
      {(tab==="Payments"||tab==="Policies") && <section className="workflow-card">
        <div className="workflow-heading">
          <h3>{tab==="Payments"?"Manual UPI collection":"Recruitment policies"}</h3>
          <p>{tab==="Payments"?"Configure the payee for manually verified payments.":"Configure application and subscription rules."}</p>
        </div>
        {tab==="Payments" && <div className="setting-row">
          <div>
            <strong>Manual UPI</strong>
            <p>
              Paid features activate after receipt verification by Super Admin.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={!superAdmin || busy}
            onClick={() =>
              setModal({
                type: "paymentSettings",
                value: settings.find((s: any) => s.key === "payment")?.value,
              })
            }
          >
            Configure payee
          </Button>
        </div>
        }{tab==="Policies" && settings
          .filter(
            (s: any) => typeof s.value !== "boolean" && s.key !== "payment" && s.key !== "simple_pricing" && !s.key.startsWith("campaign:") && !s.key.startsWith("campaign-source:"),
          )
          .map((s: any) => (
            <div className="setting-row" key={s.key}>
              <div>
                <strong>
                  {s.key === "reapply_waiting_days"
                    ? "Reapplication waiting period"
                    : s.key === "expired_subscription_job_policy"
                      ? "Jobs after subscription expiry"
                      : s.key.replaceAll("_", " ")}
                </strong>
                <p>
                  {s.key === "reapply_waiting_days"
                    ? `${s.value} days after an application closes`
                    : "Controls existing jobs when a subscription expires."}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={!superAdmin || busy}
                onClick={() => setModal({ type: "policy", setting: s })}
              >
                Configure
              </Button>
            </div>
          ))}
      </section>}</div>
    </div>
  );
}
let fetchSetting: (key: string, value: boolean) => Promise<any>;
export function configureSettingsRequest(fn: typeof fetchSetting) {
  fetchSetting = fn;
}

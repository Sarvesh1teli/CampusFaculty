import {FeedbackDialog} from "./FeedbackDialog";
import {useGeneral,GeneralPreferences} from "./GeneralJobs";
import {PlacePicker,PreferredPlaces} from "./PlacePicker";
import { useState } from "react";
import { Plus, X, ShieldCheck } from "lucide-react";
import { Button } from "./components/ui/button";
const degrees = [
  "SSLC",
  "10th / SSC",
  "PUC / 12th",
  "PUC Science",
  "B.A",
  "B.Sc",
  "B.Com",
  "D.Ed",
  "B.Ed",
  "Both B.Ed & D.Ed",
  "M.A",
  "M.Sc",
  "M.Com",
  "M.Ed",
  "D.El.Ed",
  "B.El.Ed",
  "B.Tech",
  "B.E",
  "M.Tech",
  "MBA",
  "MCA",
  "BCA",
  "Ph.D",
  "NET / SET",
  "Diploma",
];
function DegreeField({ label, value, onChange, choices=degrees }: any) {
  const [other, setOther] = useState(!!value && !choices.includes(value));
  return (
    <label>
      {label}
      <select
        aria-label={label}
        value={other ? "Other" : value || ""}
        onChange={(e) => {
          setOther(e.target.value === "Other");
          onChange(e.target.value === "Other" ? "" : e.target.value);
        }}
      >
        <option value="">Select qualification</option>
        {choices.map((d:string) => (
          <option key={d}>{d}</option>
        ))}
        <option>Other</option>
      </select>
      {other && (
        <input
          aria-label={label + " — other"}
          placeholder="Enter qualification"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
        />
      )}
    </label>
  );
}
export function ProfileEditor({ data, busy, save, api, action, onDraftChange }: any) {
  const [p, setP] = useState({
      ...data,
      ...(data.profession==="PHARMACIST"?{pharmacyDetails:{registered:"Pending",council:"",registrationNumber:"",workType:"Both",expectedPay:null,...data.pharmacyDetails},subject:data.subject==="Not specified"?"Pharmacist":data.subject}:{}),
      ...(data.profession==="NURSE"?{nursingDetails:{registered:"Pending",council:"",registrationNumber:"",workType:"Both",nightShift:"Open to discussion",department:"",expectedPay:null,...data.nursingDetails},subject:data.subject==="Not specified"?"Nurse":data.subject}:{}),
      personalDetails: data.personalDetails?.firstName
        ? data.personalDetails
        : { firstName: "", middleName: "", lastName: "" },
    }),
    [challenge, setChallenge] = useState(""),
    [code, setCode] = useState("");
  const general=data.profession==="GENERAL";
  const generalCfg=useGeneral(api);
  const nursing=data.profession==="NURSE";
  const pharmacy=nursing||data.profession==="PHARMACIST";
  const detailsKey=nursing?"nursingDetails":"pharmacyDetails";
  const [section, setSection] = useState("Personal");
  const change = (key: string, value: any) => {const next={...p,[key]:value};setP(next);onDraftChange?.(next);};
  const [consentPrompt,setConsentPrompt]=useState(false);
  const [profileMessage,setProfileMessage]=useState("");
  const fresher=p.personalDetails.employmentStatus==="Fresher";
  const roleGuide="This field helps employers understand what work you can do. Freshers: enter your preferred role or subject, such as Accounts Assistant, Sales Executive or Mathematics. Keep experience at 0 years and 0 months; no work history is needed. Experienced candidates: enter your current or previous role or subject and total work experience. Add work history if available without naming your employer.";
  function employmentStatus(value:string){const next={...p,personalDetails:{...p.personalDetails,employmentStatus:value,...(value==="Fresher"?{experienceMonths:0}:{})},...(value==="Fresher"?{experience:0}:{})};setP(next);onDraftChange?.(next);}

  const [validationErrors,setValidationErrors]=useState<string[]>([]);
  function validateProfile(){
    const errors:{section:string,message:string}[]=[];
    const required=(value:any,label:string,section:string)=>{if(!String(value??"").trim()||value==="Not specified")errors.push({section,message:label+" is required."});};
    required(p.location,"Current location","Personal");
    required(p.subject,general?"Job role / subject of interest":pharmacy?"Role / area":"Primary teaching subject","Experience");
    p.education.forEach((e:any,i:number)=>{const label=e.degree||"Education entry "+(i+1);required(e.degree,"Qualification for education entry "+(i+1),"Qualifications");required(e.institution,label+" school / college / university","Qualifications");if(!Number.isInteger(e.year)||e.year<1950||e.year>2100)errors.push({section:"Qualifications",message:label+" needs a valid passing year (1950–2100)."});});
    p.experienceEntries.forEach((e:any,i:number)=>{required(e.role,"Role for experience entry "+(i+1),"Experience");required(e.subject,"Subject for experience entry "+(i+1),"Experience");});
    if(p.personalDetails.aadhaar&&!/^\d{12}$/.test(p.personalDetails.aadhaar))errors.push({section:"Personal",message:"Aadhaar must contain 12 digits, or leave it blank."});
    setValidationErrors(errors.map(e=>e.message));
    if(errors.length){setSection(errors[0].section);setProfileMessage(errors.map(e=>e.message).join(" ")+(errors.some(e=>e.message.includes("role")||e.message.includes("subject"))?" Freshers can enter their preferred job role or subject. ":""));return false;}return true;
  }
  function addSchoolEducation(degree:string){change("education",[...p.education,{degree,institution:"",stream:"",year:new Date().getFullYear(),resultType:"Percentage",result:"",highest:false}]);}
  function persist(allow:boolean){if(!validateProfile()){setConsentPrompt(false);return;}const next={...p,experience:Number(p.experience)||0,directoryVisible:allow,directoryConsent:allow};setP(next);setConsentPrompt(false);save({...next,qualification:(p.education.find((e:any)=>e.highest)?.degree||p.education[0]?.degree||p.qualification||"Not specified"),personalDetails:p.personalDetails.firstName?{...p.personalDetails,experienceMonths:Number(p.personalDetails.experienceMonths)||0}:undefined,skills:p.skills.filter(Boolean),subjects:p.subjects.filter(Boolean),preferredLocations:p.preferredLocations.filter(Boolean)});}
  const completion = Math.round(
    ([
      p.subject !== "Not specified",
      p.qualification !== "Not specified",
      p.location !== "Not specified",
      !!p.mobile,
      p.education.length > 0,
      p.skills.length > 0,
    ].filter(Boolean).length /
      6) *
      100,
  );
  function list(key: string, fields: string[]) {
    return (
      <>
        {p[key].map((entry: any, index: number) => (
          <div className="form-grid entry-row" key={index}>
            {fields.map((field) =>
              field === "degree" ? (
                <DegreeField
                  key={field}
                  choices={general?(generalCfg?.qualifications||degrees):nursing?["ANM","GNM / Diploma Nursing","B.Sc Nursing","Post Basic B.Sc Nursing","M.Sc Nursing"]:pharmacy?["D.Pharm","B.Pharm","M.Pharm","Pharm.D"]:degrees}
                  label="Degree"
                  value={entry[field]}
                  onChange={(value: string) =>
                    change(
                      key,
                      p[key].map((v: any, i: number) =>
                        i === index ? { ...v, degree: value } : v,
                      ),
                    )
                  }
                />
              ) : field === "resultType" ? (
                <label key={field}>
                  Result format
                  <select
                    value={entry[field] || "Percentage"}
                    onChange={(e) =>
                      change(
                        key,
                        p[key].map((v: any, i: number) =>
                          i === index
                            ? { ...v, resultType: e.target.value }
                            : v,
                        ),
                      )
                    }
                  >
                    {["Percentage", "Grade", "CGPA"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <label key={field}>
                  {field === "result"
                    ? "Percentage / grade"
                    : field === "institution"
                      ? (/SSLC|10th|SSC/i.test(entry.degree||"")?"School / board":"University / institution")
                      : field === "stream" ? (/SSLC|10th|SSC/i.test(entry.degree||"")?"Medium of instruction":"Stream / specialization") : field.charAt(0).toUpperCase() + field.slice(1)}
                  <input
                    required
                    type={["year", "years"].includes(field) ? "number" : "text"}
                    placeholder={field==="stream"?(/SSLC|10th|SSC/i.test(entry.degree||"")?"e.g. Kannada medium, English medium":"e.g. Commerce, Science, Computer Science"):undefined}
                    value={entry[field] || ""}
                    onChange={(e) =>
                      change(
                        key,
                        p[key].map((v: any, i: number) =>
                          i === index
                            ? {
                                ...v,
                                [field]: ["year", "years"].includes(field)
                                  ? (e.target.value===""?"":Number(e.target.value))
                                  : e.target.value,
                              }
                            : v,
                        ),
                      )
                    }
                  />
                </label>
              ),
            )}
            <div className="entry-actions">{key==="education"&&<label className="education-primary"><input type="radio" name="highestEducation" checked={entry.highest===true} onChange={()=>change(key,p[key].map((v:any,i:number)=>({...v,highest:i===index})))}/>Highest education</label>}<Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Remove entry"
              onClick={() =>
                change(
                  key,
                  p[key].filter((_: any, i: number) => i !== index),
                )
              }
            >
              <X size={15} />
              Remove
            </Button></div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            change(key, [
              ...p[key],
              Object.fromEntries(
                fields.map((f) => [
                  f,
                  ["year", "years"].includes(f)
                    ? f === "year"
                      ? new Date().getFullYear()
                      : 0
                    : f === "resultType"
                      ? "Percentage"
                      : "",
                ]),
              ),
            ])
          }
        >
          <Plus size={15} />
          Add {key === "education" ? "education" : "experience"}
        </Button>
      </>
    );
  }
  return (
    <>
      {profileMessage&&<FeedbackDialog title="Profile guidance" message={profileMessage} onClose={()=>setProfileMessage("")}/>}
      {consentPrompt&&<div className="modal-backdrop"><section className="card modal consent-save-dialog" role="dialog" aria-modal="true" aria-labelledby="save-consent-title"><h2 id="save-consent-title">{(pharmacy||general)?"Allow employers to discover you?":"Allow schools to discover you?"}</h2><p>{(pharmacy||general)?"Your anonymous profile can be visible to verified employers recruiting your profession.":"Your anonymous teaching profile can be visible to all verified schools and colleges."} They can access your name, mobile and email only after an authorized contact unlock.</p><p>You can withdraw this permission anytime under Privacy. Initial profile approval and active status still apply.</p><div className="card-actions"><Button type="button" disabled={busy} onClick={()=>persist(true)}>Allow all verified institutions & save</Button><Button type="button" variant="outline" disabled={busy} onClick={()=>persist(false)}>Keep directory private & save</Button><Button type="button" variant="ghost" onClick={()=>setConsentPrompt(false)}>Cancel</Button></div></section></div>}
      <form
        className="card profile-form" noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if(validateProfile())setConsentPrompt(true);
        }}
      >
        {validationErrors.length>0&&<div className="alert error" role="alert"><strong>Please complete these fields:</strong><ul>{validationErrors.map(message=><li key={message}>{message}</li>)}</ul></div>}
        <div className="flex-between">
          <div>
            <h2>{general?"Your General Jobs profile":nursing?"Your nurse profile":pharmacy?"Your pharmacist profile":"Your teaching profile"}</h2>
            <p>{data.displayId}</p>
          </div>
          <span className="badge">{completion}% complete</span>
        </div>
        <p className="muted" role="note">Continue moves to the next section. To save all details, open Privacy and select Save profile, then confirm your contact privacy choice.</p>
        {data.profileReviewed===false&&<p className="alert warning" role="status">Awaiting Owner review: saved profile details will appear in employer searches after approval, provided your profile is active, you are seeking work and directory visibility is enabled.</p>}
        <div className="progress">
          <span style={{ width: completion + "%" }} />
        </div>

        <div
          className="profile-tabs"
          role="tablist"
          aria-label="Profile sections"
        >
          {[
            "Personal",
            "Qualifications",
            "Experience",
            "Preferences",
            "Privacy",
          ].map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              id={"profile-tab-" + name}
              aria-controls="profile-panel"
              aria-selected={section === name}
              onClick={() => setSection(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <div
          id="profile-panel"
          role="tabpanel"
          aria-labelledby={"profile-tab-" + section}
        >
          {section === "Personal" && (
            <>
              <h3>Personal details</h3>
              <div className="form-grid personal-fields">
                {["firstName","middleName"].map(key=><label key={key}>{key==="firstName"?"First name":"Middle name"}<input value={p.personalDetails[key]||""} onChange={e=>change("personalDetails",{...p.personalDetails,[key]:e.target.value})}/></label>)}
                <label>Last name<input value={p.personalDetails.lastName||""} onChange={e=>change("personalDetails",{...p.personalDetails,lastName:e.target.value})}/></label>
                <label>Gender<select aria-label="Gender" value={p.personalDetails.gender||""} onChange={e=>change("personalDetails",{...p.personalDetails,gender:e.target.value})}><option value="">Select gender</option>{["Male","Female","Other","Prefer not to say"].map(v=><option key={v}>{v}</option>)}</select></label>
                <label>Date of birth<input type="date" max={new Date().toISOString().slice(0,10)} value={p.personalDetails.dateOfBirth||""} onChange={e=>change("personalDetails",{...p.personalDetails,dateOfBirth:e.target.value})}/></label>
                <label>Aadhaar (optional)<input value={p.personalDetails.aadhaar||""} inputMode="numeric" pattern="[0-9]{12}" maxLength={12} placeholder="12-digit number" autoComplete="off" onChange={e=>change("personalDetails",{...p.personalDetails,aadhaar:e.target.value.replace(/\D/g,"").slice(0,12)})}/></label>
                <label>Mobile number<input type="tel" value={p.mobile||""} onChange={e=>change("mobile",e.target.value)}/></label>
                {(pharmacy||general)?<PlacePicker api={api} label="Current location" value={p.currentPlaceId} initialText={p.location==="Not specified"?"":p.location} onChange={(id:string|null,text:string)=>{const next={...p,currentPlaceId:id,location:text};setP(next);onDraftChange?.(next)}}/>:<label>Current location<input required value={p.location||""} onChange={e=>change("location",e.target.value)}/></label>}
                <label className="profile-address-field">Address (optional)<input value={p.personalDetails.address||""} maxLength={300} placeholder="Street / area, district, state, PIN" autoComplete="street-address" onChange={e=>change("personalDetails",{...p.personalDetails,address:e.target.value})}/></label>
              </div>
            </>
          )}
          {section === "Qualifications" && (
            <>
              <h3>Qualifications</h3>
              
              {list("education", [
                "degree",
                "institution",
                "stream",
                "year",
                "resultType",
                "result",
              ])}
              {!pharmacy&&p.education.some((e:any)=>e.degree&&!/SSLC|SSC|10th|PUC|12th/i.test(e.degree))&&<div className="education-school-prompt"><p>Add your PUC / 12th and SSLC / 10th details below (optional).</p><div className="card-actions">{!p.education.some((e:any)=>/PUC|12th/i.test(e.degree))&&<Button type="button" size="sm" variant="outline" onClick={()=>addSchoolEducation("PUC / 12th")}>Add PUC / 12th details</Button>}{!p.education.some((e:any)=>/SSLC|SSC|10th/i.test(e.degree))&&<Button type="button" size="sm" variant="outline" onClick={()=>addSchoolEducation("SSLC")}>Add SSLC / 10th details</Button>}</div></div>}
            </>
          )}
          {section === "Experience" && (
            <>
              {(!general||(p.jobInterests||[]).includes("teaching"))&&!pharmacy&&<>              <div className="form-grid"><label>Employment status<select aria-label="Employment status" value={p.personalDetails.employmentStatus||""} onChange={e=>employmentStatus(e.target.value)}><option value="">Select employment status</option>{["Fresher","Previously worked","Currently working"].map(v=><option key={v}>{v}</option>)}</select></label><label>Teaching medium<select aria-label="Teaching medium" value={p.personalDetails.teachingMedium||""} onChange={e=>change("personalDetails",{...p.personalDetails,teachingMedium:e.target.value})}><option value="">Select teaching medium</option>{["English","Kannada","Hindi","Marathi","Tamil","Telugu","Malayalam","Urdu","Other"].map(v=><option key={v}>{v}</option>)}</select></label>{p.personalDetails.teachingMedium==="Other"&&<label>Other teaching medium<input maxLength={100} value={p.personalDetails.otherTeachingMedium||""} onChange={e=>change("personalDetails",{...p.personalDetails,otherTeachingMedium:e.target.value})}/></label>}</div>
</>}
              {general&&!(p.jobInterests||[]).includes("teaching")&&<label>Employment status<select value={p.personalDetails.employmentStatus||""} onChange={e=>employmentStatus(e.target.value)}><option value="">Select employment status</option>{["Fresher","Previously worked","Currently working"].map(v=><option key={v}>{v}</option>)}</select></label>}
              {pharmacy&&<div className="form-grid"><label>{nursing?"Registered nurse?":"Registered pharmacist?"}<select value={p[detailsKey].registered} onChange={e=>change(detailsKey,{...p[detailsKey],registered:e.target.value,council:"",registrationNumber:""})}>{["Pending","Yes","No"].map(v=><option key={v}>{v}</option>)}</select></label>{p[detailsKey].registered==="Yes"&&<><label>{nursing?"Nursing council / state":"Pharmacy council / state"}<input required value={p[detailsKey].council} onChange={e=>change(detailsKey,{...p[detailsKey],council:e.target.value})}/></label><label>Registration number<input required value={p[detailsKey].registrationNumber} onChange={e=>change(detailsKey,{...p[detailsKey],registrationNumber:e.target.value})}/></label></>}{nursing&&<><label>Department / specialty<input maxLength={150} value={p[detailsKey].department||""} onChange={e=>change(detailsKey,{...p[detailsKey],department:e.target.value})}/></label><label>Ready for night shift?<select value={p[detailsKey].nightShift} onChange={e=>change(detailsKey,{...p[detailsKey],nightShift:e.target.value})}>{["Yes","No","Open to discussion"].map(v=><option key={v}>{v}</option>)}</select></label></>}<label>Work preference<select value={p[detailsKey].workType} onChange={e=>change(detailsKey,{...p[detailsKey],workType:e.target.value})}>{["Full-time","Part-time","Both"].map(v=><option key={v}>{v}</option>)}</select></label><label>Expected monthly pay (optional)<input type="number" min="0" value={p[detailsKey].expectedPay??""} onChange={e=>change(detailsKey,{...p[detailsKey],expectedPay:e.target.value===""?null:Number(e.target.value)})}/></label><p className="muted">Registration is self-declared. Submitting a number does not mean it has been verified. No certificate-rental arrangement is offered.</p></div>}
              {p.personalDetails.employmentStatus==="Currently working"&&<><label>Current job role (optional)<input maxLength={120} value={p.personalDetails.currentJobRole||""} placeholder="e.g. Accountant, Sales Executive, Teacher" onChange={e=>change("personalDetails",{...p.personalDetails,currentJobRole:e.target.value})}/></label><p className="muted">Your present work can differ from the job role / subject you want next. Do not include your employer name or contact details.</p></>}
              <h3>{general?"Professional summary":pharmacy?"Professional summary":"Teaching summary"}</h3>
              <p className="muted">{fresher?"Fresher: enter the role or subject you want to work in. Experience stays at zero; work history is optional.":"Enter your current or preferred role / subject and total experience in years and months."}</p><Button type="button" size="sm" variant="outline" onClick={()=>setProfileMessage(roleGuide)}>What should I fill?</Button>
              <div className="form-grid">
                {[
                  ["subject", general?"Job role / subject of interest":pharmacy?"Role / area":"Primary subject"],
                  ["experience", "Experience (years)"],
                ].map(([name, label]) =>
                  name === "qualification" ? (
                    <DegreeField
                      key={name}
                      label={label}
                      value={p[name]}
                      onChange={(v: string) => change(name, v)}
                    />
                  ) : (
                    <label key={name}>
                      <span>{label}</span>
                      <input
                        required={name !== "mobile"}
                        value={p[name]}
                        disabled={name==="experience"&&fresher}
                        placeholder={name==="subject"?"e.g. Accounts Assistant, Sales Executive, Mathematics":undefined}
                        type={
                          ["salary", "experience", "noticeDays"].includes(name)
                            ? "number"
                            : "text"
                        }
                        min="0"
                        onChange={(e) =>
                          change(
                            name,
                            ["salary", "experience", "noticeDays"].includes(
                              name,
                            )
                              ? (e.target.value===""?"":Number(e.target.value))
                              : e.target.value,
                          )
                        }
                      />
                    </label>
                  ),
                )}
                <label className="experience-months-field">Experience (months)<input type="number" min="0" max="11" disabled={fresher} value={p.personalDetails.experienceMonths??0} onChange={e=>change("personalDetails",{...p.personalDetails,experienceMonths:e.target.value===""?"":Number(e.target.value)})}/></label>
              </div>
              <h3>{general?"Work experience":nursing?"Nursing experience":pharmacy?"Pharmacy experience":"Teaching experience"}</h3>
              <p className="muted">
                Describe your role without naming your employer to protect your
                identity.
              </p>
              {fresher&&p.experienceEntries.length===0?<p className="muted">No work experience needed for freshers.</p>:list("experienceEntries", ["role", "subject", "years"])}
            </>
          )}
          {section === "Preferences" && (
            <>
              <h3>{general?"Work preferences":pharmacy?"Work preferences":"Teaching preferences"}</h3>
              <div className="form-grid">
                {[
                  ["salary", "Expected salary / month"],
                  ["availability", "Availability"],
                  ["noticeDays", "Notice period (days)"],
                ].map(([name, label]) =>
                  name === "qualification" ? (
                    <DegreeField
                      key={name}
                      label={label}
                      value={p[name]}
                      onChange={(v: string) => change(name, v)}
                    />
                  ) : (
                    <label key={name}>
                      <span>{label}</span>
                      <input
                        required={name !== "mobile"}
                        value={p[name]}
                        type={
                          ["salary", "experience", "noticeDays"].includes(name)
                            ? "number"
                            : "text"
                        }
                        min="0"
                        onChange={(e) =>
                          change(
                            name,
                            ["salary", "experience", "noticeDays"].includes(
                              name,
                            )
                              ? (e.target.value===""?"":Number(e.target.value))
                              : e.target.value,
                          )
                        }
                      />
                    </label>
                  ),
                )}
              </div>

              {(pharmacy||general)&&<PreferredPlaces api={api} ids={p.preferredPlaceIds||[]} locations={p.preferredLocations||[]} onChange={(ids:string[],locations:string[])=>{const next={...p,preferredPlaceIds:ids,preferredLocations:locations};setP(next);onDraftChange?.(next)}}/>}
              {general&&<GeneralPreferences config={generalCfg} p={p} change={change}/>}
              <div className={pharmacy?"pharmacy-preference-fields":""}>
              {[
                ["skills", "Skills"],
                ["subjects", "Subjects and classes"],
                ["preferredLocations", "Preferred locations"],
              ].filter(([key])=>!(pharmacy||general)||key!=="preferredLocations"&&key!=="subjects").map(([key, label]) => (
                <label key={key}>
                  <span>{label}</span> <small>· comma separated</small>
                  <input
                    value={p[key].join(", ")}
                    onChange={(e) =>
                      change(
                        key,
                        e.target.value.split(",").map((s) => s.trim()),
                      )
                    }
                  />
                </label>
              ))}
              {pharmacy&&<label>Description (optional)<textarea rows={2} maxLength={500} value={p[detailsKey].description||""} placeholder="Describe your experience and preferred work. Do not include contact details." onChange={e=>change(detailsKey,{...p[detailsKey],description:e.target.value})}/></label>}
              </div>
            </>
          )}
          {section === "Privacy" && (
            <>
              <label>Job availability<select value={String(p.jobSeeking??true)} onChange={e=>change("jobSeeking",e.target.value==="true")}><option value="true">Looking for a job</option><option value="false">Not currently looking for a job</option></select></label>
              
              {[
                ["active", "My profile is active"],
                [
                  "directoryVisible",
                  "Show my anonymous profile in institution searches",
                ],
                [
                  "directoryConsent",
                  "Allow verified institutions to unlock my contact details from search",
                ],
              ].map(([name, label]) => (
                <label className="check-label" key={name}>
                  <input
                    type="checkbox"
                    checked={p[name]}
                    onChange={(e) => change(name, e.target.checked)}
                  />
                  <span>{label}</span>
                </label>
              ))}
              <p className="muted">
                Application consent is separate. Deactivation suppresses contact
                access.
              </p>
            </>
          )}
        </div>
        <div className="profile-save-bar">
          <span>{section==="Privacy"?"Select Save profile to save all sections.":"Continue does not save. Save all sections under Privacy."}</span><Button type={section==="Privacy"?"submit":"button"} disabled={busy} onClick={section==="Privacy"?undefined:()=>setSection(["Personal","Qualifications","Experience","Preferences","Privacy"][["Personal","Qualifications","Experience","Preferences","Privacy"].indexOf(section)+1])}>{section==="Privacy"?"Save profile":"Continue"}</Button>
        </div>
      </form>
      <details
        className="card profile-form profile-verification"
        style={{ marginTop: 16 }}
      >
        <summary>Verify email & mobile</summary>
        <h2>
          <ShieldCheck size={20} /> Verify your details
        </h2>
        <p>
          Verification requires the platform’s configured email/SMS provider.
        </p>
        <div className="card-actions">
          {["EMAIL", "SMS"].map((channel) => (
            <Button
              key={channel}
              disabled={busy}
              variant="outline"
              onClick={() =>
                action(async () => {
                  const c = await api("auth/verification/start", "POST", {
                    channel,
                  });
                  setChallenge(c.challengeId);
                }, "Verification code sent")
              }
            >
              Verify {channel === "EMAIL" ? "email" : "mobile"}
            </Button>
          ))}
        </div>
        {challenge && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              action(
                () =>
                  api("auth/verification/confirm", "POST", {
                    challengeId: challenge,
                    code,
                  }),
                "Verified",
              );
            }}
          >
            <label>
              6-digit code
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                pattern="[0-9]{6}"
                maxLength={6}
                required
                inputMode="numeric"
              />
            </label>
            <Button disabled={busy}>Confirm code</Button>
          </form>
        )}
      </details>
    </>
  );
}

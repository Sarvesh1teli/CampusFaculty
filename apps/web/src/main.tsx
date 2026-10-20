import {CreditHistory} from "./CreditHistory";
import {SubjectFilter} from "./SubjectFilter";
import {GeneralJobFields,GeneralSettings,GeneralJobSummary,JobFeeInfo} from "./GeneralJobs";
import {UnlockContact} from "./UnlockContact";
import {PreferredWorkPlaces} from "./PreferredWorkPlaces";
import {jobSalary} from "./jobSalary";
import {ForgotPassword} from "./ForgotPassword";
import { CompleteProfileDialog } from "./CompleteProfileDialog";
import {ProfessionCandidateSearch} from "./ProfessionCandidateSearch";
import {ProfessionFields,JobProfessionField} from "./ProfessionFields";
import {UnavailableReports} from "./UnavailableReports";
import {AuditLog} from "./AuditLog";
import {FeedbackDialog} from "./FeedbackDialog";
import { Campaigns } from "./Campaigns";
import { TeacherRegistration } from "./TeacherRegistration";
import { TeacherListings } from "./TeacherListings";
import { CandidateView } from "./CandidateView";
import { Pagination } from "./Pagination";
import { CommercePanel } from "./CommercePanel";
import React, { useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  GraduationCap,
  LayoutDashboard,
  Search,
  BriefcaseBusiness,
  Users,
  UserRound,
  Bell,
  LogOut,
  ArrowRight,
  CalendarDays,
  ShieldCheck,
  Wallet,
  Plus,
  Check,
  Lock,
  SlidersHorizontal,
  X,
  FileText,
  Settings,
  CheckCircle2,
} from "lucide-react";
import { Button } from "./components/ui/button";
import "./styles.css";
import { useRegisterSW } from "virtual:pwa-register/react";
import { WorkflowSettings, configureSettingsRequest } from "./WorkflowSettings";
import { ProfileEditor } from "./ProfileEditor";
type Item = Record<string, any>;
// Keep printed campaign QR links valid while using the neutral registration URL.
if (/^\/teacher-registration\/?$/.test(location.pathname)) {
  history.replaceState(history.state,"","/registration"+location.search+location.hash);
}
let csrf = "";
async function api(url: string, method = "GET", body?: unknown) {
  const r = await fetch("/api/" + url, {
    method,
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.message || "Request failed");
  return data;
}
configureSettingsRequest((key, value) =>
  api("admin/settings/" + key, "PATCH", { value }),
);
const rupees = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n / 100);
function App() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  const [candidateProfession,setCandidateProfession]=useState("TEACHER");

  const [candidateSearchProfile,setCandidateSearchProfile]=useState<any>(null);
  const [teacherCandidates,setTeacherCandidates]=useState(true);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const change = () => setOnline(navigator.onLine);
    window.addEventListener("online", change);
    window.addEventListener("offline", change);
    return () => {
      window.removeEventListener("online", change);
      window.removeEventListener("offline", change);
    };
  }, []);

  const [user, setUser] = useState<Item | null>(null),
    [ready, setReady] = useState(false),
    [page, setRawPage] = useState("Home"),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [data, setData] = useState<any>(null),
    [query, setQuery] = useState(""),
    [searchSession, setSearchSession] = useState(""),
    [modal, setModal] = useState<Item | null>(null),
    [busy, setBusy] = useState(false),
    [notifications, setNotifications] = useState<Item[]>([]),
    [showNotifications, setShowNotifications] = useState(false),
    [drawer, setDrawer] = useState(false);
  const [forgotPassword,setForgotPassword]=useState(false);
  const [newProfileProfession,setNewProfileProfession]=useState<string|null>(null);
  const [jobQuery,setJobQuery]=useState(""),[jobStatus,setJobStatus]=useState(""),[jobPage,setJobPage]=useState(1),[jobSize,setJobSize]=useState(10);
  useEffect(()=>setJobPage(1),[jobQuery,jobStatus,page]);
  const [mobileMenuHome,setMobileMenuHome]=useState(true);
  useEffect(()=>setMobileMenuHome(true),[user?.id]);
  const [registrationRole,setRegistrationRole]=useState("CANDIDATE");
  const [creditProfession,setCreditProfession]=useState<string|undefined>(undefined);
  const [accountTab,setAccountTab]=useState("Overview");
  const [institutionName,setInstitutionName]=useState("");
  const employerProfile=useRef<Promise<any>|null>(null);
  useEffect(()=>{employerProfile.current=null;setInstitutionName("");if(user&&["TENANT_ADMIN","RECRUITER"].includes(user.role))(employerProfile.current=api("institution/profile")).then(v=>setInstitutionName(v.tenant.name)).catch(()=>{employerProfile.current=null});},[user]);
  const [degreeFilter,setDegreeFilter]=useState("");
  const [placeFilter,setPlaceFilter]=useState("");
  const [commercial, setCommercial] = useState<Item>({});
  const [features, setFeatures] = useState<Item>({});
  const loadVersion = useRef(0);
  function setPage(value: string) {
    if (value === page) return;
    loadVersion.current++;
    setData(null);
    setRawPage(value);
  }
  useEffect(()=>{if(user?.role==="CANDIDATE")api("profile").then(p=>setCandidateProfession(p.profession||"TEACHER")).catch(()=>{});},[user]);
  const candidate = user?.role === "CANDIDATE",
    admin = ["SUPER_ADMIN", "PLATFORM_ADMIN"].includes(user?.role);
  const baseNav = admin
    ? [
        "Overview",
        "Institutions",
        ...(user?.role==="SUPER_ADMIN"?["Campaigns"]:[]),
        "Candidates",
        "Payments",
        "Plans",
        ...(user?.role==="SUPER_ADMIN"?["General Jobs Settings"]:[]),
        "Settings",
        "Unavailable reports",
        "Audit",
      ]
    : candidate
      ? ["Home", "Find Jobs", "Applications", "Profile", "Payments"]
      : ["Dashboard", "Candidates", "Jobs", "Hiring", "Account"];
  const available = (n: string, f: Item = features) =>
    n === "Find Jobs"
      ? f.candidate_job_search_enabled !== false
      : n === "Applications"
        ? f.candidate_job_applications_enabled !== false
        : n === "Jobs"
          ? f.institution_job_posting_enabled !== false
          : n === "Candidates"
            ? admin || f.institution_candidate_search_enabled !== false
            : true;
  const nav = baseNav.filter((n) => available(n));
  const icons: any = {
    Home: LayoutDashboard,
    Dashboard: LayoutDashboard,
    "Find Jobs": Search,
    Applications: FileText,
    Profile: UserRound,
    Candidates: Search,
    Jobs: BriefcaseBusiness,
    Hiring: Users,
    Account: Wallet,
    Overview: LayoutDashboard,
    Institutions: GraduationCap,
    Campaigns: Users,
    Payments: Wallet,
    Plans: FileText,
    "General Jobs Settings": Settings,
    Settings: Settings,
    "Unavailable reports": ShieldCheck,
    Audit: ShieldCheck,
  };
  useEffect(() => {
    api("auth/me")
      .then((s) => {
        csrf = s.csrf;
        setUser(s.user);
        setPage(
          s.user.role === "CANDIDATE"
            ? "Home"
            : ["SUPER_ADMIN", "PLATFORM_ADMIN"].includes(s.user.role)
              ? "Overview"
              : "Dashboard",
        );
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);
  async function load() {
    if (!user) return;
    const version = ++loadVersion.current;
    setError("");
    try {
      if(page==="Candidates"&&!admin){
        const profile=await (employerProfile.current??(employerProfile.current=api("institution/profile")));
        const professions=profile.tenant.recruitingProfessions||["TEACHER"];
        const teacherOnly=professions.length===1&&professions[0]==="TEACHER";
        if(version!==loadVersion.current)return;
        setCandidateSearchProfile(profile);
        setTeacherCandidates(teacherOnly);
        const result=teacherOnly?await api("institution/candidates?page=1&profession=TEACHER"):{};
        if(version===loadVersion.current)setData(result);
        return;
      }
      if(!admin&&page==="Jobs"){const result=await api("institution/jobs");if(version===loadVersion.current)setData(result);return;}
      if(admin&&page==="Candidates"){const result=await api("admin/candidates");if(version===loadVersion.current)setData(result);return;}
      if((admin&&page==="Institutions")||(!admin&&page==="Find Jobs")){
        const result=await api(admin?"admin/institutions":"jobs?q="+encodeURIComponent(query));
        if(version===loadVersion.current)setData(result);
        return;
      }
      if(admin){
        const independent=["Campaigns","General Jobs Settings","Plans","Audit","Unavailable reports"].includes(page);
        if(independent){if(version===loadVersion.current)setData({});return;}
        const endpoint=page==="Settings"?"admin/settings-view":page==="Payments"?"admin/payments-view":"admin/overview";
        const result=await api(endpoint);if(version===loadVersion.current)setData(result);return;
      }
      const [currentFeatures,price]=await Promise.all([api("features"),api("commerce/config")]);

      if (version === loadVersion.current) setCommercial(price);
      if (version === loadVersion.current) setFeatures(currentFeatures);
      let result;
      if (admin)
        result =
          page === "Candidates"
            ? await api("admin/candidates")
            : await api("admin/overview");
      else if (page === "Payments") result = {};
      else if (page === "Profile") result = await api("profile");
      else if (page === "Applications") result = await api("applications");
      else if (page === "Find Jobs")
        result = await api("jobs?q=" + encodeURIComponent(query));
      else if (page === "Candidates") {
        const profile=await api("institution/profile");
        const professions=profile.tenant.recruitingProfessions||["TEACHER"];
        const teacherOnly=professions.length===1&&professions[0]==="TEACHER";
        if(version===loadVersion.current)setTeacherCandidates(teacherOnly);
        result=teacherOnly?await api("institution/candidates?page=1&profession=TEACHER"):{};
      }
      else if (page === "Jobs") result = await api("institution/jobs");
      else if (page === "Hiring") result = await api("institution/hiring");
      else if (page === "Home")
        result = {
          jobs:
            currentFeatures.candidate_job_search_enabled === false
              ? []
              : await api("jobs"),
          applications:
            currentFeatures.candidate_job_applications_enabled === false
              ? []
              : await api("applications"),
        };
      else result = await api("institution/account");
      if (version === loadVersion.current) setData(result);
    } catch (e: any) {
      if (version === loadVersion.current) {
        setError(e.message);
        setData(null);
      }
    }
  }
  useEffect(() => {
    setData(null);
    setQuery("");
    setSearchSession("");
    setDegreeFilter("");setPlaceFilter("");
    load();
  }, [user, page]);
  useEffect(() => {
    if (!user) return;
    const poll = () =>
      api("notifications")
        .then(setNotifications)
        .catch(() => {});
    poll();
    const id = setInterval(poll, 30000);
    return () => clearInterval(id);
  }, [user]);
  async function action(fn: () => Promise<any>, message = "Saved") {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const result=await fn();
      employerProfile.current=null;
      setSuccess(message);
      setModal(null);
      if (message !== "Signed out") await load();
      if(message==="Contact access checked")setModal({type:"contact",contact:result});
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const form = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    return Object.fromEntries(new FormData(e.currentTarget));
  };
  async function authenticate(e: React.FormEvent<HTMLFormElement>) {
    const isRegistration=!!modal?.register;
    const values = form(e);
    if(values.generalCategories)values.generalCategories=JSON.parse(String(values.generalCategories));
    if(values.recruitingProfessions)values.recruitingProfessions=JSON.parse(String(values.recruitingProfessions));
    await action(async () => {
      const s = await api(
        modal?.register ? "auth/register" : "auth/login",
        "POST",
        values,
      );
      csrf = s.csrf;
      setUser(s.user);
      if(isRegistration&&s.user.role==="CANDIDATE")setNewProfileProfession(String(values.profession||"TEACHER"));
      setPage(
        s.user.role === "CANDIDATE"
          ? "Home"
          : s.user.role === "SUPER_ADMIN"
            ? "Overview"
            : "Dashboard",
      );
    }, "");
  }
  async function search(pageNumber = 1) {
    setBusy(true);
    setError("");
    try {
      const result = await api(
        "institution/candidates?q=" +
          encodeURIComponent(query) +
          "&degree="+encodeURIComponent(degreeFilter)+"&place="+encodeURIComponent(placeFilter)+
          "&session=" +
          encodeURIComponent(searchSession) +
          "&page=" +
          pageNumber,
      );
      setData(result);
      setSearchSession(result.session);
      setDrawer(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function candidateCard(c:Item){return <tr key={c.id}><td><strong>{c.displayId}</strong></td><td>{c.subject || "—"}</td><td>{c.qualification || "—"}</td><td>{c.location || "—"}</td><td className="preferred-places-cell"><PreferredWorkPlaces places={c.preferredLocations}/></td><td>{c.experience} yrs</td><td>{c.salary>0?"Rs. "+c.salary.toLocaleString("en-IN"):"Not specified"}</td><td className="candidate-mobile">{c.contactUnlocked ? (c.mobile || "Not provided") : "Locked"}</td><td><Button size="sm" variant="outline" onClick={()=>setModal({type:"candidateView",candidate:c})}>View <ArrowRight size={13}/></Button></td></tr>;}
  function jobCard(j: Item) {
    if(candidate)return <button type="button" className="job-list-row" key={j.id} onClick={()=>setModal({type:"apply",job:j})}><span className="job-row-icon"><BriefcaseBusiness size={20}/></span><span className="job-row-info"><strong>{j.title}</strong><small>{j.institution||"Institution"} · {j.location} · {j.subject}</small></span><span className="job-row-meta"><strong>{jobSalary(j)}/month</strong><small>Closes {new Date(j.closesAt).toLocaleDateString("en-IN")}</small></span><ArrowRight size={18}/></button>;
    return <article className="institution-job-row" key={j.id}><button className="job-row-info job-row-open" onClick={()=>setModal({type:"jobDetails",job:j})}><strong>{j.title}</strong><small>{j.subject} · {j.location} · {jobSalary(j)}/month</small></button><span className="job-closing">Closes {new Date(j.closesAt).toLocaleDateString("en-IN")}</span><span className="badge" data-status={j.status}>{j.status === "PUBLISHED" ? "Published" : "Closed"}</span><Button size="sm" variant="outline" onClick={()=>setModal({type:"jobDetails",job:j})}>View</Button>{j.status === "PUBLISHED" && <Button size="sm" variant="outline" onClick={()=>setModal({type:"job",job:j})}>Edit</Button>}{j.status === "PUBLISHED" && <Button size="sm" variant="outline" disabled={busy} onClick={()=>action(()=>api("institution/jobs/"+j.id+"/close","PATCH"),"Job closed")}>Close job</Button>}</article>;
  }
  if(/^\/registration\/?$/.test(location.pathname))return <TeacherRegistration api={api} onSession={(v:any)=>{csrf=v.csrf}}/>;
  if (!ready)
    return (
      <main className="auth-page">
        <GraduationCap size={40} />
        <p>Opening TeliCareers…</p>
      </main>
    );
  if (!user)
    return (
      <main className="auth-page">
        <div className="auth-layout">
          <section className="auth-intro">
        <div className="auth-brand">
          <GraduationCap size={32} />
          <strong>TeliCareers</strong>
        </div>

            <span className="eyebrow">GREAT PEOPLE. NEW OPPORTUNITIES.</span>
            <h1>
              Your next chapter
              <br />
              <span>starts here.</span>
            </h1>
            <p>
              Connect with opportunities across General Jobs, Pharmacy and Nursing. Find your next role or build your team.
            </p>
            <div className="auth-benefits">
              <p>
                <CheckCircle2 /> Private candidate profiles
              </p>
              <p>
                <CheckCircle2 /> One place for your hiring journey
              </p>
              <p>
                <CheckCircle2 /> General Jobs, Pharmacy and Nursing
              </p>
            </div>
          </section>
          {forgotPassword?<ForgotPassword api={api} onBack={()=>{setForgotPassword(false);setModal(null);setError("")}}/>:<form className={"card auth-card"+(modal?.register?" auth-signup"+(registrationRole==="TENANT_ADMIN"?" auth-employer":""):"")} onSubmit={authenticate}>
            <h2>{modal?.register ? "Create your account" : "Welcome back"}</h2>
            <p>
              {modal?.register
                ? "Find opportunities or recruit your team."
                : "Sign in to continue your journey."}
            </p>
            {modal?.register && (
              <>
                <label>
                  Your name
                  <input required name="name" autoComplete="name" />
                </label>
                <label>
                  Account type
                  <select name="role" value={registrationRole} onChange={e=>setRegistrationRole(e.target.value)}>
                    <option value="CANDIDATE">Job seeker</option>
                    <option value="TENANT_ADMIN">Employer / Institution</option>
                  </select>
                </label>
                {registrationRole==="CANDIDATE"?<label>Profession<select name="profession"><option value="GENERAL">General Jobs</option><option value="PHARMACIST">Pharmacist</option><option value="NURSE">Nurse</option></select></label>:<><label>Organization name<input name="institution" required minLength={2}/></label><ProfessionFields api={api}/></>}
              </>
            )}
            <label>
              Email
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete={
                  modal?.register ? "new-password" : "current-password"
                }
                minLength={8}
                required
              />
            </label>
            {!modal?.register&&<button type="button" className="text-button" onClick={()=>{setForgotPassword(true);setError("")}}>Forgot password?</button>}
            {error && (
              <div role="alert" className="alert error">
                {error}
              </div>
            )}
            <Button disabled={busy} type="submit">
              {busy
                ? "Please wait…"
                : modal?.register
                  ? "Create account"
                  : "Sign in"}
              <ArrowRight size={17} />
            </Button>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setModal(modal?.register ? null : { register: true });
                setError("");
              }}
            >
              {modal?.register
                ? "Already registered? Sign in"
                : "New here? Create an account"}
            </button>
          </form>}
        </div>
        <footer>TeliCareers · Connecting people with opportunities</footer>
      </main>
    );
  return (
    <div className="app-shell">{newProfileProfession&&<CompleteProfileDialog profession={newProfileProfession} onComplete={()=>{setNewProfileProfession(null);setPage("Profile");setMobileMenuHome(false);window.scrollTo(0,0)}} onLater={()=>{setNewProfileProfession(null);setPage("Home");setMobileMenuHome(true)}}/>}{success&&<FeedbackDialog success title={success==="Profile saved"?"Profile saved successfully":success==="Saved"?"Settings saved":"Success"} message={success==="Profile saved"?"Your profile changes have been saved.":success==="Saved"?"Your changes have been saved successfully.":success} onClose={()=>setSuccess("")}/> }
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
          <span className="brand-icon">
            <GraduationCap />
          </span>
          <strong>TeliCareers</strong>
        </a>
        <div className="workspace">
          {(candidate||admin)&&<span className="avatar">{user.name.slice(0, 1)}</span>}
          <div>
            <strong>
              {candidate
                ? (candidateProfession==="GENERAL"?"General Jobs workspace":candidateProfession==="NURSE"?"Nurse workspace":candidateProfession==="PHARMACIST"?"Pharmacist workspace":"Teacher workspace")
                : admin
                  ? "Platform workspace"
                  : institutionName || "Institution"}
            </strong>
            <small>{user.name}</small>
          </div>
        </div>

        <nav>
          {nav.map((n) => {
            const Icon = icons[n]||Settings;
            return (
              <button
                key={n}
                className={page === n ? "active" : ""}
                onClick={() => setPage(n)}
              >
                <Icon size={19} />
                {n}
              </button>
            );
          })}
        </nav>
        <button
          className="logout"
          onClick={() =>
            action(async () => {
              await api("auth/logout", "POST");
              csrf = "";
              setUser(null);
              setData(null);
              setNotifications([]);
            }, "Signed out")
          }
        >
          <LogOut size={17} /> Sign out
        </button>
      </aside>
      <div className={"main-shell"+(mobileMenuHome?" mobile-menu-home":"")}>
        <header className="topbar"><button className="mobile-menu-return" onClick={()=>{setMobileMenuHome(true);setShowNotifications(false)}}><GraduationCap size={20}/><span>{mobileMenuHome?"TeliCareers":"All menus"}</span></button>
          <span>
            {candidate
              ? (candidateProfession==="GENERAL"?"General Jobs workspace":candidateProfession==="NURSE"?"Your nursing journey":candidateProfession==="PHARMACIST"?"Your pharmacy journey":"Your teaching journey")
              : admin
                ? "Platform management"
                : "Build your teaching team"}
          </span>
          <div>
            <button
              aria-label="Notifications"
              className="icon-button"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell size={21} />
              {notifications.some((n) => !n.read) && <i />}
            </button>
            <span className="avatar small">{user.name.slice(0, 1)}</span>
            <button
              className="header-logout"
              aria-label="Sign out"
              onClick={() =>
                action(async () => {
                  await api("auth/logout", "POST");
                  setUser(null);
                  csrf = "";
                  setData(null);
                  setNotifications([]);
                }, "Signed out")
              }
            >
              <LogOut size={18} />
              <span>Log out</span>
            </button>
          </div>
        </header>
        <section className={"mobile-menu-hub"+(admin?" owner-menu-hub":"")} aria-label="Workspace menus">
          <p>Welcome, {institutionName || user.name}</p>
          <h1>{admin ? "Platform management" : candidate ? (candidateProfession==="GENERAL"?"General Jobs workspace":candidateProfession==="NURSE"?"Your nursing workspace":candidateProfession==="PHARMACIST"?"Your pharmacy workspace":"Your teaching workspace") : "Your institution workspace"}</h1>
          <p>Choose a menu to get started.</p>
          <div className="mobile-menu-grid">{nav.map((n,i)=>{const Icon=icons[n]||Settings;return <button key={n} className={"mobile-menu-card menu-color-"+(i%6)} onClick={()=>{setPage(n);setMobileMenuHome(false);setShowNotifications(false);window.scrollTo(0,0)}}><span><Icon size={28}/></span><strong>{n}</strong><small>Open {n.toLowerCase()}</small></button>})}</div>
        </section>
        <main className={"content" + (admin ? " admin-content" : "")}>
          {!online && (
            <div className="alert warning">
              You’re offline. Reconnect before making changes.
            </div>
          )}
          {needRefresh && (
            <div className="alert warning">
              An update is ready. Save your work first.
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateServiceWorker(true)}
              >
                Update
              </Button>
            </div>
          )}
          {page==="Jobs"&&modal?.type!=="job"&&<div className="page-actions"><Button onClick={()=>setModal({type:"job"})}><Plus size={17}/>Post a job</Button></div>}
          {data === null && page !== "Candidates" && !error && (
            <div className="empty" role="status">
              Loading your workspace…
            </div>
          )}
          {error&&<FeedbackDialog message={error} onClose={()=>setError("")}/>}
          {showNotifications && (
            <section className="card notifications">
              <div className="flex-between">
                <h2>Notifications</h2>
                <button
                  aria-label="Close notifications"
                  onClick={() => setShowNotifications(false)}
                >
                  <X />
                </button>
              </div>
              {notifications.length ? (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    className="notification"
                    onClick={() =>
                      action(async () => {
                        await api("notifications/" + n.id + "/read", "PATCH");
                        setNotifications(await api("notifications"));
                      })
                    }
                  >
                    <strong>
                      {n.title}
                      {!n.read ? " · New" : ""}
                    </strong>
                    <p>{n.body}</p>
                  </button>
                ))
              ) : (
                <p>You’re all caught up.</p>
              )}
            </section>
          )}
          {(page === "Home" || page === "Dashboard") && data && (
            <>
              <section className="stats">
                <div className="card">
                  <BriefcaseBusiness />
                  <small>
                    {candidate
                      ? available("Find Jobs")
                        ? "Open opportunities"
                        : "Recruitment mode"
                      : "Current plan"}
                  </small>
                  <strong>
                    {candidate
                      ? available("Find Jobs")
                        ? data.jobs.length
                        : "Directory"
                      : data.pricing?.enabled
                        ? "Credit packs"
                        : data.subscription?.snapshot?.name || "Expired"}
                  </strong>
                </div>
                <div className="card">
                  <FileText />
                  <small>
                    {candidate
                      ? available("Applications")
                        ? "Your applications"
                        : "Next step"
                      : "Unlock credits"}
                  </small>
                  <strong>
                    {candidate
                      ? available("Applications")
                        ? data.applications.length
                        : "Your profile"
                      : data.credits}
                  </strong>
                </div>
                <div className="card">
                  <ShieldCheck />
                  <small>
                    {candidate ? "Profile privacy" : "Institution status"}
                  </small>
                  <strong>
                    {candidate
                      ? "Protected"
                      : data.tenant?.verified
                        ? "Verified"
                        : "Pending review"}
                  </strong>
                </div>
              </section>
              {!candidate &&
                !data.pricing?.enabled &&
                (!data.subscription ||
                  new Date(data.subscription.endsAt).getTime() - Date.now() <
                    7 * 86400000) && (
                  <div className="alert warning">
                    {data.subscription
                      ? "Your plan ends on " +
                        new Date(data.subscription.endsAt).toLocaleDateString(
                          "en-IN",
                        )
                      : "Your plan has expired. Existing applications remain available."}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage("Account")}
                    >
                      View plans
                    </Button>
                  </div>
                )}
              <h2 className="section-title">Quick access</h2>
              <section className="modules">
                {(candidate
                  ? ["Find Jobs", "Applications", "Profile"]
                  : ["Candidates", "Jobs", "Hiring", "Account"]
                )
                  .filter((n) => available(n))
                  .map((n, i) => {
                    const Icon = icons[n]||Settings;
                    return (
                      <button
                        className="card module"
                        key={n}
                        onClick={() => setPage(n)}
                      >
                        <span className={"module-icon tone-" + i}>
                          <Icon size={23} />
                        </span>
                        <strong>{n}</strong>
                        <small>
                          {
                            (
                              {
                                Candidates: "Discover your next educator",
                                Jobs: "Manage open opportunities",
                                Hiring: "Follow your hiring pipeline",
                                Account: "Plans, credits and payments",
                                "Find Jobs": "Explore teaching opportunities",
                                Applications: "Track your next steps",
                                Profile: "Keep your details up to date",
                              } as any
                            )[n]
                          }
                        </small>
                        <ArrowRight size={16} />
                      </button>
                    );
                  })}
              </section>
            </>
          )}
          {candidate && page === "Payments" && (
            <CommercePanel api={api} role={user.role} />
          )}
          {page === "Find Jobs" && <TeacherListings api={api} rows={data||[]} setModal={setModal}/>}
          {page === "Candidates" && !admin && teacherCandidates && (

            <>

              {drawer && (

                <div

                  className="modal-backdrop"

                  onClick={() => setDrawer(false)}

                >

                  <form

                    className="card modal"

                    onClick={(e) => e.stopPropagation()}

                    onSubmit={(e) => {

                      e.preventDefault();

                      search();

                    }}

                  >

                    <div className="flex-between">

                      <h2>Filter candidates</h2>

                      <button

                        type="button"

                        aria-label="Close filters"

                        onClick={() => setDrawer(false)}

                      >

                        <X />

                      </button>

                    </div>

                    <label>

                      Subject or location

                      <input

                        value={query}

                        onChange={(e) => {

                          setQuery(e.target.value);

                          setSearchSession("");

                        }}

                        placeholder="For example, Mathematics or Delhi"

                      />

                    </label>

                    <Button disabled={busy}>Apply filter</Button>

                  </form>

                </div>

              )}

              <form

                className="candidate-filter-fields"

                onSubmit={(e) => {

                  e.preventDefault();

                  search();

                }}

              >

<label>Degree<select aria-label="Degree filter" value={degreeFilter} onChange={e=>{setDegreeFilter(e.target.value);setSearchSession("");}}><option value="">Any degree</option>{["SSLC","10th / SSC","PUC / 12th","PUC Science","B.A","B.Sc","B.Com","D.Ed","B.Ed","Both B.Ed & D.Ed","M.A","M.Sc","M.Com","M.Ed","B.Tech","B.E","M.Tech","MBA","MCA","BCA","Ph.D","NET / SET","Diploma"].map(v=><option key={v}>{v}</option>)}</select></label>                <label>Subject<SubjectFilter value={query} onChange={(v:string)=>{setQuery(v);setSearchSession("")}} extra={(data?.items||[]).map((c:any)=>c.subject)}/></label><label>Place<input aria-label="Place filter" placeholder="Place" value={placeFilter} onChange={e=>{setPlaceFilter(e.target.value);setSearchSession("");}}/>

                </label><div className="filter-actions"><Button disabled={busy} size="sm">Search</Button><Button type="button" variant="outline" size="sm" disabled={busy} onClick={async()=>{setQuery("");setDegreeFilter("");setPlaceFilter("");setSearchSession("");setBusy(true);try{setData(await api("institution/candidates?page=1"));}catch(e:any){setError(e.message);}finally{setBusy(false);}}}>Reset</Button></div>

              </form>



              <section className="candidate-table-panel"><div className="candidate-table-toolbar"><span>{data ? data.items.length + " candidates - Page " + data.page : "Loading candidates�"}</span><small>Contacts stay protected until unlocked</small></div><div className="candidate-table-scroll" role="region" aria-label="Candidate results" tabIndex={0}><table className="candidate-table"><thead><tr><th scope="col">Candidate ID</th><th scope="col">Subject</th><th scope="col">Degree</th><th scope="col">Current place</th><th scope="col">Preferred work places</th><th scope="col">Experience</th><th scope="col">Expected salary / month</th><th scope="col">Mobile</th><th scope="col">Action</th></tr></thead><tbody>{data?.items?.map(candidateCard)}</tbody></table></div></section>

              {!data && (

                <div className="empty" role="status">Loading candidates�</div>

              )}

              {data?.items?.length === 0 && (

                <Empty text="No candidates match this search." />

              )}

              {data && (

                <div className="card-actions">

                  <Button

                    variant="outline"

                    disabled={busy || data.page === 1}

                    onClick={() => search(data.page - 1)}

                  >

                    Previous

                  </Button>

                  <span>Page {data.page}</span>

                  <Button

                    variant="outline"

                    disabled={busy || data.items.length < 12}

                    onClick={() => search(data.page + 1)}

                  >

                    Next

                  </Button>

                </div>

              )}

            </>

          )}

          {page === "Candidates" && !admin && !teacherCandidates && <ProfessionCandidateSearch api={api} setModal={setModal} profile={candidateSearchProfile}/>}
          {page === "Jobs" && modal?.type !== "job" && (()=>{const rows=(data||[]).filter((j:Item)=>(!jobStatus||j.status===jobStatus)&&[j.title,j.subject,j.location].join(" ").toLowerCase().includes(jobQuery.trim().toLowerCase()));return <><div className="admin-candidate-filters"><label>Search jobs<input value={jobQuery} placeholder="Title / subject / place" onChange={e=>setJobQuery(e.target.value)}/></label><label>Status<select value={jobStatus} onChange={e=>setJobStatus(e.target.value)}><option value="">All jobs</option><option value="PUBLISHED">Published</option><option value="CLOSED">Closed</option></select></label><Button size="sm" variant="outline" onClick={()=>{setJobQuery("");setJobStatus("")}}>Reset</Button></div><section className="job-list">{rows.slice((jobPage-1)*jobSize,jobPage*jobSize).map(jobCard)}</section><Pagination total={rows.length} page={jobPage} size={jobSize} onPage={setJobPage} onSize={setJobSize}/>{!rows.length&&<Empty text="No jobs match these filters."/>}</>})()}
          {page === "Jobs" && modal?.type === "job" && <section className="card job-compose"><div className="flex-between"><h2>{modal.job?"Edit job":"Post a job"}</h2><Button size="sm" variant="outline" disabled={busy} onClick={()=>setModal(null)}>Cancel</Button></div><Modal modal={modal} busy={busy} action={action} setModal={setModal} form={form} pricing={commercial}/></section>}
          {page === "Applications" && <TeacherListings api={api} rows={data||[]} applications setModal={setModal}/>}
          {page === "Profile" && data && (
            <>
              {!!commercial.profileFee && !commercial.profileActivated && (
                <div className="alert warning">
                  Profile activation: {rupees(commercial.profileFee)}. Complete
                  payment under Payments before saving.{" "}
                  <Button size="sm" onClick={() => setPage("Payments")}>
                    Open payments
                  </Button>
                </div>
              )}
              <ProfileEditor
                key={data.id}
                data={data}
                busy={busy}
                api={api}
                action={action}
                save={(p: Item) =>
                  action(() => api("profile", "PATCH", p), "Profile saved")
                }
              />
            </>
          )}
          {page === "Hiring" && (
            <section className="list hiring-list"><div className="admin-directory-panel"><div className="directory-scroll"><table className="admin-directory-table"><thead><tr>{["Candidate ID","Subject","Qualification","Location","Source","Stage","Action"].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>
              {data?.map((p: Item) => (
<tr key={p.id}><td><strong>{p.candidate.displayId}</strong></td><td>{p.candidate.subject}</td><td>{p.candidate.qualification}</td><td>{p.candidate.location}</td><td>{p.source==="DIRECT_SEARCH"?"Direct search":"Job applicant"}</td><td>{p.stage.replaceAll("_"," ")}</td><td><Button size="sm" variant="outline" onClick={()=>setModal({type:"hiringDetails",entry:p})}>View</Button></td></tr>
              ))}
              </tbody></table></div></div>
              {data?.length === 0 && (
                <Empty text="Applications and directly sourced educators appear here." />
              )}
              <Button
                variant="outline"
                onClick={() => setModal({ type: "reports" })}
              >
                View basic reports
              </Button>
            </section>
          )}
          {page === "Account" && data && (
            <div className="account-layout"><div className="settings-tabs account-tabs" role="tablist" aria-label="Account sections">{["Overview",...(user.role==="TENANT_ADMIN"?["Edit institution","Manage team"]:[]),"Invoices","Payments","Credit History"].map(v=><button role="tab" aria-selected={accountTab===v} className={accountTab===v?"active":""} key={v} onClick={async()=>{if(v==="Manage team"||v==="Edit institution"){try{setModal(v==="Manage team"?{type:"team",team:await api("institution/team")}:{type:"institutionProfile",value:await api("institution/profile")})}catch(e:any){setError(e.message)}}else setAccountTab(v)}}>{v}</button>)}</div>
              {accountTab==="Overview" && <>
              <div className="card account-summary">
                <h2>{data.tenant?.name}</h2>
                <p>
                  {data.tenant?.verified
                    ? "Verified institution"
                    : "Verification pending — contact unlocks require approval"}
                </p>
                <div className="stats">
                  <div>
                    <small>{data.pricing?.enabled?"Access":"Plan"}</small>
                    <strong>
                      {data.pricing?.enabled?"Credit packs":data.subscription?.snapshot?.name || "Expired"}
                    </strong>
                  </div>
                  <div>
                    <small>{data.tenant?.recruitingProfessions?.length===1&&data.tenant.recruitingProfessions[0]==="TEACHER"?"Credits":"Teacher credits"}</small>
                    <strong>{data.credits}</strong>
                  </div>{data.professionBalances?.filter((g:Item)=>g.profession!=="TEACHER").map((g:Item)=><div key={g.profession}><small>{g.profession==="GENERAL"?"General":g.profession==="NURSE"?"Nursing":"Pharmacy"} credits</small><strong>{g._sum.remaining||0}</strong></div>)}
                  <div>
                    <small>
                      {data.pricing?.enabled ? "Credit validity" : "Expires"}
                    </small>
                    <strong>
                      {data.pricing?.enabled
                        ? "Per purchase"
                        : data.subscription
                          ? new Date(
                              data.subscription.endsAt,
                            ).toLocaleDateString("en-IN")
                          : "—"}
                    </strong>
                  </div>
                </div>
              </div>
              </>}
              {data.pricing?.enabled && accountTab==="Overview" && (
                <CommercePanel api={api} role={user.role} initialProfession={creditProfession} view="all" />
              )}
              {accountTab==="Invoices" && <section className="account-history"><h3>Invoices · {data.invoices.length}</h3>{!data.invoices.length&&<p>No invoices yet.</p>}
              <div className="card">
                {data.invoices.map((i: Item) => (
                  <p key={i.id}>
                    <a
                      className="text-blue-600"
                      href={"/api/institution/invoices/" + i.id + "/pdf"}
                    >
                      {i.number} · {rupees(i.amount)} · Download PDF
                    </a>
                  </p>
                ))}
              </div>
              </section>}{accountTab==="Payments" && <section className="account-history"><h3>Previous subscription payments · {data.payments.length}</h3>
              <section className="list">
                {data.payments.map((p: Item) => (
                  <article className="card" key={p.id}>
                    <div className="flex-between">
                      <h3>
                        {p.snapshot.name} · {rupees(p.amount)}
                      </h3>
                      <span className="badge" data-status={p.status}>
                        {p.status.replaceAll("_", " ")}
                      </span>
                    </div>
                    <p>Reference: {p.id}</p>
                    {p.decisionReason && <p>{p.decisionReason}</p>}
                    {["AWAITING_PAYMENT", "REJECTED"].includes(p.status) && (
                      <Button
                        size="sm"
                        onClick={() => setModal({ type: "upi", payment: p })}
                      >
                        Payment instructions / submit UTR
                      </Button>
                    )}
                  </article>
                ))}
                {!data.payments.length && (
                  <Empty text="Your plan payments will appear here." />
                )}
              </section>
              </section>}{accountTab==="Credit History" && <CreditHistory items={data.ledger}/>}
            </div>
          )}
          {admin && data && (
            <Admin
              page={page}
              data={data}
              busy={busy}
              superAdmin={user.role === "SUPER_ADMIN"}
              action={action}
              setModal={setModal}
            />
          )}
        </main>
        <footer className="app-footer">
          TeliCareers · Connections that help careers grow
        </footer>
      </div>
      <nav className={"bottom-nav" + (admin ? " admin-nav" : "")}>
        {nav.map((n) => {
          const Icon = icons[n]||Settings;
          return (
            <button
              key={n}
              className={page === n ? "active" : ""}
              onClick={() => setPage(n)}
            >
              <Icon size={20} />
              <small>{n}</small>
            </button>
          );
        })}
      </nav>
      {modal?.type && modal.type !== "job" && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (!busy) setModal(null);
          }}
        >
          <section
            className={"card modal"+(["apply","jobDetails"].includes(modal.type)?" job-details-modal":"")+(["candidateView","adminCandidate"].includes(modal.type)?" profile-detail-modal":"")}
            role="dialog"
            aria-modal="true"
            aria-label={modal.type}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              aria-label="Close dialog"
              disabled={busy}
              onClick={() => setModal(null)}
            >
              <X />
            </button>
            {error&&<FeedbackDialog message={error} onClose={()=>setError("")}/>}
            <Modal
              key={modal.type}
              modal={modal}
              pricing={commercial}
              onBuyCredits={(profession:string)=>{setCreditProfession(profession);setAccountTab("Overview");setModal(null);setError("");setPage("Account");setMobileMenuHome(false)}}
              busy={busy}
              api={api}
              action={action}
              setModal={setModal}
              form={form}
            />
          </section>
        </div>
      )}
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <GraduationCap size={35} />
      <p>{text}</p>
    </div>
  );
}
const employerTypes=["School","College / Institute","Medical shop / Pharmacy","Hospital","Medical college","Clinic","Bank","Showroom","Company","Other","Not specified"];
function employerType(value:any){const v=String(value||"").trim().toLowerCase();if(!v)return "Not specified";if(v==="school")return "School";if(["college","institute","college / institute","university","coaching"].includes(v))return "College / Institute";if(["medical shop","medicalshop","pharmacy","medical shop / pharmacy"].includes(v))return "Medical shop / Pharmacy";if(v==="hospital")return "Hospital";if(v==="medical college")return "Medical college";if(v==="clinic")return "Clinic";if(v==="bank")return "Bank";if(v==="showroom")return "Showroom";if(v==="company")return "Company";return "Other";}
function Admin({ page, data, busy, superAdmin, action, setModal }: any) {
  const [tablePage,setTablePage]=useState(1),[tableSize,setTableSize]=useState(10),[auditQuery,setAuditQuery]=useState(""),[auditType,setAuditType]=useState("");
  const [institutionQuery,setInstitutionQuery]=useState(""),[institutionStatus,setInstitutionStatus]=useState("");
  const [institutionType,setInstitutionType]=useState("");
  const [candidateProfessionFilter,setCandidateProfessionFilter]=useState("");
  const [candidateName,setCandidateName]=useState("");
  const [candidatePlace,setCandidatePlace]=useState("");
  const [candidateApproval,setCandidateApproval]=useState("");
  useEffect(()=>setTablePage(1),[page,candidateProfessionFilter,candidateName,candidatePlace,candidateApproval,institutionQuery,institutionStatus,institutionType,auditQuery,auditType]);
  const filteredCandidates = page === "Candidates" ? data.filter((c:Item)=>(!candidateProfessionFilter||(c.profession||"TEACHER")===candidateProfessionFilter)&&[c.displayId,c.user.name,c.personalDetails?.firstName,c.personalDetails?.lastName].filter(Boolean).join(" ").toLowerCase().includes(candidateName.trim().toLowerCase()) && String(c.location||"").toLowerCase().includes(candidatePlace.trim().toLowerCase()) && (!candidateApproval || (candidateApproval === "approved" ? c.profileReviewed : !c.profileReviewed))) : [];
  if(page==="General Jobs Settings")return <GeneralSettings api={api}/>;
  if(page==="Unavailable reports")return <UnavailableReports api={api}/>;
  if(page==="Campaigns")return <Campaigns api={api}/>;
  if (page === "Candidates")
    return (
      <><div className="admin-candidate-filters owner-candidate-filters"><label>Name / candidate ID<input value={candidateName} onChange={e=>setCandidateName(e.target.value)} placeholder="Name or TC…"/></label><label>Profession<select value={candidateProfessionFilter} onChange={e=>setCandidateProfessionFilter(e.target.value)}><option value="">All professions</option><option value="GENERAL">General Jobs</option><option value="TEACHER">Teachers (legacy)</option><option value="PHARMACIST">Pharmacists</option><option value="NURSE">Nurses</option></select></label><label>Place<input value={candidatePlace} onChange={e=>setCandidatePlace(e.target.value)} placeholder="City / town"/></label><label>Profile status<select value={candidateApproval} onChange={e=>setCandidateApproval(e.target.value)}><option value="">All profiles</option><option value="approved">Approved</option><option value="pending">Awaiting approval</option></select></label><Button size="sm" variant="outline" onClick={()=>{setCandidateProfessionFilter("");setCandidateName("");setCandidatePlace("");setCandidateApproval("")}}>Reset</Button></div><div className="admin-directory-panel"><div className="directory-count">{filteredCandidates.length} candidates</div><div className="directory-scroll"><table className="admin-directory-table"><thead><tr>{["Candidate ID","Name","Profession","Subject","Degree","Place","Profile","Account","Action"].map(v=><th scope="col" key={v}>{v}</th>)}</tr></thead><tbody>{filteredCandidates.slice((tablePage-1)*tableSize,tablePage*tableSize).map((c:Item)=><tr key={c.id}><td>{c.displayId}</td><td>{c.user.name}</td><td>{c.profession==="GENERAL"?"General Jobs":c.profession==="NURSE"?"Nurse":c.profession==="PHARMACIST"?"Pharmacist":"Teacher"}</td><td>{c.subject}</td><td>{c.qualification}</td><td>{c.location}</td><td>{c.profileReviewed?"Approved":"Pending"}</td><td>{c.user.active?"Active":"Blocked"}</td><td><Button size="sm" variant="outline" onClick={()=>setModal({type:"adminCandidate",candidate:c})}>View</Button></td></tr>)}</tbody></table></div><Pagination total={filteredCandidates.length} page={tablePage} size={tableSize} onPage={setTablePage} onSize={setTableSize}/>{!filteredCandidates.length&&<p className="directory-empty">No candidates match these filters.</p>}</div></>
    );
  if (page === "Overview")
    return (
      <>
        {" "}
        <section className="admin-summary">
          {[
            ["Institutions", data.tenants.length],
            ["Candidates", data.candidateCount],
            [
              "Verified institutions",
              data.tenants.filter((t: Item) => t.verified && !t.blocked).length,
            ],
            [
              "Awaiting verification",
              data.tenants.filter((t: Item) => !t.verified && !t.blocked)
                .length,
            ],
            ["Active plans", data.plans.filter((p: Item) => p.active).length],
            [
              "Payments to review",
              data.payments.filter((p: Item) => p.status === "UNDER_REVIEW")
                .length + (data.commerceReviewCount || 0),
            ],
          ].map(([label, count]) => (
            <div className="card" key={String(label)}>
              <small>{label}</small>
              <strong>{count}</strong>
            </div>
          ))}
        </section>
        <div className="card">
          <h2>Next actions</h2>
          <p>
            Verify institutions, configure Manual UPI, then review incoming
            payment references. UTR submission never grants credits
            automatically.
          </p>
        </div>
      </>
    );
  if(page === "Institutions") { const rows=data.tenants.filter((t:Item)=>(!institutionType||employerType(t.type)===institutionType)&&[t.name,t.id,t.contactPerson,t.mobile,t.officialEmail].join(" ").toLowerCase().includes(institutionQuery.trim().toLowerCase())&&(!institutionStatus||(institutionStatus==="verified"?t.verified&&!t.blocked:institutionStatus==="pending"?!t.verified&&!t.blocked:t.blocked))); return <><div className="admin-candidate-filters institution-type-filters owner-institution-filters"><label>Name / institution ID<input value={institutionQuery} placeholder="Search institutions" onChange={e=>setInstitutionQuery(e.target.value)}/></label><label>Employer type<select value={institutionType} onChange={e=>setInstitutionType(e.target.value)}><option value="">All employer types</option>{employerTypes.map(v=><option key={v}>{v}</option>)}</select></label><label>Status<select value={institutionStatus} onChange={e=>setInstitutionStatus(e.target.value)}><option value="">All institutions</option><option value="verified">Verified</option><option value="pending">Awaiting verification</option><option value="blocked">Blocked</option></select></label><Button size="sm" variant="outline" onClick={()=>{setInstitutionQuery("");setInstitutionStatus("");setInstitutionType("")}}>Reset</Button></div><div className="admin-directory-panel"><div className="directory-count">{rows.length} institutions</div><div className="directory-scroll"><table className="admin-directory-table"><thead><tr>{["Institution","Type","Contact person","Mobile","Verification","Account","Action"].map(v=><th key={v} scope="col">{v}</th>)}</tr></thead><tbody>{rows.slice((tablePage-1)*tableSize,tablePage*tableSize).map((t:Item)=><tr key={t.id}><td><strong>{t.name}</strong></td><td>{employerType(t.type)}</td><td>{t.contactPerson||"Not added"}</td><td>{t.mobile||"Not added"}</td><td>{t.verified?"Verified":"Pending"}</td><td>{t.blocked?"Blocked":"Active"}</td><td><div className="directory-actions"><Button size="sm" variant="outline" onClick={()=>setModal({type:"adminInstitution",institution:t})}>View</Button>
              <Button
                disabled={busy}
                size="sm"
                onClick={() =>
                  action(() =>
                    api("admin/tenants/" + t.id, "PATCH", {
                      verified: !t.verified,
                    }),
                  )
                }
              >
                {t.verified ? "Remove verification" : "Verify institution"}
              </Button>
              <Button
                disabled={busy}
                size="sm"
                variant="outline"
                onClick={() =>
                  action(() =>
                    api("admin/tenants/" + t.id, "PATCH", {
                      blocked: !t.blocked,
                    }),
                  )
                }
              >
                {t.blocked ? "Unblock" : "Block"}
              </Button>
            </div></td></tr>)}</tbody></table></div><Pagination total={rows.length} page={tablePage} size={tableSize} onPage={setTablePage} onSize={setTableSize}/>{!rows.length&&<p className="directory-empty">No institutions match these filters.</p>}</div></>; }
  if (page === "Payments")
    return (
      <section className="list">
        <CommercePanel
          api={api}
          role={superAdmin ? "SUPER_ADMIN" : "PLATFORM_ADMIN"}
        />
        {data.payments.map((p: Item) => (
          <article className="card" key={p.id}>
            <div className="flex-between">
              <h3>
                {rupees(p.amount)} · {p.snapshot.name}
              </h3>
              <span className="badge" data-status={p.status}>{p.status.replaceAll("_", " ")}</span>
            </div>
            <p>{data.tenants.find((t: Item) => t.id === p.tenantId)?.name}</p>
            <p>Submitted reference: {p.utr || "Not submitted"}</p>
            <p>Payee: {p.payeeSnapshot.upiId}</p>
            {superAdmin && p.status === "UNDER_REVIEW" && (
              <Button
                size="sm"
                onClick={() => setModal({ type: "approval", payment: p })}
              >
                Verify receipt & decide
              </Button>
            )}
          </article>
        ))}
        
      </section>
    );
  if (page === "Plans")
    return (
      <CommercePanel
        api={api}
        role={superAdmin ? "SUPER_ADMIN" : "PLATFORM_ADMIN"}
        settings
      />
    );
  if (page === "Legacy Plans")
    return (
      <div className="admin-plans">
        <Button
          onClick={() =>
            setModal({
              type: "editPlan",
              plan: {
                id: null,
                name: "New plan",
                amount: 99900,
                days: 30,
                credits: 15,
                jobLimit: 5,
                searchLimit: -1,
                active: true,
                creditExpiryPolicy: "EXPIRE",
                carryForwardCap: null,
              },
            })
          }
        >
          Create plan
        </Button>
        <section className="compact-plan-grid">
          {data.plans.map((p: Item) => (
            <div className="compact-plan-card" key={p.id}>
              <h3>{p.name}</h3>
              <p>
                {rupees(p.amount)} / {p.days} days
              </p>
              <p>
                {p.credits} credits · {p.jobLimit} job posts
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setModal({ type: "editPlan", plan: p })}
              >
                Edit plan
              </Button>
            </div>
          ))}
        </section>
      </div>
    );
  if (page === "Settings")
    return (
      <WorkflowSettings
        data={data}
        busy={busy}
        superAdmin={superAdmin}
        action={action}
        setModal={setModal}
      />
    );
  return <AuditLog api={api}/>;
}

function Modal({ modal, busy, action, setModal, form, pricing,onBuyCredits }: any) {
  const [confirmApplicationConsent,setConfirmApplicationConsent]=useState(false);
  const [report, setReport] = useState<Item | null>(null);
  useEffect(() => {
    if (modal.type === "reports") api("institution/reports").then(setReport);
  }, [modal.type]);
  const m = modal;
  if(m.type==="adminCandidate") { const c=m.candidate; return <><h2>{c.displayId} · {c.user.name}</h2><dl className="candidate-detail-grid">{[["Email",c.user.email],["Mobile",c.mobile||"Not provided"],["Profile",c.profileReviewed?"Approved":"Awaiting approval"],["Account",c.user.active?"Active":"Blocked"],["Subject",c.subject],["Highest qualification",c.qualification],["Place",c.location],["Experience",c.experience+" years"],["Expected salary",rupees(c.salary*100)],["Directory visibility",c.directoryVisible?"Visible":"Private"],["Directory consent",c.directoryConsent?"Allowed":"Not allowed"],["Availability",c.availability],["Notice period",c.noticeDays+" days"]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value||"—"}</dd></div>)}</dl>{[ ["Nursing details",c.nursingDetails], ["Pharmacy details",c.pharmacyDetails], ["Personal details",{...c.personalDetails,...(c.personalDetails?.aadhaar?{aadhaar:"•••• •••• "+c.personalDetails.aadhaar.slice(-4)}:{})}], ["Qualifications",c.education], ["Experience history",c.experienceEntries], ["Preferences",{skills:c.skills,subjects:c.subjects,preferredLocations:c.preferredLocations}] ].map(([label,value]:any)=><section className="admin-detail-section" key={label}><h3>{label}</h3>{Array.isArray(value)?value.map((entry:any,i:number)=><dl key={i} className="admin-entry-details">{Object.entries(entry).map(([k,v])=><div key={k}><dt>{k.replace(/([A-Z])/g," $1")}</dt><dd>{typeof v==="object"?JSON.stringify(v):String(v??"—")}</dd></div>)}</dl>):value&&typeof value==="object"?<dl className="admin-entry-details">{Object.entries(value).map(([k,v])=><div key={k}><dt>{k.replace(/([A-Z])/g," $1")}</dt><dd>{Array.isArray(v)?v.join(", "):String(v??"—")}</dd></div>)}</dl>:<p>Not provided</p>}</section>)}<div className="card-actions">
              <Button
                size="sm"
                disabled={busy || c.profileReviewed}
                onClick={() =>
                  action(
                    () =>
                      api("admin/candidates/" + c.id, "PATCH", {
                        profileReviewed: true,
                        revision: c.revision,
                      }),
                    "Anonymous profile approved",
                  )
                }
              >
                {c.profileReviewed
                  ? "Profile approved"
                  : "Approve anonymous profile"}
              </Button>
              <Button
                size="sm"
                disabled={busy}
                variant="outline"
                onClick={() =>
                  action(() =>
                    api("admin/candidates/" + c.id, "PATCH", {
                      active: !c.user.active,
                    }),
                  )
                }
              >
                {c.user.active ? "Block account" : "Unblock account"}
              </Button>
            </div></>; }
  if(m.type==="adminInstitution") { const t=m.institution; return <><h2>{t.name}</h2><dl className="candidate-detail-grid">{[["Contact person",t.contactPerson],["Mobile",t.mobile],["Email",t.officialEmail],["Address",t.address],["Institution type",t.type],["Verification",t.verified?"Verified":"Pending"],["Account",t.blocked?"Blocked":"Active"]].map(([k,v])=><div key={k}><dt>{k.replace(/([A-Z])/g," $1")}</dt><dd>{typeof v==="object"?JSON.stringify(v):String(v??"—")}</dd></div>)}</dl></>; }
  if(m.type==="applicationDetails"){const a=m.application;return <><h2>{a.job?.title}</h2><p>{a.firstViewedAt?"Viewed by employer · "+new Date(a.firstViewedAt).toLocaleString("en-IN"):"Not viewed by employer yet"}</p><p>{a.job?.location} · {a.status.replaceAll("_"," ")} · Attempt {a.attempt}</p>                  <p className="timeline">
                    {a.history
                      .map((h: Item) => h.status.replaceAll("_", " "))
                      .join(" → ")}
                  </p>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={a.contactConsent}
                      onChange={(e) =>
                        action(
                          () =>
                            api("applications/" + a.id, "PATCH", {
                              contactConsent: e.target.checked,
                            }),
                          "Application consent updated",
                        )
                      }
                    />{" "}
                    Allow this employer to unlock my contact details
                  </label>
                  {![
                    "WITHDRAWN",
                    "REJECTED",
                    "JOINED",
                    "NOT_SELECTED",
                  ].includes(a.status) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        action(
                          () =>
                            api("applications/" + a.id, "PATCH", {
                              withdraw: true,
                            }),
                          "Application withdrawn",
                        )
                      }
                    >
                      Withdraw application
                    </Button>
                  )}
</>; }
  if(m.type==="candidateView")return <CandidateView applicationId={m.applicationId} candidate={m.candidate} api={api} busy={busy} action={action} setModal={setModal} pricing={pricing}/>;
  if (m.type === "unlock")return <UnlockContact candidate={m.candidate} api={api} action={action} onBuy={onBuyCredits} onCancel={()=>setModal(null)}/>;
  if (m.type === "contact")
    return (
      <>
        <h2>{m.contact.name}</h2>
        <p>{m.contact.email}</p>
        <p>{m.contact.mobile || "No mobile provided"}</p>
        <p className="muted">
          Respect the candidate’s consent when contacting them.
        </p>
      </>
    );
  if(m.type==="hiringDetails"){const p=m.entry;return <>                <article className="card hiring-row" key={p.id}>
                  <div className="flex-between">
                    <h3>
                      {p.candidate.displayId} · {p.candidate.subject}
                    </h3>
                    <span className="badge">
                      {p.source === "DIRECT_SEARCH"
                        ? "Directly sourced"
                        : "Job applicant"}
                    </span>
                  </div>
                  <p>
                    {p.candidate.qualification} · {p.candidate.location} ·{" "}
                    {p.candidate.active ? "Active" : "Inactive"}
                  </p>
                  <div className="card-actions">
                    <select
                      aria-label="Hiring stage"
                      disabled={p.stage === "WITHDRAWN" || busy}
                      value={p.stage}
                      onChange={(e) =>
                        action(
                          () =>
                            api("institution/hiring/" + p.id, "PATCH", {
                              stage: e.target.value,
                            }),
                          "Stage updated",
                        )
                      }
                    >
                      <option value={p.stage}>{p.stage}</option>
                      {[
                        "SHORTLISTED",
                        "INTERVIEW",
                        "SELECTED",
                        "JOINED",
                        "REJECTED",
                        "NOT_SELECTED",
                      ]
                        .filter((n) => n !== p.stage)
                        .map((n) => (
                          <option key={n}>{n}</option>
                        ))}
                    </select>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setModal({ type: "interview", entry: p })}
                    >
                      <CalendarDays size={16} /> Schedule
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setModal({ type: "note", entry: p })}
                    >
                      Add note
                    </Button>
                    <Button
                      size="sm"
                      onClick={() =>
                        setModal({ type: "unlock", candidate: p.candidate })
                      }
                    >
                      <Lock size={14} /> Contact
                    </Button>
                  </div>
                  <details className="hiring-history"><summary>Notes & interviews ({p.notes.length + p.interviews.length})</summary>{p.notes.map((n: Item) => (
                    <p className="note" key={n.id}>
                      {n.text}
                    </p>
                  ))}
                  {p.interviews.map((i: Item) => (
                    <p key={i.id}>
                      <CalendarDays size={14} />{" "}
                      {new Date(i.scheduledAt).toLocaleString("en-IN")} ·{" "}
                      {i.mode}
                    </p>
                  ))}
                  </details>
                </article><Button type="button" variant="outline" onClick={()=>setModal({type:"candidateView",candidate:p.candidate,applicationId:p.applicationId})}>View candidate profile</Button></>;}
  if (m.type === "apply")
    return (
      <>{confirmApplicationConsent&&<div className="modal-backdrop feedback-backdrop"><section className="card modal" role="alertdialog" aria-modal="true" aria-labelledby="application-consent-title"><h2 id="application-consent-title">Contact permission for this application</h2><p>Allow this employer to unlock your phone number and email for this application?</p><p className="muted">Your details remain hidden until an authorized unlock. Your separate profile privacy settings may also allow contact access.</p><div className="card-actions"><Button type="button" disabled={busy} onClick={()=>{setConfirmApplicationConsent(false);action(()=>api("jobs/"+m.job.id+"/apply","POST",{contactConsent:true}),"Application submitted")}}>Allow &amp; apply</Button><Button type="button" variant="outline" disabled={busy} onClick={()=>{setConfirmApplicationConsent(false);action(()=>api("jobs/"+m.job.id+"/apply","POST",{contactConsent:false}),"Application submitted")}}>Apply without contact access</Button><Button type="button" variant="ghost" disabled={busy} onClick={()=>setConfirmApplicationConsent(false)}>Cancel</Button></div></section></div>}<form
        onSubmit={(e: any) => {
          const v = form(e);
          if(v.consent!=="on"){setConfirmApplicationConsent(true);return;}
          action(()=>api("jobs/"+m.job.id+"/apply","POST",{contactConsent:true}),"Application submitted");
        }}
      >
        <h2>{m.job.title}</h2>
        <p>{m.job.institution||"Institution"} · {m.job.location}</p>
        <div className="job-detail-summary"><span>{m.job.subject}</span><span>{jobSalary(m.job)}/month</span><span>Closes {new Date(m.job.closesAt).toLocaleDateString("en-IN")}</span></div>
        <h3>Description & requirements</h3><p className="job-description-text">{m.job.description||"The employer has not added a description."}</p>

        <label className="check-label">
          <input name="consent" type="checkbox" defaultChecked={false} />
          Allow this employer to unlock my phone number and email to contact me about this application.
        </label>
        <p className="muted">Your contact details stay hidden until an authorized unlock.</p>
        <p className="muted">
          {pricing?.applicationFee
            ? "Application fee: " +
              rupees(pricing.applicationFee) +
              ". Purchase this job’s fee under Payments, then return here after approval."
            : "Applying is free."}
        </p>
        {m.job.eligibility?.eligible===false&&<p className="alert warning">{m.job.eligibility.reason}</p>}
        <GeneralJobSummary job={m.job} api={api}/>
        <Button disabled={busy||m.job.eligibility?.eligible===false}>Submit application</Button>
      </form></>
    );
  if (m.type === "jobDetails") return <><h2>{m.job.title}</h2><div className="job-detail-summary"><span>{m.job.subject}</span><span>{m.job.location}</span><span>{jobSalary(m.job)}/month</span><span>{m.job.status}</span><span>Closes {new Date(m.job.closesAt).toLocaleDateString("en-IN")}</span></div><h3>Job description</h3><p className="job-description-text">{m.job.description}</p><GeneralJobSummary job={m.job} api={api}/></>;
  if (m.type === "job")
    return (
      <form
        onSubmit={(e: any) => {
          const formData=new FormData(e.currentTarget);const v:any=form(e);const general=(v.profession||m.job?.profession)==="GENERAL";
          if(general){v.requirements={anyGraduate:formData.get("anyGraduate")==="on",acceptedDegrees:formData.getAll("acceptedDegrees"),requiredDegrees:formData.getAll("requiredDegrees"),minExperience:Number(formData.get("minExperience")||0),categoryDetails:JSON.parse(String(formData.get("categoryDetails")||"{}"))};}
          for(const k of ["anyGraduate","acceptedDegrees","requiredDegrees","minExperience","categoryDetails"])delete v[k];
          action(
            () =>
              api(m.job?"institution/jobs/"+m.job.id:"institution/jobs", m.job?"PATCH":"POST", {
                ...v,
                salaryMax:Number(v.salaryMax),
                salary: Number(v.salary),
                closesAt: new Date(String(v.closesAt)).toISOString(),
              }),
            m.job?"Job updated":"Job posted",
          );
        }}
      >
        <div className="job-compose-fields"><GeneralJobFields api={api} job={m.job}/>{m.job?<label>Profession<input disabled value={m.job.profession==="GENERAL"?"General Jobs":m.job.profession==="NURSE"?"Nurse":m.job.profession==="PHARMACIST"?"Pharmacist":"Teacher"}/></label>:<JobProfessionField api={api}/>}
        {[
          ["title", "Job title"],
          ["subject", "Subject"],
          ["location", "Location"],
          ["salary", "Minimum salary / month"],
          ["salaryMax", "Maximum salary / month"],
          ["closesAt", "Closing date"],
        ].map(([name, label]) => (
          <label key={name}>
            {label}
            <input
              required
              name={name}
              defaultValue={m.job?(name==="closesAt"?new Date(new Date(m.job.closesAt).getTime()-new Date(m.job.closesAt).getTimezoneOffset()*60000).toISOString().slice(0,16):name==="salaryMax"?m.job.salaryMax??m.job.salary:m.job[name]):undefined}
              type={
                ["salary","salaryMax"].includes(name)
                  ? "number"
                  : name === "closesAt"
                    ? "datetime-local"
                    : "text"
              }
              min={["salary","salaryMax"].includes(name) ? "0" : undefined}
            />
          </label>
        ))}
        <label className="job-description-field">
          Description
          <textarea name="description" defaultValue={m.job?.description||""} required minLength={20} maxLength={5000} rows={3} />
        </label></div>
        <JobFeeInfo api={api} job={m.job} pricing={pricing}/>
        <Button disabled={busy}>{m.job?"Save changes":"Publish job"}</Button>
      </form>
    );
  if (m.type === "plans")
    return (
      <>
        <h2>Choose your plan</h2>
        <p>Pay by UPI. Credits activate after verified Super Admin approval.</p>
        {m.plans.map((p: Item) => (
          <div className="plan-row" key={p.id}>
            <div>
              <h3>
                {p.name} · {rupees(p.amount)}
              </h3>
              <p>
                {p.credits} credits · {p.days} days
              </p>
            </div>
            {p.amount > 0 && (
              <Button
                size="sm"
                disabled={busy}
                onClick={() =>
                  action(
                    () => api("institution/payments", "POST", { planId: p.id }),
                    "Payment request created. Open it under Payments.",
                  )
                }
              >
                Select
              </Button>
            )}
          </div>
        ))}
      </>
    );
  if (m.type === "upi")
    return (
      <form
        onSubmit={(e: any) => {
          const v = form(e);
          action(
            () =>
              api(
                "institution/payments/" + m.payment.id + "/submit",
                "POST",
                v,
              ),
            "Reference submitted for manual review",
          );
        }}
      >
        <h2>Pay {rupees(m.payment.amount)} by UPI</h2>
        <p>Payee: {m.payment.payeeSnapshot.payeeName}</p>
        <img
          className="qr"
          alt="Configured payee UPI QR"
          src={m.payment.payeeSnapshot.qrAsset}
        />
        <p>
          <strong>{m.payment.payeeSnapshot.upiId}</strong>
        </p>
        <p>
          Confirm the payee and exact amount in your payment app. Then submit
          the transaction reference below. No screenshot is needed.
        </p>
        <label>
          UTR / transaction reference
          <input name="utr" required minLength={6} maxLength={100} />
        </label>
        <Button disabled={busy}>Submit for review</Button>
      </form>
    );
  if (m.type === "approval")
    return (
      <form
        onSubmit={(e: any) => {
          const v = form(e);
          action(
            () =>
              api("admin/payments/" + m.payment.id + "/decision", "POST", {
                approve: v.decision === "approve",
                receiptReference: v.receiptReference || undefined,
                receivedAmount: Math.round(Number(v.receivedAmount) * 100),
                reason: v.reason,
              }),
            "Payment decision recorded",
          );
        }}
      >
        <h2>Verify payment receipt</h2>
        <p>
          Expected: {rupees(m.payment.amount)}. Check the receiving account
          yourself. A submitted UTR is not proof of payment.
        </p>
        <label>
          Decision
          <select name="decision">
            <option value="approve">Approve after verification</option>
            <option value="reject">Reject</option>
          </select>
        </label>
        <label>
          Actual bank receipt reference
          <input name="receiptReference" />
        </label>
        <label>
          Received amount (₹)
          <input name="receivedAmount" type="number" step="0.01" min="0" />
        </label>
        <label>
          Verification / rejection reason
          <textarea name="reason" minLength={5} required />
        </label>
        <Button disabled={busy}>Record decision</Button>
      </form>
    );
  if (m.type === "paymentSettings")
    return (
      <form
        onSubmit={(e: any) => {
          const v = form(e);
          action(
            () =>
              api("admin/settings/payment", "PATCH", {
                value: {
                  method: "MANUAL_UPI",
                  upiId: v.upiId,
                  payeeName: v.payeeName,
                  qrAsset: v.qrAsset,
                  enabled: v.enabled === "on",
                },
              }),
            "Payment settings saved",
          );
        }}
      >
        <h2>Manual UPI settings</h2>
        {[
          ["upiId", "UPI ID"],
          ["payeeName", "Payee name"],
          ["qrAsset", "Deployment QR path (/assets/upi-qr.png)"],
        ].map(([name, label]) => (
          <label key={name}>
            {label}
            <input name={name} required defaultValue={m.value?.[name]} />
          </label>
        ))}
        <label className="check-label">
          <input
            name="enabled"
            type="checkbox"
            defaultChecked={m.value?.enabled}
          />
          Enable collections after checking bank/app suitability and QR
          destination
        </label>
        <Button disabled={busy}>Save configuration</Button>
      </form>
    );
  if (m.type === "interview")
    return (
      <form
        onSubmit={(e: any) => {
          const v = form(e);
          action(
            () =>
              api("institution/hiring/" + m.entry.id + "/interviews", "POST", {
                ...v,
                scheduledAt: new Date(String(v.scheduledAt)).toISOString(),
              }),
            "Interview scheduled",
          );
        }}
      >
        <h2>Schedule interview</h2>
        <label>
          Date and time (your local timezone)
          <input type="datetime-local" name="scheduledAt" required />
        </label>
        <label>
          Mode
          <select name="mode">
            <option>ONLINE</option>
            <option>IN_PERSON</option>
            <option>PHONE</option>
          </select>
        </label>
        <label>
          Details / meeting location
          <textarea name="details" required />
        </label>
        <Button disabled={busy}>Schedule</Button>
      </form>
    );
  if (m.type === "note")
    return (
      <form
        onSubmit={(e: any) => {
          const v = form(e);
          action(
            () =>
              api("institution/hiring/" + m.entry.id, "PATCH", {
                stage: m.entry.stage,
                note: v.note,
              }),
            "Note saved",
          );
        }}
      >
        <h2>Private hiring note</h2>
        <label>
          Note
          <textarea name="note" required maxLength={2000} />
        </label>
        <Button disabled={busy}>Save note</Button>
      </form>
    );
  if (m.type === "editPlan")
    return (
      <form
        onSubmit={(e: any) => {
          const v = form(e);
          action(
            () =>
              api(
                m.plan.id ? "admin/plans/" + m.plan.id : "admin/plans",
                m.plan.id ? "PATCH" : "POST",
                {
                  name: v.name,
                  amount: Math.round(Number(v.amount) * 100),
                  days: Number(v.days),
                  credits: Number(v.credits),
                  jobLimit: Number(v.jobLimit),
                  searchLimit: Number(v.searchLimit),
                  active: v.active === "on",
                  creditExpiryPolicy: v.creditExpiryPolicy,
                  carryForwardCap:
                    v.carryForwardCap === "" ? null : Number(v.carryForwardCap),
                },
              ),
            "Plan updated for future purchases",
          );
        }}
      >
        <h2>Edit {m.plan.name}</h2>
        <p>Existing purchased terms remain unchanged.</p>
        {[
          ["name", "Name"],
          ["amount", "Price (₹)"],
          ["days", "Days"],
          ["credits", "Credits"],
          ["jobLimit", "Job limit (-1 unlimited)"],
          ["searchLimit", "Search limit (-1 unlimited)"],
        ].map(([name, label]) => (
          <label key={name}>
            {label}
            <input
              name={name}
              type={name === "name" ? "text" : "number"}
              defaultValue={
                name === "amount" ? m.plan.amount / 100 : m.plan[name]
              }
              required
            />
          </label>
        ))}
        <label>
          Unused credit policy
          <select
            name="creditExpiryPolicy"
            defaultValue={m.plan.creditExpiryPolicy || "EXPIRE"}
          >
            <option>EXPIRE</option>
            <option>CARRY_FORWARD</option>
          </select>
        </label>
        <label>
          Carry-forward cap (blank = unlimited)
          <input
            type="number"
            name="carryForwardCap"
            min="0"
            defaultValue={m.plan.carryForwardCap ?? ""}
          />
        </label>
        <label className="check-label">
          <input type="checkbox" name="active" defaultChecked={m.plan.active} />
          Active
        </label>
        <Button disabled={busy}>Save plan</Button>
      </form>
    );
  if (m.type === "institutionProfile")
    return (
      <form
        onSubmit={(e: any) => {
          const v = form(e);
          action(
            () => api("institution/profile", "PATCH", {...v,...(v.generalCategories?{generalCategories:JSON.parse(String(v.generalCategories))}:{}),recruitingProfessions:JSON.parse(String(v.recruitingProfessions))}),
            "Institution updated",
          );
        }}
      >
        <h2>Employer profile</h2><ProfessionFields api={api} initialCategories={m.value.tenant.generalCategories||[]} initial={m.value.tenant.recruitingProfessions||["TEACHER"]}/>
        <p>Changing the institution name requires verification again.</p>
        <label>
          Name
          <input name="name" defaultValue={m.value.tenant.name} required />
        </label>
        <label>
          Type
          <select name="type" defaultValue={m.value.profile.type}>
            {["School", "College", "University", "Coaching", "Medical shop", "Hospital", "Medical college", "Clinic", "Bank", "Showroom", "Company", "Other"].map(
              (n) => (
                <option key={n}>{n}</option>
              ),
            )}
          </select>
        </label>
        {[
          ["address", "Address"],
          ["contactPerson", "Contact person"],
          ["officialEmail", "Official email"],
          ["mobile", "Mobile"],
          ["website", "Website"],
          ["registrationDetails", "Registration details"],
        ].map(([name, label]) => (
          <label key={name}>
            {label}
            <input
              name={name}
              type={name === "officialEmail" ? "email" : "text"}
              defaultValue={m.value.profile[name]}
              required={name === "officialEmail"}
            />
          </label>
        ))}
        <Button disabled={busy}>Save institution</Button>
      </form>
    );
  if (m.type === "policy")
    return (
      <form
        onSubmit={(e: any) => {
          const v = form(e);
          action(
            () =>
              api("admin/settings/" + m.setting.key, "PATCH", {
                value:
                  m.setting.key === "reapply_waiting_days"
                    ? Number(v.value)
                    : v.value,
              }),
            "Policy updated",
          );
        }}
      >
        <h2>{m.setting.key.replaceAll("_", " ")}</h2>
        {m.setting.key === "reapply_waiting_days" ? (
          <label>
            Waiting days
            <input
              name="value"
              type="number"
              min="0"
              max="365"
              defaultValue={m.setting.value}
            />
          </label>
        ) : (
          <label>
            Published jobs after expiry
            <select name="value" defaultValue={m.setting.value}>
              <option value="KEEP_UNTIL_CLOSE">
                Remain visible and accept applications until closing
              </option>
              <option value="KEEP_VISIBLE_PAUSE_APPLICATIONS">
                Remain visible; pause new applications
              </option>
              <option value="HIDE_AFTER_EXPIRY">
                Hide jobs after subscription expiry
              </option>
            </select>
          </label>
        )}
        <Button disabled={busy}>Save policy</Button>
      </form>
    );
  if (m.type === "team")
    return (
      <>
        <h2>Institution team</h2>
        {m.team.map((u: Item) => (
          <div className="plan-row" key={u.id}>
            <div>
              <h3>{u.name}</h3>
              <p>
                {u.email} · {u.role}
              </p>
            </div>
            {u.role === "RECRUITER" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  action(() =>
                    api("institution/team/" + u.id, "PATCH", {
                      active: !u.active,
                    }),
                  )
                }
              >
                {u.active ? "Deactivate" : "Activate"}
              </Button>
            )}
          </div>
        ))}
        <form
          onSubmit={(e: any) => {
            const v = form(e);
            action(() => api("institution/team", "POST", v), "Recruiter added");
          }}
        >
          <h3>Add recruiter</h3>
          <label>
            Name
            <input name="name" required />
          </label>
          <label>
            Email
            <input name="email" type="email" required />
          </label>
          <label>
            Initial password
            <input name="password" type="password" minLength={8} required />
          </label>
          <Button disabled={busy}>Add recruiter</Button>
        </form>
      </>
    );
  if (m.type === "reports")
    return (
      <>
        <h2>Recruitment overview</h2>
        {report ? (
          <>
            <p>
              Jobs: {report.jobs} · Applications: {report.applications} ·
              Unlocks: {report.unlocks}
            </p>
            {report.stages.map((s: Item) => (
              <p key={s.stage}>
                {s.stage}: {s._count}
              </p>
            ))}
          </>
        ) : (
          <p>Loading…</p>
        )}
      </>
    );
  return null;
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

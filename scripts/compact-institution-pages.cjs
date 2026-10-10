const fs=require('fs');if(process.cwd().toLowerCase()!=='c:\\git_project\\campusfaculty')throw Error('Wrong workspace');const file='apps/web/src/main.tsx';let s=fs.readFileSync(file,'utf8');const start=s.indexOf('    return (\n      <article className="card job-card"');const end=s.indexOf('\n  if (!ready)',start);if(start<0||end<0)throw Error('Job boundary');s=s.slice(0,start)+`    return <article className="institution-job-row" key={j.id}><button className="job-row-info job-row-open" onClick={()=>setModal({type:"jobDetails",job:j})}><strong>{j.title}</strong><small>{j.subject} · {j.location} · ₹{j.salary.toLocaleString("en-IN")}/month</small></button><span className="job-closing">Closes {new Date(j.closesAt).toLocaleDateString("en-IN")}</span><span className="badge">{j.status === "PUBLISHED" ? "Published" : "Closed"}</span><Button size="sm" variant="outline" onClick={()=>setModal({type:"jobDetails",job:j})}>View</Button>{j.status === "PUBLISHED" && <Button size="sm" variant="outline" disabled={busy} onClick={()=>action(()=>api("institution/jobs/"+j.id+"/close","PATCH"),"Job closed")}>Close job</Button>}</article>;
  }`+s.slice(end);
s=s.replaceAll('className={candidate?"job-list":"grid-cards"}','className="job-list"');s=s.replace('{page === "Jobs" && (','{page === "Jobs" && modal?.type !== "job" && (');const marker='          {page === "Applications" && (';s=s.replace(marker,`          {page === "Jobs" && modal?.type === "job" && <section className="card job-compose"><div className="flex-between"><h2>Post a job</h2><Button size="sm" variant="outline" disabled={busy} onClick={()=>setModal(null)}>Cancel</Button></div><Modal modal={modal} busy={busy} action={action} setModal={setModal} form={form} pricing={pricing}/></section>}
`+marker);s=s.replace('{modal?.type && (','{modal?.type && modal.type !== "job" && (');s=s.replace('<section className="list">\n              {data?.map((p: Item)', '<section className="list hiring-list">\n              {data?.map((p: Item)');s=s.replace('<article className="card" key={p.id}>','<article className="card hiring-row" key={p.id}>');s=s.replace('                  {p.notes.map((n: Item)', '                  {(p.notes.length > 0 || p.interviews.length > 0) && <details className="hiring-history"><summary>Notes & interviews ({p.notes.length + p.interviews.length})</summary>}{p.notes.map((n: Item)'); // JSX needs details enclosed around expressions
s=s.replace('{(p.notes.length > 0 || p.interviews.length > 0) && <details className="hiring-history"><summary>Notes & interviews ({p.notes.length + p.interviews.length})</summary>}', '<details className="hiring-history"><summary>Notes & interviews ({p.notes.length + p.interviews.length})</summary>');const hiringEnd=s.indexOf('              {data?.length === 0 && (\n                <Empty text="Applications');const before=s.slice(0,hiringEnd);const last=before.lastIndexOf('                </article>');s=s.slice(0,last)+'                  </details>\n'+s.slice(last);
s=s.replace('        <h2>Post an opportunity</h2>','        <div className="job-compose-fields">');s=s.replace('        <label>\n          Description\n          <textarea name="description" required minLength={20} />\n        </label>','        <label className="job-description-field">\n          Description\n          <textarea name="description" required minLength={20} rows={3} />\n        </label></div>');const m='  if (m.type === "job")';s=s.replace(m,`  if (m.type === "jobDetails") return <><h2>{m.job.title}</h2><div className="job-detail-summary"><span>{m.job.subject}</span><span>{m.job.location}</span><span>₹{m.job.salary.toLocaleString("en-IN")}/month</span><span>{m.job.status}</span><span>Closes {new Date(m.job.closesAt).toLocaleDateString("en-IN")}</span></div><h3>Job description</h3><p className="job-description-text">{m.job.description}</p></>;
`+m);fs.writeFileSync(file,s);
fs.appendFileSync('apps/web/src/styles.css',`
/* Dense institution pages with readable mobile controls */
.candidate-list,.job-list,.hiring-list { gap: 6px; }
.candidate-list-row,.institution-job-row { padding: 7px 10px; border-radius: 8px; gap: 10px; }
.candidate-list-row .job-row-icon { width: 30px; height: 30px; }
.candidate-list-row .job-row-info small { margin-top: 2px; font-size: 11px; }
.candidate-list-row button,.institution-job-row button { min-height: 30px; padding: 5px 10px; font-size: 12px; }
.institution-job-row { display: flex; align-items: center; background: white; border: 1px solid #e0e7f1; }
.job-row-open { border: 0; background: transparent; text-align: left; cursor: pointer; padding: 0!important; }
.job-closing { font-size: 11px; color: #718099; }
.job-compose { max-width: 850px; padding: 18px; }
.job-compose h2 { margin: 0; font-size: 18px; }
.job-compose-fields { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px 16px; margin-top: 16px; }
.job-compose-fields label { margin: 0; font-size: 12px; }
.job-compose-fields input,.job-compose-fields textarea { padding: 8px 10px; margin-top: 5px; font-size: 13px; }
.job-description-field { grid-column: 1 / -1; }
.job-compose-fields textarea { min-height: 70px; resize: vertical; }
.job-compose form > p { font-size: 12px; margin: 10px 0; }
.job-description-text { white-space: pre-wrap; }
.hiring-list .hiring-row { padding: 10px 12px; border-radius: 8px; }
.hiring-row h3 { font-size: 13px; margin: 0; }
.hiring-row > p { margin: 4px 0 8px; font-size: 11px; }
.hiring-row .card-actions { margin: 0; gap: 7px; }
.hiring-row .card-actions button,.hiring-row .card-actions select { padding: 6px 10px; min-height: 32px; font-size: 12px; margin: 0; width: auto; }
.hiring-history { margin-top: 7px; font-size: 11px; color: #718099; }
.hiring-history summary { cursor: pointer; }
.account-layout .account-summary { display: grid; grid-template-columns: minmax(180px,1fr) auto; column-gap: 24px; padding: 12px 14px; align-items: center; }
.account-layout .account-summary h2 { font-size: 15px; margin: 0; }
.account-summary > p { grid-column: 1; font-size: 11px; margin-top: 4px; }
.account-layout .account-summary .stats { grid-column: 2; grid-row: 1 / span 2; margin: 0; gap: 22px; }
.account-summary .stats strong { font-size: 14px; margin-top: 3px; }
@media(max-width:760px) { .candidate-list-row { padding: 7px 9px; gap: 7px; } .candidate-list-row .job-row-info { flex-basis: auto; } .institution-job-row { flex-wrap: wrap; gap: 7px; } .institution-job-row .job-row-info { flex-basis: calc(100% - 85px); } .institution-job-row .job-closing { order: 3; } .job-compose { padding: 12px; } .job-compose-fields { gap: 10px; } .job-compose-fields input { min-width: 0; width: 100%; } .job-compose-fields input[type=datetime-local] { font-size: 11px; } .account-layout .account-summary { grid-template-columns: 1fr; gap: 4px; } .account-layout .account-summary .stats { grid-column: 1; grid-row: 3; margin-top: 8px; gap: 18px; } .hiring-row .card-actions { flex-wrap: wrap; } }
`);

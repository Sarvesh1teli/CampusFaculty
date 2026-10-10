const fs=require('fs');if(process.cwd().toLowerCase()!=='c:\\git_project\\campusfaculty')throw Error('Boundary');let p='apps/web/src/main.tsx',s=fs.readFileSync(p,'utf8');s=s.replace('function Admin({ page, data, busy, superAdmin, action, setModal }: any) {','function Admin({ page, data, busy, superAdmin, action, setModal }: any) {\n  const [candidateName,setCandidateName]=useState("");\n  const [candidatePlace,setCandidatePlace]=useState("");\n  const [candidateApproval,setCandidateApproval]=useState("");\n  const filteredCandidates = page === "Candidates" ? data.filter((c:Item)=>[c.displayId,c.user.name,c.personalDetails?.firstName,c.personalDetails?.lastName].filter(Boolean).join(" ").toLowerCase().includes(candidateName.trim().toLowerCase()) && String(c.location||"").toLowerCase().includes(candidatePlace.trim().toLowerCase()) && (!candidateApproval || (candidateApproval === "approved" ? c.profileReviewed : !c.profileReviewed))) : [];');s=s.replace('      <section className="admin-rows candidate-rows">\n        {data.map((c: Item)',`      <><div className="admin-candidate-filters"><label>Name / candidate ID<input value={candidateName} onChange={e=>setCandidateName(e.target.value)} placeholder="Name or TC…"/></label><label>Place<input value={candidatePlace} onChange={e=>setCandidatePlace(e.target.value)} placeholder="City / town"/></label><label>Profile status<select value={candidateApproval} onChange={e=>setCandidateApproval(e.target.value)}><option value="">All profiles</option><option value="approved">Approved</option><option value="pending">Awaiting approval</option></select></label><Button size="sm" variant="outline" onClick={()=>{setCandidateName("");setCandidatePlace("");setCandidateApproval("")}}>Reset</Button></div><section className="admin-rows candidate-rows">
        {filteredCandidates.map((c: Item)`);let a=s.indexOf('      <><div className="admin-candidate-filters"'),b=s.indexOf('  if (page === "Overview")',a);let seg=s.slice(a,b).replace('      </section>','        {filteredCandidates.length===0 && <Empty text="No candidates match these filters."/>}\n      </section></>');s=s.slice(0,a)+seg+s.slice(b);fs.writeFileSync(p,s);fs.appendFileSync('apps/web/src/styles.css',`
/* Compact administration controls */
.commerce-panel .commerce-config { max-width: 780px; padding: 16px; }
.commerce-panel .commerce-config h2 { font-size: 17px; }
.commerce-config .form-grid { grid-template-columns: repeat(3,minmax(0,1fr)); gap: 12px; margin: 12px 0; }
.commerce-config .form-grid label { margin: 0; font-size: 12px; }
.commerce-config .form-grid input { height: 34px; padding: 6px 9px; margin-top: 5px; font-size: 13px; }
.commerce-config .check-label { font-size: 12px; margin: 10px 0; }
.commerce-config > button { min-height: 34px; padding: 7px 12px; font-size: 12px; }
.institution-rows .admin-profile-row { padding: 9px 12px; border-radius: 8px; }
.institution-rows .row-avatar { width: 32px; height: 32px; border-radius: 8px; }
.institution-rows .row-info { display: flex; align-items: center; gap: 14px; }
.institution-rows .row-info h3 { margin: 0; font-size: 13px; }
.institution-rows .row-info p { white-space: nowrap; font-size: 11px; }
.institution-rows .row-actions button { min-height: 32px; padding: 6px 10px; font-size: 12px; }
.admin-candidate-filters { display: grid; grid-template-columns: minmax(160px,240px) minmax(120px,180px) minmax(140px,180px) auto; max-width: 720px; gap: 10px; align-items: end; margin-bottom: 12px; }
.admin-candidate-filters label { margin: 0; font-size: 12px; }
.admin-candidate-filters input,.admin-candidate-filters select { height: 34px; padding: 6px 9px; margin-top: 5px; font-size: 13px; min-width: 0; }
.admin-candidate-filters button { height: 34px; }
@media(max-width:760px) { .commerce-config .form-grid { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; } .admin-candidate-filters { grid-template-columns: repeat(2,minmax(0,1fr)); } .institution-rows .row-info { gap: 8px; flex-wrap: wrap; } .institution-rows .row-info h3 { font-size: 12px; } .institution-rows .row-info p { font-size: 10px; } }
`);

const fs=require('fs');if(process.cwd().toLowerCase()!=='c:\\git_project\\campusfaculty')throw Error('Boundary');const file='apps/web/src/main.tsx';let s=fs.readFileSync(file,'utf8');const a=s.indexOf('  function candidateCard('),b=s.indexOf('  function jobCard',a);s=s.slice(0,a)+`  function candidateCard(c:Item){return <tr key={c.id}><td><strong>{c.displayId}</strong></td><td>{c.subject || "—"}</td><td>{c.qualification || "—"}</td><td>{c.location || "—"}</td><td>{c.experience} yrs</td><td><Button size="sm" variant="outline" onClick={()=>setModal({type:"candidateView",candidate:c})}>View <ArrowRight size={13}/></Button></td></tr>;}
`+s.slice(b);s=s.replace('              <section className="candidate-list">\n                {data?.items?.map(candidateCard)}\n              </section>',`              <section className="candidate-table-panel"><div className="candidate-table-toolbar"><span>{data ? data.items.length + " candidates · Page " + data.page : "Loading candidates…"}</span><small>Contacts stay protected until unlocked</small></div><div className="candidate-table-scroll" role="region" aria-label="Candidate results" tabIndex={0}><table className="candidate-table"><thead><tr><th scope="col">Candidate ID</th><th scope="col">Subject</th><th scope="col">Degree</th><th scope="col">Place</th><th scope="col">Experience</th><th scope="col">Action</th></tr></thead><tbody>{data?.items?.map(candidateCard)}</tbody></table></div></section>`);fs.writeFileSync(file,s);fs.appendFileSync('apps/web/src/styles.css',`
/* Institution candidate directory: compact, aligned columns */
.candidate-table-panel { background: #fff; border: 1px solid #e0e7f1; border-radius: 9px; overflow: hidden; }
.candidate-table-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; font-size: 12px; color: #36516f; }
.candidate-table-toolbar small { font-size: 11px; color: #718099; }
.candidate-table-scroll { overflow-x: auto; }
.candidate-table { border-collapse: collapse; width: 100%; min-width: 650px; text-align: left; font-size: 12px; }
.candidate-table th { background: #f7f9fc; color: #64758b; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .03em; padding: 9px 12px; white-space: nowrap; }
.candidate-table td { padding: 7px 12px; border-top: 1px solid #edf1f7; color: #24405f; }
.candidate-table td strong { font-size: 12px; }
.candidate-table tbody tr:hover { background: #f9fbff; }
.candidate-table th:last-child,.candidate-table td:last-child { text-align: right; width: 85px; }
.candidate-table button { min-height: 28px; padding: 4px 9px; font-size: 11px; }
@media(max-width:760px) { .candidate-table-toolbar { padding: 9px 10px; } .candidate-table-toolbar small { display: none; } .candidate-table { min-width: 620px; } .candidate-table th,.candidate-table td { padding-left: 10px; padding-right: 10px; } }
`);

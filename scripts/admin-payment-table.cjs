const fs=require('fs');if(process.cwd().toLowerCase()!=='c:\\git_project\\campusfaculty')throw Error('Boundary');let p='apps/web/src/CommercePanel.tsx',s=fs.readFileSync(p,'utf8');s=s.replace('    [success, setSuccess] = useState("");','    [success, setSuccess] = useState("");\n  const [search,setSearch]=useState(""),[status,setStatus]=useState(""),[type,setType]=useState(""),[selected,setSelected]=useState<string|null>(null);');s=s.replace('  return (\n    <section className="commerce-panel">','  const filtered=orders.filter(o=>(!status||o.status===status)&&(!type||o.kind===type)&&[o.id,o.customerName,o.tenantId,o.userId,o.utr].filter(Boolean).join(" ").toLowerCase().includes(search.trim().toLowerCase()));\n  return (\n    <section className="commerce-panel">');const start=s.indexOf('        <details className="commerce-orders"'),finish=s.indexOf('          {orders.length === 0 ?',start);s=s.slice(0,start)+`        <>
          {admin && <><div className="payment-filters"><label>Customer / order / UTR<input value={search} placeholder="Search payments" onChange={e=>setSearch(e.target.value)}/></label><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option>{["AWAITING_PAYMENT","UNDER_REVIEW","APPROVED","REJECTED","REFUNDED"].map(v=><option key={v} value={v}>{v.replaceAll("_"," ")}</option>)}</select></label><label>Payment type<select value={type} onChange={e=>setType(e.target.value)}><option value="">All types</option>{Object.entries(names).map(([key,value])=><option key={key} value={key}>{String(value)}</option>)}</select></label><Button size="sm" variant="outline" onClick={()=>{setSearch("");setStatus("");setType("")}}>Reset</Button></div><div className="payment-table-panel"><div className="payment-table-count">{filtered.length} of {orders.length} payments</div><div className="payment-table-scroll"><table className="payment-table"><thead><tr>{["Date","Customer","Payment type","Amount","Credits","UTR","Status","Action"].map(v=><th scope="col" key={v}>{v}</th>)}</tr></thead><tbody>{filtered.map(o=><tr key={o.id}><td>{new Date(o.createdAt).toLocaleDateString("en-IN")}</td><td>{o.customerName || o.tenantId || o.userId}</td><td>{names[o.kind]}</td><td className="payment-amount">{money(o.amount)}</td><td>{o.kind==="UNLOCK_PACK"?o.snapshot.credits:"—"}</td><td>{o.utr||"—"}</td><td><span className="badge">{o.status.replaceAll("_"," ")}</span></td><td><Button size="sm" variant="outline" onClick={()=>setSelected(o.id)}>View</Button></td></tr>)}</tbody></table></div>{!filtered.length&&<p className="payment-empty">No payments match these filters.</p>}</div></>}
          {(!admin || selected) && <div className={admin?"modal-backdrop":"commerce-orders"} onClick={()=>{if(admin&&!busy)setSelected(null)}}><section className={admin?"card modal payment-detail":""} role={admin?"dialog":undefined} aria-modal={admin?true:undefined} aria-label={admin?"Payment details":undefined} onClick={e=>e.stopPropagation()}>{admin?<Button className="payment-detail-close" size="sm" variant="outline" disabled={busy} onClick={()=>setSelected(null)}>Close</Button>:<h3>Purchase history · {orders.length}</h3>}
`+s.slice(finish);s=s.replace('            orders.map((o) => (','            orders.filter(o=>!admin || o.id===selected).map((o) => (');s=s.replace('              <article className="card" key={o.id}>','              <article className={admin?"payment-detail-body":"card"} key={o.id}>');s=s.replace('Customer: {o.tenantId || o.userId}', 'Customer: {o.customerName || o.tenantId || o.userId}');s=s.replace('                <small>Order {o.id}</small>','                <small>Order {o.id}</small><p className="muted">Created {new Date(o.createdAt).toLocaleString("en-IN")}</p>');s=s.replace('        </details>','        </section></div>}</>');fs.writeFileSync(p,s);
p='apps/api/src/main.ts';s=fs.readFileSync(p,'utf8');s=s.replace('    return db.commerceOrder.findMany({ where, orderBy: { createdAt: "desc" } });',`    const orders=await db.commerceOrder.findMany({ where, orderBy: { createdAt: "desc" } });
    if(s.user.role !== "SUPER_ADMIN") return orders;
    const [tenants,users]=await Promise.all([db.tenant.findMany({where:{id:{in:orders.map(o=>o.tenantId).filter((id):id is string=>!!id)}},select:{id:true,name:true}}),db.user.findMany({where:{id:{in:orders.map(o=>o.userId)}},select:{id:true,name:true}})]);
    return orders.map(o=>({...o,customerName:tenants.find(t=>t.id===o.tenantId)?.name || users.find(u=>u.id===o.userId)?.name || o.tenantId || o.userId}));`);fs.writeFileSync(p,s);
fs.appendFileSync('apps/web/src/styles.css',`
.payment-filters { display: grid; grid-template-columns: minmax(180px,260px) minmax(130px,180px) minmax(130px,180px) auto; align-items: end; gap: 10px; max-width: 780px; }
.payment-filters label { margin: 0; font-size: 12px; }
.payment-filters input,.payment-filters select { margin-top: 5px; height: 34px; padding: 6px 9px; font-size: 12px; min-width: 0; }
.payment-filters button { height: 34px; }
.payment-table-panel { border: 1px solid #e0e7f1; border-radius: 9px; overflow: hidden; background: #fff; }
.payment-table-count { padding: 10px 12px; font-size: 12px; color: #60718c; }
.payment-table-scroll { overflow-x: auto; }
.payment-table { width: 100%; min-width: 860px; border-collapse: collapse; text-align: left; font-size: 12px; }
.payment-table th { padding: 9px 12px; background: #f7f9fc; color: #64758b; text-transform: uppercase; font-size: 10px; white-space: nowrap; }
.payment-table td { padding: 8px 12px; border-top: 1px solid #edf1f7; color: #24405f; }
.payment-table tbody tr:hover { background: #f9fbff; }
.payment-amount { font-weight: 600; white-space: nowrap; }
.payment-table button { min-height: 28px; padding: 4px 9px; font-size: 11px; }
.payment-table .badge { white-space: nowrap; }
.payment-empty { padding: 8px 12px; }
.payment-detail { width: min(680px,95vw); }
.payment-detail-close { float: right; }
.payment-detail-body { padding-top: 12px; clear: both; }
.payment-detail-body > small { overflow-wrap: anywhere; }
.payment-detail .commerce-buy { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; }
.payment-detail .commerce-buy label { margin: 0; min-width: 0; }
.payment-detail .commerce-buy input,.payment-detail .commerce-buy select { padding: 8px; }
@media(max-width:760px) { .payment-filters { grid-template-columns: repeat(2,minmax(0,1fr)); } }
`);

import {FeedbackDialog} from "./FeedbackDialog";
import { Pagination } from "./Pagination";
import { useEffect, useState } from "react";
import { Button } from "./components/ui/button";
const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n / 100);
const names: any = {
  PROFILE: "Profile activation",
  APPLICATION: "Job application",
  JOB: "Job posting",
  UNLOCK_PACK: "Unlock credit pack",
};
export function CommercePanel({ api, role, settings = false, view = "all" }: any) {
  const [cfg, setCfg] = useState<any>(null),
    [orders, setOrders] = useState<any[]>([]),
    [jobs, setJobs] = useState<any[]>([]),
    [kind, setKind] = useState("UNLOCK_PACK"),
    [quantity, setQuantity] = useState(1),
    [target, setTarget] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const [search,setSearch]=useState(""),[status,setStatus]=useState(""),[type,setType]=useState(""),[selected,setSelected]=useState<string|null>(null);
  const [tablePage,setTablePage]=useState(1),[tableSize,setTableSize]=useState(10);
  useEffect(()=>setTablePage(1),[search,status,type]);
  const admin = role === "SUPER_ADMIN",
    teacher = role === "CANDIDATE";
  async function load() {
    const [c, o] = await Promise.all([
      api("commerce/config"),
      api("commerce/orders"),
    ]);
    setCfg(c);
    setOrders(o);
    if (teacher && c.applicationFee)
      api("jobs")
        .then(setJobs)
        .catch(() => {});
  }
  useEffect(() => {
    load().catch((e: any) => setError(e.message));
  }, []);
  async function act(fn: () => Promise<any>) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await fn();
      await load();
      setSuccess("Saved");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!cfg) return <p>{error || "Loading payment options…"}</p>;
  const options = teacher
    ? [
        ...(cfg.profileFee && !cfg.profileActivated
          ? [["PROFILE", "Profile activation"]]
          : []),
        ...(cfg.applicationFee ? [["APPLICATION", "Job application"]] : []),
      ]
    : [
        ...(cfg.unlockPaid ? [["UNLOCK_PACK", "Unlock credits"]] : []),
        ...(cfg.jobFee ? [["JOB", "Job posting"]] : []),
      ];
  const chosen = options.some((o) => o[0] === kind) ? kind : options[0]?.[0];
  const HistoryWrapper:any="div";
  const filtered=orders.filter(o=>(!status||o.status===status)&&(!type||o.kind===type)&&[o.id,o.customerName,o.tenantId,o.userId,o.utr].filter(Boolean).join(" ").toLowerCase().includes(search.trim().toLowerCase()));
  return (
    <section className="commerce-panel">
      {error&&<FeedbackDialog message={error} onClose={()=>setError("")}/>}
      {success && (
        <div role="status" className="alert success">
          {success}
        </div>
      )}
      {settings ? (
        <form
          className="card commerce-config"
          onSubmit={(e) => {
            e.preventDefault();
            const v = Object.fromEntries(new FormData(e.currentTarget));
            act(() =>
              api("admin/settings/simple_pricing", "PATCH", {
                value: {
                  enabled: true,
                  profileFee: Math.round(Number(v.profileFee) * 100),
                  applicationFee: Math.round(Number(v.applicationFee) * 100),
                  jobFee: Math.round(Number(v.jobFee) * 100),
                  unlockPaid: v.unlockPaid === "on",
                  packPrice: Math.round(Number(v.packPrice) * 100),
                  packCredits: Number(v.packCredits),
                  validityDays: Number(v.validityDays),
                },
              }),
            );
          }}
        >
          <h2>Fees & unlock packs</h2>
          <p>
            Set a fee to ₹0 to make that feature free. Candidate search stays
            free.
          </p>
          <div className="form-grid">
            {[
              ["profileFee", "Teacher profile fee (₹)"],
              ["applicationFee", "Application fee (₹)"],
              ["jobFee", "Job posting fee (₹)"],
              ["packPrice", "Pack price (₹)"],
              ["packCredits", "Unlocks per pack"],
              ["validityDays", "Credit validity (days)"],
            ].map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  name={key}
                  required
                  type="number"
                  min={
                    ["packPrice", "packCredits", "validityDays"].includes(key)
                      ? 1
                      : 0
                  }
                  step={
                    key.endsWith("Fee") || key === "packPrice" ? ".01" : "1"
                  }
                  defaultValue={
                    key.endsWith("Fee") || key === "packPrice"
                      ? cfg[key] / 100
                      : cfg[key]
                  }
                />
              </label>
            ))}
          </div>
          <label className="check-label">
            <input
              type="checkbox"
              name="unlockPaid"
              defaultChecked={cfg.unlockPaid}
            />
            Charge for new contact unlocks
          </label>
          <Button disabled={busy || !admin}>Save pricing</Button>
          <p className="muted">
            Changes apply to new purchases. Existing quotes, approved fees and
            credit grants keep their purchased terms.
          </p>
        </form>
      ) : (
        !admin && view !== "history" && (
          <div className="card">
            <h2>{teacher ? "Feature payments" : "Unlock credits"}</h2>
            <p>
              {teacher
                ? "Free features need no payment. Paid features become available after payment approval."
                : `${money(cfg.packPrice)} for ${cfg.packCredits} unlocks · valid ${cfg.validityDays} days from approval.`}
            </p>
            {!teacher&&<div className="credit-validity">{cfg.creditValidity?.length?<p>Current credits valid up to {new Date(cfg.creditValidity[cfg.creditValidity.length-1].expiresAt).toLocaleDateString("en-IN")}. {cfg.creditValidity.length>1&&<>Next expiry: {new Date(cfg.creditValidity[0].expiresAt).toLocaleDateString("en-IN")}; {cfg.creditValidity[0].remaining} credits.</>}</p>:<p>No active credit expiry date. Validity starts when payment is approved.</p>}</div>}
            {options.length ? (
              <form
                className="commerce-buy"
                onSubmit={(e) => {
                  e.preventDefault();
                  act(() =>
                    api("commerce/orders", "POST", {
                      kind: chosen,
                      quantity: chosen === "UNLOCK_PACK" ? quantity : 1,
                      target: chosen === "APPLICATION" ? target : "",
                    }),
                  );
                }}
              >
                <label style={options.length===1?{display:"none"}:undefined}>
                  Purchase
                  <select
                    value={chosen}
                    onChange={(e) => setKind(e.target.value)}
                  >
                    {options.map(([value, label]) => (
                      <option value={value} key={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                {chosen === "UNLOCK_PACK" && (
                  <label>
                    Packs
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                    />
                  </label>
                )}
                {chosen === "APPLICATION" && (
                  <label>
                    Job
                    <select
                      required
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                    >
                      <option value="">Select a job</option>
                      {jobs.map((j) => (
                        <option value={j.id} key={j.id}>
                          {j.title} · {j.location}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <strong>
                  {money(
                    chosen === "UNLOCK_PACK"
                      ? cfg.packPrice * quantity
                      : chosen === "PROFILE"
                        ? cfg.profileFee
                        : chosen === "APPLICATION"
                          ? cfg.applicationFee
                          : cfg.jobFee,
                  )}
                  {chosen === "UNLOCK_PACK"
                    ? ` · ${cfg.packCredits * quantity} credits`
                    : ""}
                </strong>
                <Button disabled={busy}>Create payment request</Button>
              </form>
            ) : (
              <p>No paid features are enabled.</p>
            )}
            <p className="muted">
              For a discount, request an adjusted quote from Super Admin before
              paying. Pay the quoted amount first, then submit the UTR / transaction reference. Credits activate only after payment approval.
            </p>
          </div>
        )
      )}
      {!settings && view !== "overview" && (
        <>
          {admin && <><div className="payment-filters"><label>Customer / order / UTR<input value={search} placeholder="Search payments" onChange={e=>setSearch(e.target.value)}/></label><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option>{["AWAITING_PAYMENT","UNDER_REVIEW","APPROVED","REJECTED","REFUNDED"].map(v=><option key={v} value={v}>{v.replaceAll("_"," ")}</option>)}</select></label><label>Payment type<select value={type} onChange={e=>setType(e.target.value)}><option value="">All types</option>{Object.entries(names).map(([key,value])=><option key={key} value={key}>{String(value)}</option>)}</select></label><Button size="sm" variant="outline" onClick={()=>{setSearch("");setStatus("");setType("")}}>Reset</Button></div><div className="payment-table-panel"><div className="payment-table-count">{filtered.length} of {orders.length} payments</div><div className="payment-table-scroll"><table className="payment-table"><thead><tr>{["Date","Customer","Payment type","Amount","Credits","UTR","Status","Action"].map(v=><th scope="col" key={v}>{v}</th>)}</tr></thead><tbody>{filtered.slice((tablePage-1)*tableSize,tablePage*tableSize).map(o=><tr key={o.id}><td data-label="Date">{new Date(o.createdAt).toLocaleDateString("en-IN")}</td><td data-label="Customer">{o.customerName || o.tenantId || o.userId}</td><td data-label="Payment type">{names[o.kind]}</td><td data-label="Amount" className="payment-amount">{money(o.amount)}</td><td data-label="Credits">{o.kind==="UNLOCK_PACK"?o.snapshot.credits:"—"}</td><td data-label="UTR">{o.utr||"—"}</td><td data-label="Status"><span className="badge">{o.status.replaceAll("_"," ")}</span></td><td data-label="Action"><Button size="sm" variant="outline" onClick={()=>setSelected(o.id)}>View</Button></td></tr>)}</tbody></table></div><Pagination total={filtered.length} page={tablePage} size={tableSize} onPage={setTablePage} onSize={setTableSize}/>{!filtered.length&&<p className="payment-empty">No payments match these filters.</p>}</div></>}
          {!admin && <div className="payment-table-panel"><div className="payment-table-count">Purchase history � {orders.length}</div><div className="payment-table-scroll"><table className="payment-table"><thead><tr>{["Date","Purchase","Amount","Credits","Status","Action"].map(v=><th scope="col" key={v}>{v}</th>)}</tr></thead><tbody>{orders.slice((tablePage-1)*tableSize,tablePage*tableSize).map(o=><tr key={o.id}><td>{new Date(o.createdAt).toLocaleDateString("en-IN")}</td><td>{names[o.kind]}</td><td className="payment-amount">{money(o.amount)}</td><td>{o.kind==="UNLOCK_PACK"?o.snapshot.credits:"�"}</td><td><span className="badge">{o.status.replaceAll("_"," ")}</span></td><td><Button size="sm" variant="outline" onClick={()=>setSelected(o.id)}>View</Button></td></tr>)}</tbody></table></div>{!orders.length&&<p className="payment-empty">No purchases yet.</p>}<Pagination total={orders.length} page={tablePage} size={tableSize} onPage={setTablePage} onSize={setTableSize}/></div>}
          {selected && <HistoryWrapper className="modal-backdrop" onClick={()=>{if(!busy)setSelected(null)}}><section className="card modal payment-detail" role="dialog" aria-modal="true" aria-label="Purchase details" onClick={e=>e.stopPropagation()}><Button className="payment-detail-close" size="sm" variant="outline" disabled={busy} onClick={()=>setSelected(null)}>Close</Button>
          {orders.length === 0 ? (
            <p className="muted">No purchases yet.</p>
          ) : (
            orders.filter(o=>o.id===selected).map((o) => (
              <article className="payment-detail-body" key={o.id}>
                <div className="flex-between">
                  <h3>{names[o.kind]}</h3>
                  <span className="badge">{o.status.replaceAll("_", " ")}</span>
                </div>
                <small>Order {o.id}</small><p className="muted">Created {new Date(o.createdAt).toLocaleString("en-IN")}</p>
                <p>
                  {money(o.subtotal)}
                  {o.discount ? ` − ${money(o.discount)} discount` : ""} ·
                  Payable <strong>{money(o.amount)}</strong>
                  {o.kind === "UNLOCK_PACK"
                    ? ` · ${o.snapshot.credits} credits`
                    : ""}
                </p>
                {o.target && (
                  <p className="muted">Application reference: {o.target}</p>
                )}
                {o.reason && <p>{o.reason}</p>}
                {admin ? (
                  <>
                    <p className="muted">
                      Customer: {o.customerName || o.tenantId || o.userId} · UTR:{" "}
                      {o.utr || "Not submitted"}
                    </p>
                    {o.status === "AWAITING_PAYMENT" && (
                      <form
                        className="commerce-buy"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const f = Object.fromEntries(
                            new FormData(e.currentTarget),
                          );
                          act(() =>
                            api(
                              "admin/commerce/" + o.id + "/discount",
                              "PATCH",
                              {
                                discount: Math.round(Number(f.discount) * 100),
                                reason: f.reason,
                              },
                            ),
                          );
                        }}
                      >
                        <label>
                          Discount (₹)
                          <input
                            name="discount"
                            type="number"
                            min="0"
                            max={(o.subtotal - 1) / 100}
                            step=".01"
                            required
                            defaultValue={o.discount / 100}
                          />
                        </label>
                        <label>
                          Reason
                          <input name="reason" required minLength={5} />
                        </label>
                        <Button disabled={busy} variant="outline">
                          Update unpaid quote
                        </Button>
                      </form>
                    )}
                    {o.status === "APPROVED" &&
                      !o.consumedAt &&
                      o.kind !== "UNLOCK_PACK" && (
                        <form
                          className="commerce-buy"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const f = Object.fromEntries(
                              new FormData(e.currentTarget),
                            );
                            act(() =>
                              api(
                                "admin/commerce/" + o.id + "/refund",
                                "POST",
                                {
                                  reference: f.reference,
                                  reason: f.reason,
                                  confirmedReimbursed:
                                    f.confirmedReimbursed === "on",
                                },
                              ),
                            );
                          }}
                        >
                          <label>
                            External refund reference
                            <input name="reference" required minLength={6} />
                          </label>
                          <label>
                            Reason
                            <input name="reason" required minLength={5} />
                          </label>
                          <label className="check-label">
                            <input
                              name="confirmedReimbursed"
                              type="checkbox"
                              required
                            />
                            I have actually reimbursed the payer
                          </label>
                          <Button variant="outline" disabled={busy}>
                            Record completed refund
                          </Button>
                        </form>
                      )}
                    {o.status === "UNDER_REVIEW" && (
                      <form
                        className="commerce-buy"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const f = Object.fromEntries(
                            new FormData(e.currentTarget),
                          );
                          act(() =>
                            api(
                              "admin/commerce/" + o.id + "/decision",
                              "POST",
                              {
                                approve: f.decision === "approve",
                                receiptReference: f.receiptReference,
                                receivedAmount: Math.round(
                                  Number(f.receivedAmount) * 100,
                                ),
                                reason: f.reason,
                              },
                            ),
                          );
                        }}
                      >
                        <label>
                          Decision
                          <select name="decision">
                            <option value="approve">
                              Approve verified receipt
                            </option>
                            <option value="reject">Reject</option>
                          </select>
                        </label>
                        <label>
                          Bank receipt reference
                          <input name="receiptReference" minLength={6} />
                        </label>
                        <label>
                          Actually received (₹)
                          <input
                            name="receivedAmount"
                            type="number"
                            min="0"
                            step=".01"
                          />
                        </label>
                        <label>
                          Reason
                          <input name="reason" required minLength={5} />
                        </label>
                        <Button disabled={busy}>Save decision</Button>
                      </form>
                    )}
                  </>
                ) : (
                  <>
                    {o.status === "AWAITING_PAYMENT" && (
                      <>
                        <p>
                          Pay {money(o.amount)} to {o.payeeSnapshot.payeeName} ·{" "}
                          <strong>{o.payeeSnapshot.upiId}</strong>
                        </p>
                        <img
                          className="payment-qr"
                          src={o.payeeSnapshot.qrAsset}
                          alt="Payment UPI QR"
                        />
                        <form
                          className="commerce-buy"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const f = Object.fromEntries(
                              new FormData(e.currentTarget),
                            );
                            act(() =>
                              api(
                                "commerce/orders/" + o.id + "/submit",
                                "POST",
                                { utr: f.utr, amount: o.amount },
                              ),
                            );
                          }}
                        >
                          <label>
                            Pay first, then enter UTR / transaction reference
                            <input name="utr" required minLength={6} />
                          </label>
                          <Button disabled={busy}>
                            Submit for verification
                          </Button>
                        </form>
                      </>
                    )}
                    {o.status === "APPROVED" && (
                      <p>
                        {o.kind === "UNLOCK_PACK"
                          ? "Credits added to your institution balance."
                          : o.consumedAt
                            ? "Fee used."
                            : "Payment approved. Return to the profile, job form or selected job and complete the action."}
                      </p>
                    )}
                    {o.status === "REJECTED" && (
                      <p>
                        Contact Super Admin to resolve this payment before
                        paying again.
                      </p>
                    )}
                  </>
                )}
              </article>
            ))
          )}
        </section></HistoryWrapper>}</>
      )}
    </section>
  );
}

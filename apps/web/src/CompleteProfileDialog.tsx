import {useEffect,useRef} from "react";
import {CheckCircle2} from "lucide-react";
import {Button} from "./components/ui/button";
export function CompleteProfileDialog({profession,onComplete,onLater}:any){
 const ref=useRef<HTMLButtonElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement;ref.current?.focus();const key=(e:KeyboardEvent)=>{if(e.key==="Escape")onLater();if(e.key==="Tab"){const buttons=ref.current?.closest("section")?.querySelectorAll<HTMLButtonElement>("button");if(!buttons?.length)return;const first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}};window.addEventListener("keydown",key);return()=>{window.removeEventListener("keydown",key);previous?.focus()}},[]);
 const name=profession==="GENERAL"?"General Jobs":profession==="PHARMACIST"?"pharmacist":profession==="NURSE"?"nurse":"teacher";
 return <div className="modal-backdrop feedback-backdrop"><section className="card modal feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="complete-profile-title" aria-describedby="complete-profile-message"><CheckCircle2 size={32} color="#16a34a" aria-hidden="true"/><h2 id="complete-profile-title">Account created successfully</h2><p id="complete-profile-message">Complete your {name} profile so you can apply for jobs and be discovered by employers.</p><div className="card-actions"><Button ref={ref} type="button" onClick={onComplete}>Complete profile</Button><Button type="button" variant="outline" onClick={onLater}>Later</Button></div></section></div>
}

import {z} from "zod";
export const defaultGeneral={enabled:true,approvalRequired:true,profileFee:0,applicationFee:0,jobFee:0,unlockPaid:true,packPrice:20000,packCredits:5,validityDays:365,categories:[
{id:"teaching",name:"Teaching & Education",active:true,fields:["Subjects","Classes","Teaching medium"]},
{id:"banking",name:"Banking & Financial Services",active:true,fields:["Role","Certifications"]},
{id:"accounts",name:"Accounts & Finance",active:true,fields:["Accounting software"]},
{id:"sales",name:"Sales & Marketing",active:true,fields:["Sales area"]},
{id:"retail",name:"Retail & Showroom",active:true,fields:["Product type","Shifts"]},
{id:"office",name:"Office Administration & Back Office",active:true,fields:["Office skills"]},
{id:"support",name:"Customer Support",active:true,fields:["Languages"]},
{id:"it",name:"IT & Computer Support",active:true,fields:["Technical skills"]},
{id:"technical",name:"Technician & Maintenance",active:true,fields:["Trade","Licence"]},
{id:"electrical",name:"Electrical",active:true,fields:["Trade","Licence"]},
{id:"logistics",name:"Logistics & Delivery",active:true,fields:["Licence","Shifts"]},
{id:"hospitality",name:"Hospitality & Hotel",active:true,fields:["Department","Shifts"]},
{id:"other",name:"Other",active:true,fields:["Role"]}],qualifications:["SSLC","PUC / 12th","BA","B.Sc","B.Com","B.Ed","D.Ed","MA","M.Sc","M.Com","M.Ed","BCA","MCA","B.Tech","BE","M.Tech","MBA","Diploma","ITI","Ph.D"]};
export const generalConfigSchema=z.object({enabled:z.boolean(),approvalRequired:z.boolean(),profileFee:z.number().int().min(0).max(10000000),applicationFee:z.number().int().min(0).max(10000000),jobFee:z.number().int().min(0).max(10000000),unlockPaid:z.boolean(),packPrice:z.number().int().min(100).max(10000000),packCredits:z.number().int().min(1).max(10000),validityDays:z.number().int().min(1).max(3650),categories:z.array(z.object({id:z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/),name:z.string().trim().min(2).max(100),active:z.boolean(),fields:z.array(z.string().trim().min(1).max(80)).max(10)})).min(1).max(50),qualifications:z.array(z.string().trim().min(1).max(100)).min(1).max(100)}).superRefine((v,c)=>{if(new Set(v.categories.map(x=>x.id)).size!==v.categories.length)c.addIssue({code:"custom",message:"Category IDs must be unique"})});
export async function generalConfig(t:any){return (await t.setting.findUnique({where:{key:"general_jobs"}}))?.value||defaultGeneral;}
export const normalizeDegree=(v:string)=>v.toLowerCase().replace(/[^a-z0-9]/g,"");
const graduates=new Set(["ba","bsc","bcom","bed","bca","btech","be","bba","bpharm","bscnursing","ma","msc","mcom","med","mca","mtech","mba","mpharm","phd","pharmd"]);
export function eligibility(candidate:any,job:any){if(job.profession!=="GENERAL")return {eligible:true,reason:""};const r=job.requirements||{},degrees=new Set<string>();for(const e of candidate.education||[]){if(e.degree&&Number(e.year)<=new Date().getFullYear()){degrees.add(normalizeDegree(e.degree));if(normalizeDegree(e.degree)==="bothbedded"){degrees.add("bed");degrees.add("ded")}}}
 if(r.anyGraduate&&![...degrees].some(d=>graduates.has(d)))return {eligible:false,reason:"A completed graduate qualification is required to apply."};
 if(r.acceptedDegrees?.length&&!r.acceptedDegrees.some((d:string)=>degrees.has(normalizeDegree(d))))return {eligible:false,reason:"An accepted qualification is required: "+r.acceptedDegrees.join(" or ")+"."};
 if(r.requiredDegrees?.length&&!r.requiredDegrees.every((d:string)=>degrees.has(normalizeDegree(d))))return {eligible:false,reason:"Additional required qualification: "+r.requiredDegrees.join(" and ")+"."};
 if((candidate.experience||0)<(r.minExperience||0))return {eligible:false,reason:"At least "+r.minExperience+" years of experience required."};return {eligible:true,reason:""};}
export const requirementsSchema=z.object({anyGraduate:z.boolean().default(false),acceptedDegrees:z.array(z.string().trim().min(1).max(100)).max(50).default([]),requiredDegrees:z.array(z.string().trim().min(1).max(100)).max(20).default([]),minExperience:z.number().int().min(0).max(60).default(0),categoryDetails:z.record(z.string().max(80),z.string().trim().max(500)).default({})});

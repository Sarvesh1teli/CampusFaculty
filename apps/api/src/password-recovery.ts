import {BadRequestException,HttpException,ServiceUnavailableException} from "@nestjs/common";
import {createHash,createHmac,randomBytes,randomInt,scryptSync,timingSafeEqual} from "node:crypto";
import nodemailer from "nodemailer";
import {z} from "zod";
import {base} from "./database";
const roles=["CANDIDATE","TENANT_ADMIN","RECRUITER"];
const version=(password:string)=>createHash("sha256").update(password).digest("hex");
const digest=(value:string)=>createHmac("sha256",process.env.PASSWORD_RESET_SECRET||"").update(value).digest("hex");
export function recoveryEnabled(){return process.env.PASSWORD_RESET_ENABLED==="true"&&!!process.env.GMAIL_USER&&!!process.env.GMAIL_APP_PASSWORD&&(process.env.PASSWORD_RESET_SECRET?.length||0)>=32;}
export async function requestRecovery(body:any,ip:string){
 if(!recoveryEnabled())throw new ServiceUnavailableException("Password recovery is not available yet. Please try again after email setup is complete.");
 const b=z.object({email:z.string().trim().email().max(254)}).parse(body),email=b.email.toLowerCase();
 const token=randomBytes(32).toString("hex"),id=version(token),code=String(randomInt(0,1000000)).padStart(6,"0"),emailKey=digest("email:"+email),ipKey=digest("ip:"+ip);
 const result=await base.$transaction(async t=>{
  await t.$queryRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))::text","recovery-ip:"+ipKey);
  await t.$queryRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))::text","recovery-email:"+emailKey);
  const hour=new Date(Date.now()-3600000),last=await t.passwordResetChallenge.findFirst({where:{emailKey},orderBy:{createdAt:"desc"}});
  if(last&&last.createdAt.getTime()>Date.now()-60000)return {limited:true};
  if(await t.passwordResetChallenge.count({where:{emailKey,createdAt:{gt:hour}}})>=5||await t.passwordResetChallenge.count({where:{ipKey,createdAt:{gt:hour}}})>=30)return {limited:true};
  const user=await t.user.findUnique({where:{email}}),eligible=!!user&&user.active&&roles.includes(user.role);
  await t.passwordResetChallenge.updateMany({where:{emailKey,used:false},data:{used:true}});
  await t.passwordResetChallenge.create({data:{id,userId:eligible?user!.id:null,emailKey,ipKey,codeHash:digest(id+":"+code),passwordVersion:eligible?version(user!.password):"",expiresAt:new Date(Date.now()+600000)}});
  return {limited:false,user:eligible?user:null};
 });
 if(result.limited)throw new HttpException("Please wait before requesting another code. Requests are limited to protect your account.",429);
 if(result.user){
  void (async()=>{try{
   const test=process.env.NODE_ENV==="test"&&!!process.env.RECOVERY_SMTP_TEST_PORT;
   const transport=nodemailer.createTransport(test?{host:"127.0.0.1",port:Number(process.env.RECOVERY_SMTP_TEST_PORT),secure:false,ignoreTLS:true}:{host:"smtp.gmail.com",port:465,secure:true,auth:{user:process.env.GMAIL_USER,pass:process.env.GMAIL_APP_PASSWORD!.replace(/\s/g,"")},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,logger:false,debug:false});
   await transport.sendMail({from:{name:"TeliCareers",address:process.env.GMAIL_USER!},to:email,subject:"TeliCareers password reset code",text:"Your TeliCareers password reset code is: "+code+"\n\nIt expires in 10 minutes and works once. Never share this code. If you did not request a password reset, ignore this message. Your password has not changed."});
  }catch{
   await base.passwordResetChallenge.update({where:{id},data:{used:true}});
   console.warn("Password reset email delivery failed; challenge invalidated.");
  }})().catch(()=>console.warn("Password reset delivery cleanup failed."));
 }
 // Never reveal whether an account exists, is blocked or has been sent mail.
 return {challengeId:token,message:"If an eligible account exists, a code has been sent to its registered email. Check Inbox and Spam. The code expires in 10 minutes.",resendAfter:60};
}
export async function completeRecovery(body:any){
 if(!recoveryEnabled())throw new ServiceUnavailableException("Password recovery is not available yet.");
 const b=z.object({challengeId:z.string().regex(/^[a-f0-9]{64}$/),code:z.string().regex(/^[0-9]{6}$/),password:z.string().min(8).max(128),confirmPassword:z.string().min(8).max(128)}).refine(v=>v.password===v.confirmPassword,{message:"Passwords do not match",path:["confirmPassword"]}).parse(body);
 const id=version(b.challengeId),salt=randomBytes(16).toString("hex"),hash=salt+":"+scryptSync(b.password,salt,64).toString("hex");
 const success=await base.$transaction(async t=>{
  await t.$queryRawUnsafe('SELECT "id" FROM "PasswordResetChallenge" WHERE "id"=$1 FOR UPDATE',id);
  const c=await t.passwordResetChallenge.findUnique({where:{id}});
  if(!c||c.used||c.attempts>=5||c.expiresAt<new Date())return false;
  const expected=Buffer.from(c.codeHash,"hex"),actual=Buffer.from(digest(id+":"+b.code),"hex"),correct=expected.length===actual.length&&timingSafeEqual(expected,actual);
  // Return failure rather than throw inside the transaction, so attempts persist.
  await t.passwordResetChallenge.update({where:{id},data:{attempts:{increment:1},...(!correct&&c.attempts>=4?{used:true}:{})}});
  if(!correct||!c.userId)return false;
  await t.$queryRawUnsafe('SELECT "id" FROM "User" WHERE "id"=$1 FOR UPDATE',c.userId);
  const user=await t.user.findUnique({where:{id:c.userId}});
  if(!user||!user.active||!roles.includes(user.role)||digest("email:"+user.email.toLowerCase())!==c.emailKey||version(user.password)!==c.passwordVersion)return false;
  await t.user.update({where:{id:user.id},data:{password:hash}});
  await t.session.deleteMany({where:{userId:user.id}});
  await t.passwordResetChallenge.updateMany({where:{userId:user.id,used:false},data:{used:true}});
  await t.audit.create({data:{actorId:user.id,tenantId:user.tenantId,action:"AUTH_PASSWORD_RESET",entityId:user.id,details:{method:"EMAIL_CODE",sessionsRevoked:true}}});
  return true;
 });
 if(!success)throw new BadRequestException("The code is invalid or expired. Request a new code and try again.");
 return {message:"Password updated successfully. Sign in with your new password."};
}

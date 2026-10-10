export const terminalStatuses = [
  "REJECTED",
  "WITHDRAWN",
  "NOT_SELECTED",
  "JOINED",
];
export function canReapply(
  status: string,
  closedAt: Date | null,
  now: Date,
  wait = 30,
) {
  return (
    terminalStatuses.includes(status) &&
    !!closedAt &&
    now.getTime() - closedAt.getTime() >= wait * 86400000
  );
}
export function contactAllowed(
  active: boolean,
  directoryConsent: boolean,
  applicationConsent: boolean,
) {
  return active && (directoryConsent || applicationConsent);
}
export function renewalStart(previousEnd: Date | null, now: Date) {
  return previousEnd && previousEnd > now ? previousEnd : now;
}
export function anonymous(candidate: any) {
  if (candidate.profileReviewed !== true)
    return {
      id: candidate.id,
      displayId: candidate.displayId,
    profession:candidate.profession||"TEACHER",
    ...(candidate.profession==="PHARMACIST"?{pharmacySummary:{registered:candidate.pharmacyDetails?.registered||"Pending",verification:"Declared",workType:candidate.pharmacyDetails?.workType,expectedPay:candidate.pharmacyDetails?.expectedPay},educationResult:candidate.education?.find((e:any)=>e.highest)?.result||candidate.education?.[0]?.result,resultType:candidate.education?.find((e:any)=>e.highest)?.resultType||candidate.education?.[0]?.resultType}:{}),
      subject: "Awaiting profile review",
      qualification: "Awaiting profile review",
      experience: 0,
      location: "Not shared",
      salary: 0,
      jobSeeking: candidate.jobSeeking,
    active: candidate.active,
    };
  return {
    id: candidate.id,
    displayId: candidate.displayId,
    profession:candidate.profession||"TEACHER",
    ...(candidate.profession==="PHARMACIST"?{pharmacySummary:{registered:candidate.pharmacyDetails?.registered||"Pending",verification:"Declared",workType:candidate.pharmacyDetails?.workType,expectedPay:candidate.pharmacyDetails?.expectedPay},educationResult:candidate.education?.find((e:any)=>e.highest)?.result||candidate.education?.[0]?.result,resultType:candidate.education?.find((e:any)=>e.highest)?.resultType||candidate.education?.[0]?.resultType}:{}),
    subject: candidate.subject,
    qualification: candidate.qualification,
    experience: candidate.experience,
    experienceMonths: candidate.personalDetails?.experienceMonths || 0,
    location: candidate.location,
    salary: candidate.salary,
    jobSeeking: candidate.jobSeeking,
    active: candidate.active,
  };
}

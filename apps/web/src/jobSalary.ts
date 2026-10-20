export function jobSalary(job:any){const min=Number(job.salary)||0,max=job.salaryMax??min;return "Rs. "+min.toLocaleString("en-IN")+(max!==min?" - Rs. "+Number(max).toLocaleString("en-IN"):"");}

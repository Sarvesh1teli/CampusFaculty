const fs=require('fs');let p='apps/api/src/database.ts',s=fs.readFileSync(p,'utf8').replace('  "Tenant",','  "CommerceOrder",\n  "Tenant",');fs.writeFileSync(p,s);

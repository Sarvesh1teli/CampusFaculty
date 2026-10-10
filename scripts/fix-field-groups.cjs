const fs=require('fs');const f='apps/web/src/ProfileEditor.tsx';let s=fs.readFileSync(f,'utf8').replaceAll('          [[','          {[[');fs.writeFileSync(f,s);

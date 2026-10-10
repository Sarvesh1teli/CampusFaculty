const fs=require('fs');const p='apps/web/src/ProfileEditor.tsx';let s=fs.readFileSync(p,'utf8').replace('<select value={other?','<select aria-label={label} value={other?');fs.writeFileSync(p,s);

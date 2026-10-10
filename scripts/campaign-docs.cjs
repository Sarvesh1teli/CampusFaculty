const fs=require('fs');let p='REQUIREMENTS.md',s=fs.readFileSync(p,'utf8').replace('### Planned public QR registration (not implemented yet)','### Public QR registration and campaigns').replace('## Teacher profile additions and QR registration','## Teacher profile additions and QR registration');fs.writeFileSync(p,s);fs.appendFileSync('README.md',`

### Campaign QR registration

Super Admin → Campaigns → New campaign: enter a name and unique code, then use QR / View to download the PNG and copy the registration link. Statistics distinguish created accounts from submitted/activated profiles. Deactivation prevents new signups while retaining prior profiles and source history. Campaign signup does not create a job application.

Public route: /teacher-registration?campaign=YOUR-CODE. It creates a teacher account, then reuses the existing profile sections and explicit directory consent. Existing account email/mobile must sign in instead. Approval, activation fees and contact privacy continue to apply.

For cloud builds, set VITE_PUBLIC_URL to the permanent HTTPS frontend domain (for example https://campusfaculty.example). The campaign QR defaults to the current browser origin for local preview; localhost QR codes are not suitable for printed public campaigns. Set WEB_ORIGIN consistently on the backend. No private data is encoded in the QR.
`);fs.writeFileSync('apps/web/.env.example','VITE_PUBLIC_URL=https://your-domain.example\n');p='apps/web/src/WorkflowSettings.tsx';s=fs.readFileSync(p,'utf8').replace('s.key !== "simple_pricing",','s.key !== "simple_pricing" && !s.key.startsWith("campaign:") && !s.key.startsWith("campaign-source:"),');fs.writeFileSync(p,s);

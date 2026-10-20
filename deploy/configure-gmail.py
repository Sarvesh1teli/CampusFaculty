#!/usr/bin/env python3
"""Run interactively on the CampusFaculty server; never pass secrets as arguments."""
import getpass, pathlib, re, secrets, smtplib, ssl, subprocess, os
root=pathlib.Path('/tmp/ubuntu/campus-faculty')
assert pathlib.Path(__file__).resolve().parent==root/'deploy'
file=root/'.deployment/runtime.env'
if not file.exists():raise SystemExit('CampusFaculty environment file missing.')
if not os.isatty(0):raise SystemExit('Run from an interactive terminal. The App Password is entered privately.')
app_password=getpass.getpass('Gmail App Password for telicampuserp@gmail.com (hidden): ').replace(' ','')
if not re.fullmatch(r'[A-Za-z0-9]{16}',app_password):raise SystemExit('Enter the 16-character Gmail App Password, not your normal Gmail password.')
try:
 with smtplib.SMTP_SSL('smtp.gmail.com',465,timeout=15,context=ssl.create_default_context()) as smtp:smtp.login('telicampuserp@gmail.com',app_password)
except Exception:raise SystemExit('Gmail authentication failed. No settings changed. Check 2-Step Verification and the App Password.')
text=file.read_text();current={}
for line in text.splitlines():
 if line and not line.startswith('#') and '=' in line:
  key,value=line.split('=',1);current[key]=value.strip().strip('"').strip("'")
updates={'GMAIL_USER':'telicampuserp@gmail.com','GMAIL_APP_PASSWORD':app_password,'PASSWORD_RESET_SECRET':current.get('PASSWORD_RESET_SECRET') or secrets.token_hex(32),'PASSWORD_RESET_ENABLED':'true'}
backup=root/'.deployment/runtime-before-gmail.env'
if not backup.exists():
 fd=os.open(backup,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(fd,'w') as f:f.write(text)
lines=[line for line in text.splitlines() if line.split('=',1)[0] not in updates and not line.startswith('RECOVERY_SMTP_TEST_PORT=')]
lines += [k+'='+v for k,v in updates.items()]
tmp=file.with_suffix('.gmail.tmp');fd=os.open(tmp,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
with os.fdopen(fd,'w') as f:f.write('\n'.join(lines)+'\n')
os.replace(tmp,file);os.chmod(file,0o600)
subprocess.run(['sudo','systemctl','restart','campusfaculty-api'],check=True)
print('Gmail authenticated and password recovery enabled. Test Forgot password with an account you own. Only CampusFaculty API restarted.')

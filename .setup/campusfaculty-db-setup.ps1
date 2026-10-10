$ErrorActionPreference = 'Stop'
$projectRoot = 'C:\git_project\CampusFaculty'
$databaseDirectory = Join-Path $projectRoot '.local\postgres'
$postgresBin = 'C:\Program Files\PostgreSQL\16\bin'
if (Test-Path -LiteralPath $databaseDirectory) { throw 'Database directory already exists; refusing to initialize over it.' }
New-Item -ItemType Directory -Path (Join-Path $projectRoot '.local') -Force | Out-Null
$passwordBytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Fill($passwordBytes)
$databasePassword = [Convert]::ToHexString($passwordBytes).ToLowerInvariant()
[System.Security.Cryptography.RandomNumberGenerator]::Fill($passwordBytes)
$ownerPassword = [Convert]::ToHexString($passwordBytes).ToLowerInvariant()
$passwordFile = Join-Path $projectRoot '.local\init-password'
[IO.File]::WriteAllText($passwordFile,$databasePassword)
try {
 & (Join-Path $postgresBin 'initdb.exe') '-D' $databaseDirectory '-U' 'campusfaculty' '--auth=scram-sha-256' ('--pwfile=' + $passwordFile) '--encoding=UTF8' '--locale=C'
 if ($LASTEXITCODE -ne 0) { throw 'initdb failed' }
} finally { Remove-Item -LiteralPath $passwordFile -Force }
Add-Content -LiteralPath (Join-Path $databaseDirectory 'postgresql.conf') -Value "`nlisten_addresses = '127.0.0.1'`nport = 55432"
& (Join-Path $postgresBin 'pg_ctl.exe') '-D' $databaseDirectory '-l' (Join-Path $projectRoot '.local\postgres.log') '-w' 'start'
if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL start failed' }
$env:PGPASSWORD = $databasePassword
& (Join-Path $postgresBin 'createdb.exe') '-h' '127.0.0.1' '-p' '55432' '-U' 'campusfaculty' 'campusfaculty'
if ($LASTEXITCODE -ne 0) { throw 'Database creation failed' }
$env:PGPASSWORD = $null
$envText = "DATABASE_URL=postgresql://campusfaculty:${databasePassword}@127.0.0.1:55432/campusfaculty`nPORT=3001`nWEB_ORIGIN=http://localhost:5173`nNODE_ENV=development`nSEED_ADMIN_EMAIL=owner@campusfaculty.local`nSEED_ADMIN_PASSWORD=${ownerPassword}`n"
[IO.File]::WriteAllText((Join-Path $projectRoot 'apps\api\.env'),$envText)
Add-Content -LiteralPath (Join-Path $projectRoot '.gitignore') -Value '.local/'
Write-Output 'Isolated CampusFaculty database started on 127.0.0.1:55432. Local credentials saved in apps/api/.env; not printed.'

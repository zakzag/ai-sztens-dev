# convert-ppk-to-openssh.ps1
#
# Converts the PPK private key committed under deploy/ssh-keys/ to OpenSSH
# format, into ~/.ssh/id_aisztens_krak inside WSL, with 0600 permissions.
#
# Run from PowerShell (no sudo). The script will prompt for the PPK passphrase
# if one is set.

$ErrorActionPreference = 'Stop'

$ppkSrc   = 'E:\projects\AI\2026-08-31-ai-sztens-dev\deploy\ssh-keys\id_aisztens_krak'
$puttygen = 'C:\Progs\PuTTY\puttygen.exe'

if (-not (Test-Path $puttygen)) {
  Write-Host "ERROR: puttygen.exe not found at $puttygen" -ForegroundColor Red
  exit 1
}
if (-not (Test-Path $ppkSrc)) {
  Write-Host "ERROR: PPK not found at $ppkSrc" -ForegroundColor Red
  exit 1
}

# Make sure WSL has ~/.ssh ready and writable.
wsl -e bash -c 'mkdir -p $HOME/.ssh && chmod 700 $HOME/.ssh'

# Convert into a Windows-side temp file first (puttygen is happiest on Win paths).
$tmpOpenssh = Join-Path $env:TEMP ("openssh_" + [guid]::NewGuid().ToString('N') + '.key')
Write-Host "Converting $ppkSrc -> $tmpOpenssh (PuTTYgen will prompt for the passphrase)..."
& $puttygen $ppkSrc -O private-openssh -o $tmpOpenssh
if ($LASTEXITCODE -ne 0) {
  Write-Host "ERROR: puttygen exited with $LASTEXITCODE" -ForegroundColor Red
  exit $LASTEXITCODE
}

# Move the converted key into WSL with strict perms.
$dst = '~/.ssh/id_aisztens_krak'
wsl -e bash -c "cp '$tmpOpenssh' $dst && chmod 600 $dst && ls -la $dst"
Remove-Item $tmpOpenssh -Force

Write-Host "Verifying with ssh-keygen ..."
wsl -e bash -c "ssh-keygen -y -f $dst"

Write-Host "Done. You can now run ./deploy/deploy.sh bootstrap." -ForegroundColor Green

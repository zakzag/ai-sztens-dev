# Local development on Windows: delegate to the cross-platform npm script so the
# APP_ENV=local wiring exists in exactly one place (package.json "dev:local").
# The previous body here — `$env:APP_ENV='local'; pnpm dev` — was correct only
# when run from PowerShell and duplicated a script that had the same line in a
# file npm executes with cmd.exe, where it fails outright.
pnpm dev:local

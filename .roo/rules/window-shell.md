# Windows shell szabályok
- A parancsok PowerShell 7 vagy Windows PowerShell 5.1 alatt futnak. Soha ne használj `cmd /c`-t, és ne feltételezz cmd-szintaxist.
- Egy execute_command hívásban egy parancsot futtass; ne láncolj össze több lépést, hacsak nem szükséges.
- PowerShell szintaxis: `$env:VAR`, `Get-ChildItem`, `Remove-Item`, `Select-String`. Windows PowerShell 5.1 alatt `&&` helyett `;`-t használj.
- Ha egy parancs shell-szintaxis hiba miatt bukik, ne ismételd meg vakon; jelezd a hibát, és javasolj javítást.
- Node-ot a PATH-ból hívd (`node`), ne fixálj verziót a parancsokban.
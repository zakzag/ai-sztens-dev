$tokens = $null
$errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile(
    (Resolve-Path 'scripts/init.ps1').Path,
    [ref]$tokens,
    [ref]$errors
)
if ($errors.Count -eq 0) {
    Write-Host 'OK: powershell syntax valid' -ForegroundColor Green
    Write-Host ('Tokens: {0}, AST type: {1}' -f $tokens.Count, $ast.GetType().Name)
} else {
    Write-Host ('FAIL: {0} parse error(s)' -f $errors.Count) -ForegroundColor Red
    $errors | ForEach-Object {
        Write-Host ('  Line {0}: {1}' -f $_.Extent.StartLineNumber, $_.Message)
    }
    exit 1
}

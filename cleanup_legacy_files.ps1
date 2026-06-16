# SustainChain — Pulizia file legacy drizzle/
# Esegui da PowerShell nella cartella del progetto (tasto destro → "Esegui con PowerShell")

$base = Split-Path -Parent $MyInvocation.MyCommand.Path
$files = @(
    "$base\drizzle\20260510000000_init.sql",
    "$base\drizzle\20260511000000_add_sector_coefficients.sql",
    "$base\drizzle\schema.ts",
    "$base\drizzle\relations.ts"
)

foreach ($f in $files) {
    if (Test-Path $f) {
        Remove-Item $f -Force
        Write-Host "ELIMINATO: $f" -ForegroundColor Green
    } else {
        Write-Host "NON TROVATO (già eliminato?): $f" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Fatto. Ora esegui: git add -A && git commit -m 'chore: remove legacy drizzle snapshot files'" -ForegroundColor Cyan

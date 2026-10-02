# --- CREA PACCHETTO DI DISTRIBUZIONE ---
# Compila start.exe con PyInstaller e lo impacchetta con i file dell'app in:
#   dist\ModellatoreMBSE-<versione>.zip       (zip normale)
#   dist\ModellatoreMBSE-<versione>-setup.exe (zip autoestraente 7-Zip)
# Usato dal workflow .github/workflows/rilascio.yml, si può lanciare anche a mano:
#   powershell -ExecutionPolicy Bypass -File packaging\crea-pacchetto.ps1 -Versione 1.0.0
param(
    [string]$Versione = "dev",
    [string]$SetteZip = "C:\Program Files\7-Zip\7z.exe",
    [switch]$SaltaBuild
)

$ErrorActionPreference = "Stop"
$radice = Split-Path -Parent $PSScriptRoot
Set-Location $radice

$nome = "ModellatoreMBSE"
$dist = Join-Path $radice "dist"
$cartella = Join-Path $dist "pacchetto\$nome"

if (-not $SaltaBuild) {
    pyinstaller --noconfirm --clean start.spec
    if ($LASTEXITCODE -ne 0) { throw "PyInstaller non è riuscito a creare start.exe" }
}
if (-not (Test-Path (Join-Path $dist "start.exe"))) { throw "Manca dist\start.exe" }

# Cartella del pacchetto, ricreata da zero
if (Test-Path (Join-Path $dist "pacchetto")) { Remove-Item -Recurse -Force (Join-Path $dist "pacchetto") }
New-Item -ItemType Directory -Force $cartella | Out-Null

# L'exe serve i file dalla propria cartella (datas=[] in start.spec): servono accanto a lui.
# shared/ e progetti/ restano fuori di proposito: start.exe li crea al primo avvio,
# così un aggiornamento estratto sopra un'installazione non sovrascrive i dati dell'utente.
Copy-Item (Join-Path $dist "start.exe") $cartella
Copy-Item index.html, style.css, settings.json $cartella
Copy-Item -Recurse js $cartella
Remove-Item (Join-Path $cartella "js\AGENTS.md"), (Join-Path $cartella "js\CLAUDE.md") -ErrorAction SilentlyContinue
(Get-Content packaging\LEGGIMI.txt -Raw -Encoding UTF8).Replace("{VERSIONE}", $Versione) |
    Out-File (Join-Path $cartella "LEGGIMI.txt") -Encoding utf8
Set-Content (Join-Path $cartella "VERSIONE.txt") $Versione -Encoding ascii

$zip = Join-Path $dist "$nome-$Versione.zip"
$setup = Join-Path $dist "$nome-$Versione-setup.exe"
Remove-Item $zip, $setup -ErrorAction SilentlyContinue

Compress-Archive -Path $cartella -DestinationPath $zip

# 7z.sfx: modulo autoestraente con finestra che chiede dove estrarre (crea la sottocartella ModellatoreMBSE)
if (-not (Test-Path $SetteZip)) { throw "7-Zip non trovato in $SetteZip" }
$moduloSfx = Join-Path (Split-Path -Parent $SetteZip) "7z.sfx"
& $SetteZip a -t7z -mx=9 "-sfx$moduloSfx" $setup $cartella | Out-Null
if ($LASTEXITCODE -ne 0) { throw "7-Zip non è riuscito a creare l'autoestraente" }

Write-Host "Creati:"
Write-Host "  $zip"
Write-Host "  $setup"

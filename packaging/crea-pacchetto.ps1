# --- CREA PACCHETTO DI DISTRIBUZIONE ---
# Compila start.exe con PyInstaller e lo impacchetta con i file dell'app in:
#   dist\ModellatoreMBSE-<versione>.zip
# Niente autoestraente: un exe con "setup" nel nome fa chiedere a Windows i diritti di amministratore.
# Usato dal workflow .github/workflows/rilascio.yml, si può lanciare anche a mano:
#   powershell -ExecutionPolicy Bypass -File packaging\crea-pacchetto.ps1 -Versione 1.0.0
param(
    [string]$Versione = "dev",
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
Copy-Item (Join-Path $dist "start.exe") $cartella
Copy-Item index.html, style.css $cartella
# settings.json è dell'utente: il pacchetto porta solo i valori di fabbrica, start.exe crea
# settings.json da questi se manca (vedi docs/specs/0013-protezione-dati-aggiornamenti)
Copy-Item settings.json (Join-Path $cartella "settings.predefinite.json")
Copy-Item -Recurse js $cartella
Remove-Item (Join-Path $cartella "js\AGENTS.md"), (Join-Path $cartella "js\CLAUDE.md") -ErrorAction SilentlyContinue
Copy-Item -Recurse packaging\esempi $cartella
(Get-Content packaging\TUTORIAL.md -Raw -Encoding UTF8).Replace("{VERSIONE}", $Versione) |
    Out-File (Join-Path $cartella "TUTORIAL.md") -Encoding utf8
Set-Content (Join-Path $cartella "VERSIONE.txt") $Versione -Encoding ascii

# progetti\ e shared\ entrano vuote: si vedono subito, ma estraendo un aggiornamento sopra
# un'installazione non sovrascrivono i dati dell'utente. start.exe le riempie al primo avvio.
New-Item -ItemType Directory -Force (Join-Path $cartella "progetti"), (Join-Path $cartella "shared") | Out-Null

# Controllo: nessun dato dell'utente nel pacchetto. La lista è PERCORSI_UTENTE di start.py,
# letta da lì perché le due liste non si separino mai.
$rigaPercorsi = Select-String -Path start.py -Pattern "^PERCORSI_UTENTE\s*=\s*\((.*)\)" | Select-Object -First 1
if (-not $rigaPercorsi) { throw "PERCORSI_UTENTE non trovato in start.py" }
$percorsiUtente = [regex]::Matches($rigaPercorsi.Matches[0].Groups[1].Value, "'([^']+)'") | ForEach-Object { $_.Groups[1].Value }
if (-not $percorsiUtente) { throw "PERCORSI_UTENTE in start.py è vuoto o illeggibile" }
foreach ($percorso in $percorsiUtente) {
    $pieno = Join-Path $cartella $percorso
    if (Test-Path $pieno -PathType Leaf) { throw "Il pacchetto contiene $percorso, che è dell'utente" }
    if (Test-Path $pieno -PathType Container) {
        $dentro = Get-ChildItem $pieno -Recurse -Force -File
        if ($dentro) { throw "Il pacchetto contiene file dell'utente in ${percorso}: $($dentro[0].FullName)" }
    }
}
if ((Get-FileHash settings.json).Hash -ne (Get-FileHash (Join-Path $cartella "settings.predefinite.json")).Hash) {
    throw "settings.predefinite.json non è uguale a settings.json del repository"
}

$zip = Join-Path $dist "$nome-$Versione.zip"
Remove-Item $zip -ErrorAction SilentlyContinue

# ZipFile al posto di Compress-Archive, che salta le cartelle vuote
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($cartella, $zip, [System.IO.Compression.CompressionLevel]::Optimal, $true)

Write-Host "Creato: $zip"

param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,

  [string]$OutputDir,

  [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $InputPath)) {
  throw "Input file not found: $InputPath"
}

$resolvedInput = (Resolve-Path -LiteralPath $InputPath).Path
$inputItem = Get-Item -LiteralPath $resolvedInput

if ($inputItem.Extension -ne '.onepkg') {
  throw "Input must be a .onepkg file. Received: $($inputItem.Extension)"
}

if (-not $OutputDir -or [string]::IsNullOrWhiteSpace($OutputDir)) {
  $baseName = [System.IO.Path]::GetFileNameWithoutExtension($inputItem.Name)
  $OutputDir = Join-Path -Path $inputItem.DirectoryName -ChildPath ("$baseName.extracted")
}

if ((Test-Path -LiteralPath $OutputDir) -and -not $Force) {
  throw "Output directory already exists. Use -Force to overwrite: $OutputDir"
}

if (Test-Path -LiteralPath $OutputDir) {
  Remove-Item -LiteralPath $OutputDir -Recurse -Force
}

New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

$expandExe = (Get-Command expand.exe -ErrorAction Stop).Source

& $expandExe '-F:*' $resolvedInput $OutputDir
if ($LASTEXITCODE -ne 0) {
  throw "expand.exe failed with exit code $LASTEXITCODE"
}

$oneFiles = Get-ChildItem -Path $OutputDir -Recurse -File -Filter '*.one' | Sort-Object FullName
$onetoc2Files = Get-ChildItem -Path $OutputDir -Recurse -File -Filter '*.onetoc2' | Sort-Object FullName

$result = [pscustomobject]@{
  InputPath = $resolvedInput
  OutputDir = (Resolve-Path -LiteralPath $OutputDir).Path
  SectionCount = $oneFiles.Count
  TocCount = $onetoc2Files.Count
  SectionFiles = $oneFiles.FullName
}

$result | ConvertTo-Json -Depth 4

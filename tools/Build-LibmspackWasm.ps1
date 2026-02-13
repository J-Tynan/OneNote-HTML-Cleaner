param(
  [string]$EmsdkPath,
  [string]$VendorDir = ".vendor/libmspack",
  [string]$OutDir = "assets/wasm",
  [switch]$Clean
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-EmsdkPath {
  param([string]$Preferred)

  $candidates = @()
  if ($Preferred) { $candidates += $Preferred }
  if ($env:EMSDK) { $candidates += $env:EMSDK }
  $candidates += @(
    (Join-Path $HOME 'emsdk'),
    'C:\emsdk',
    (Join-Path $PSScriptRoot '..\..\emsdk')
  )

  foreach ($candidate in $candidates | Where-Object { $_ -and $_.Trim().Length -gt 0 }) {
    $full = [System.IO.Path]::GetFullPath($candidate)
    $envScript = Join-Path $full 'emsdk_env.ps1'
    if (Test-Path -LiteralPath $envScript) {
      return $full
    }
  }

  return $null
}

function Require-Command {
  param([string]$Name)
  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $command) {
    throw "Required command not found: $Name"
  }
  return $command.Source
}

function Normalize-UnixLineEndings {
  param([string]$FilePath)

  if (-not (Test-Path -LiteralPath $FilePath)) {
    return
  }

  $content = [System.IO.File]::ReadAllText($FilePath)
  $normalized = $content -replace "`r`n", "`n"
  $normalized = $normalized -replace "`r", ""

  if ($normalized -ne $content) {
    [System.IO.File]::WriteAllText($FilePath, $normalized, [System.Text.UTF8Encoding]::new($false))
  }
}

$resolvedEmsdk = Resolve-EmsdkPath -Preferred $EmsdkPath
if (-not $resolvedEmsdk) {
  throw "Could not locate emsdk. Pass -EmsdkPath (folder containing emsdk_env.ps1)."
}

$emsdkEnvScript = Join-Path $resolvedEmsdk 'emsdk_env.ps1'
. $emsdkEnvScript | Out-Null

$emccPath = Require-Command -Name 'emcc'
$emconfigurePath = Require-Command -Name 'emconfigure'
$emmakePath = Require-Command -Name 'emmake'
$gitPath = Require-Command -Name 'git'
$bashCommand = Get-Command bash -ErrorAction SilentlyContinue
$makeCommand = Get-Command make -ErrorAction SilentlyContinue

if (-not $bashCommand -or -not $makeCommand) {
  $missing = @()
  if (-not $bashCommand) { $missing += 'bash' }
  if (-not $makeCommand) { $missing += 'make' }

  $wslScript = Join-Path $PSScriptRoot 'Build-LibmspackWasm-WSL.ps1'
  $wslCommand = Get-Command wsl -ErrorAction SilentlyContinue

  if ($wslCommand -and (Test-Path -LiteralPath $wslScript)) {
    $missingCsv = ($missing -join ', ')
    Write-Host "Missing native POSIX tools: $missingCsv"
    Write-Host "Falling back to WSL build runner..."

    $wslFallbackArgs = @('-ExecutionPolicy', 'Bypass', '-File', $wslScript)
    if ($Clean) {
      $wslFallbackArgs += '-Clean'
    }

    & powershell @wslFallbackArgs
    if ($LASTEXITCODE -ne 0) {
      throw "WSL fallback build failed with exit code $LASTEXITCODE"
    }

    return
  }

  $missingCsv = ($missing -join ', ')
  throw @"
Missing required POSIX build tools: $missingCsv

This script uses autotools (`./configure && make`) under Emscripten.
Install either:
  1) Git Bash + GNU make (MSYS2/MinGW), or
  2) WSL Ubuntu and run the build there.

After installing, re-run:
  npm run build:libmspack:wasm
"@
}

Write-Host "Using emsdk at: $resolvedEmsdk"
Write-Host "emcc: $emccPath"
Write-Host "emconfigure: $emconfigurePath"
Write-Host "emmake: $emmakePath"
Write-Host "git: $gitPath"

$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$vendorRoot = Join-Path $workspaceRoot $VendorDir
$outRoot = Join-Path $workspaceRoot $OutDir

if (-not (Test-Path -LiteralPath $vendorRoot)) {
  New-Item -ItemType Directory -Path $vendorRoot -Force | Out-Null
}

$repoRoot = Join-Path $vendorRoot 'src'
if (-not (Test-Path -LiteralPath $repoRoot)) {
  & $gitPath clone https://github.com/kyz/libmspack.git $repoRoot
  if ($LASTEXITCODE -ne 0) {
    throw "git clone failed with exit code $LASTEXITCODE"
  }
}

$libRoot = Join-Path $repoRoot 'libmspack'
if (-not (Test-Path -LiteralPath $libRoot)) {
  throw "Expected libmspack source at: $libRoot"
}

Push-Location $libRoot
try {
  Normalize-UnixLineEndings -FilePath (Join-Path $libRoot 'autogen.sh')
  Normalize-UnixLineEndings -FilePath (Join-Path $libRoot 'configure.ac')
  Normalize-UnixLineEndings -FilePath (Join-Path $libRoot 'Makefile.am')
  Normalize-UnixLineEndings -FilePath (Join-Path $libRoot 'acinclude.m4')

  if ($Clean) {
    if (Test-Path -LiteralPath '.\\Makefile') {
      & emmake make clean
      if ($LASTEXITCODE -ne 0) {
        throw "emmake make clean failed with exit code $LASTEXITCODE"
      }
    }
  }

  if (-not (Test-Path -LiteralPath '.\\configure')) {
    & bash ./autogen.sh
    if ($LASTEXITCODE -ne 0) {
      throw "autogen failed with exit code $LASTEXITCODE"
    }
  }

  if (-not (Test-Path -LiteralPath '.\\Makefile')) {
    & emconfigure bash ./configure --disable-shared --enable-static

    if ($LASTEXITCODE -ne 0) {
      throw "configure failed with exit code $LASTEXITCODE"
    }
  }

  & emmake make -j4
  if ($LASTEXITCODE -ne 0) {
    throw "make failed with exit code $LASTEXITCODE"
  }

  $staticLib = Join-Path $libRoot '.libs/libmspack.a'
  if (-not (Test-Path -LiteralPath $staticLib)) {
    throw "Expected static library not found: $staticLib"
  }

  if (-not (Test-Path -LiteralPath $outRoot)) {
    New-Item -ItemType Directory -Path $outRoot -Force | Out-Null
  }

  $jsOut = Join-Path $outRoot 'libmspack-core.js'

  & emcc $staticLib \
    -O3 \
    -s MODULARIZE=1 \
    -s EXPORT_ES6=1 \
    -s ENVIRONMENT=web,worker \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s EXPORTED_FUNCTIONS=["_mspack_version"] \
    -s EXPORTED_RUNTIME_METHODS=["ccall","cwrap"] \
    -o $jsOut

  if ($LASTEXITCODE -ne 0) {
    throw "emcc link failed with exit code $LASTEXITCODE"
  }

  $wasmOut = Join-Path $outRoot 'libmspack-core.wasm'
  if (-not (Test-Path -LiteralPath $wasmOut)) {
    throw "WASM output not found: $wasmOut"
  }

  Write-Host "Built artifacts:"
  Write-Host " - $jsOut"
  Write-Host " - $wasmOut"
}
finally {
  Pop-Location
}

param(
  [string]$Distro,
  [string]$WorkspacePath,
  [switch]$Clean,
  [switch]$CheckOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Escape-ForBashSingleQuote {
  param([string]$Value)
  return ($Value -replace "'", '''"''"''')
}

function Convert-WindowsPathToWsl {
  param([string]$Path)

  if (-not $Path) {
    throw "Path is required for WSL conversion."
  }

  $trimmed = $Path.Trim()
  if ($trimmed -match '^[A-Za-z]:\\') {
    $drive = $trimmed.Substring(0, 1).ToLowerInvariant()
    $rest = $trimmed.Substring(3) -replace '\\', '/'
    if ([string]::IsNullOrWhiteSpace($rest)) {
      return "/mnt/$drive"
    }
    return "/mnt/$drive/$rest"
  }

  return $null
}

$wslCommand = Get-Command wsl -ErrorAction SilentlyContinue
if (-not $wslCommand) {
  throw "WSL is not installed or not on PATH. Install WSL first (`wsl --install`), then retry."
}

$wslStatusOutput = ''
try {
  $wslStatusOutput = (& $wslCommand.Source --status 2>&1 | Out-String)
}
catch {
  $wslStatusOutput = ($_ | Out-String)
}
if ($LASTEXITCODE -ne 0 -or $wslStatusOutput -match 'not installed') {
  throw "WSL is not fully installed/enabled yet. Run `wsl --install`, reboot if prompted, then retry."
}

if (-not $WorkspacePath -or [string]::IsNullOrWhiteSpace($WorkspacePath)) {
  $WorkspacePath = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}
else {
  $WorkspacePath = (Resolve-Path $WorkspacePath).Path
}

$workspaceWslPath = Convert-WindowsPathToWsl -Path $WorkspacePath
if (-not $workspaceWslPath) {
  $workspaceEscapedForWslpath = Escape-ForBashSingleQuote $WorkspacePath
  $wslPathArgs = @()
  if ($Distro) {
    $wslPathArgs += @('-d', $Distro)
  }
  $wslPathArgs += @('--', 'bash', '-lc', "wslpath -a '$workspaceEscapedForWslpath'")
  $workspaceWslPath = (& $wslCommand.Source @wslPathArgs 2>$null | Out-String).Trim()
}
if (-not $workspaceWslPath) {
  throw "Could not resolve WSL path for workspace: $WorkspacePath"
}

$workspaceEscaped = Escape-ForBashSingleQuote $workspaceWslPath
$cleanFlag = if ($Clean) { '1' } else { '0' }
$checkOnlyFlag = if ($CheckOnly) { '1' } else { '0' }

$bashScriptTemplate = @'
set -eu
(set -o pipefail) >/dev/null 2>&1 && set -o pipefail || true

WORKSPACE='__WORKSPACE__'
CLEAN='__CLEAN__'
CHECK_ONLY='__CHECK_ONLY__'

if [ -f "$HOME/emsdk/emsdk_env.sh" ]; then
  source "$HOME/emsdk/emsdk_env.sh" >/dev/null
fi

missing=0
for cmd in git emcc emconfigure emmake make bash; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command in WSL: $cmd" >&2
    missing=1
  fi
done

if [ "$missing" -ne 0 ]; then
  echo "Install missing packages/tools in WSL, then retry." >&2
  exit 1
fi

if [ "$CHECK_ONLY" = "1" ]; then
  echo "WSL prerequisites are available."
  exit 0
fi

mkdir -p "$WORKSPACE/.vendor/libmspack"
mkdir -p "$WORKSPACE/assets/wasm"

if [ ! -d "$WORKSPACE/.vendor/libmspack/src" ]; then
  git clone https://github.com/kyz/libmspack.git "$WORKSPACE/.vendor/libmspack/src"
fi

cd "$WORKSPACE/.vendor/libmspack/src/libmspack"

for file in autogen.sh configure.ac Makefile.am acinclude.m4; do
  if [ -f "$file" ]; then
    sed -i 's/\r$//' "$file"
  fi
done

if [ "$CLEAN" = "1" ] && [ -f Makefile ]; then
  emmake make clean || true
  rm -f Makefile
fi

if [ ! -f configure ]; then
  ./autogen.sh
fi

if [ ! -f Makefile ]; then
  emconfigure ./configure --disable-shared --enable-static
fi

emmake make -j"$(nproc)"

if [ ! -f .libs/libmspack.a ]; then
  echo "Expected static library not found: .libs/libmspack.a" >&2
  exit 1
fi

emcc .libs/libmspack.a \
  -O3 \
  -s MODULARIZE=1 \
  -s EXPORT_ES6=1 \
  -s ENVIRONMENT=web,worker \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s EXPORTED_FUNCTIONS=["_mspack_version"] \
  -s EXPORTED_RUNTIME_METHODS=["ccall","cwrap"] \
  -o "$WORKSPACE/assets/wasm/libmspack-core.js"

if [ ! -f "$WORKSPACE/assets/wasm/libmspack-core.wasm" ]; then
  echo "WASM output not found: $WORKSPACE/assets/wasm/libmspack-core.wasm" >&2
  exit 1
fi

echo "Built artifacts:"
echo " - $WORKSPACE/assets/wasm/libmspack-core.js"
echo " - $WORKSPACE/assets/wasm/libmspack-core.wasm"
'@

$bashScript = $bashScriptTemplate.Replace('__WORKSPACE__', $workspaceEscaped).Replace('__CLEAN__', $cleanFlag).Replace('__CHECK_ONLY__', $checkOnlyFlag)
$bashScript = $bashScript -replace "`r`n", "`n"
$bashScript = $bashScript -replace "`r", ""
$bashScriptBytes = [System.Text.Encoding]::UTF8.GetBytes($bashScript)
$bashScriptBase64 = [Convert]::ToBase64String($bashScriptBytes)

$wslRunArgs = @()
if ($Distro) {
  $wslRunArgs += @('-d', $Distro)
}
$wslCommandScript = "printf '%s' '$bashScriptBase64' | base64 -d | bash"
$wslRunArgs += @('--', 'bash', '-lc', $wslCommandScript)

& $wslCommand.Source @wslRunArgs
if ($LASTEXITCODE -ne 0) {
  throw "WSL build failed with exit code $LASTEXITCODE"
}

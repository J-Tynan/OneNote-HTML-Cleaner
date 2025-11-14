# Pause the script at launch to prompt user if they want to proceed
Write-Host "This script runs CleanOneNoteHTML to tidy up messy exported HTML and save the output within a subfolder."
Write-Host "If you do not want to run this script, please close this window."
Read-Host -Prompt "Press any key to continue..."

<#
 OneNote Export Cleaner – Main Script (Phases 1–5) + OK log level
 - Phase 1: Core workflow (config, picker, HTML cleanup, CSS injection)
 - Phase 2: Logging + summary (script-scoped persistence, OK level)
 - Phase 3: Robust MHT parsing (MIME, quoted-printable)
 - Phase 4: Image handling (multi-encoding, base64 embedding, tolerant collector)
 - Phase 5: CSS - Auto-create external responsive.css with advanced mobile styles
#>

# =========================
# CONFIG SECTION
# =========================
$Config = @{
    OutputFolder			= "Cleaned"				# Name of the folder where cleaned files are saved
    InjectCSS				= $true					# Injects a `<meta viewport>` tag and CSS reference into HTML
    CSSFile					= "responsive.css"		# External stylesheet linked into cleaned HTML
    AddLineBreaks			= $true					# Add line breaks between tags for readability
    LogFile					= $true					# Save timestamped log file at end
    DecodeImages			= $true					# Embed images as base64 data URIs
    InlineCSSInsteadOfLink	= $false				# Optionally inline a simple responsive CSS block
    DebugDumpParts			= $false				# Write each MIME part to DebugParts folder if needed
	UseAdvancedCSS			= $true					# If true, use extended responsive CSS rules
	LangCode				= "en"					# Language code for <html lang="...">
	RepairListItemValues	= "mergeStyled"			# Options: "off", "renumber", "merge", "mergeStyled"
}

# Optional inline CSS block (if InlineCSSInsteadOfLink = $true)
$ResponsiveInlineCss = @"
:root {
  --font-body: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Consolas, Menlo, monospace;
  --text: #222;
  --muted: #666;
  --link: #2E75B5;
  --bg: #fff;
  --border: #ddd;
}

html { font-size: 16px; }
body {
  margin: 1rem;
  font-family: var(--font-body);
  line-height: 1.6;
  color: var(--text);
  background: var(--bg);
}

/* 1. OneNote/Word quirks cleanup */
[style*="mso-"] { all: unset; }
img[width], img[height] {
  height: auto !important;
  max-width: 100% !important;
}

/* 2. Typography polish */
h1 { font-size: 2rem; margin: 1.5rem 0 1rem; }
h2 { font-size: 1.6rem; margin: 1.25rem 0 .75rem; }
h3 { font-size: 1.3rem; margin: 1rem 0 .5rem; }
p, li { line-height: 1.6; }

/* 3. Code and preformatted blocks */
pre, code {
  font-family: var(--font-mono);
  background: #f8f8f8;
  border-radius: 4px;
  padding: .25rem .5rem;
}
pre {
  overflow-x: auto;
  padding: .75rem;
  border: 1px solid var(--border);
}

/* 4. Print-friendly styles */
@media print {
  body { color: black; background: white; }
  a::after { content: " (" attr(href) ")"; font-size: 90%; }
  nav, footer { display: none; }
}

/* 5. Container for readability */
.container { max-width: 72ch; margin: 0 auto; padding: 0 1rem; }

/* 6. Accessibility & responsiveness */
a { color: var(--link); word-break: break-word; }
a:focus, a:hover { outline: 2px dashed var(--link); outline-offset: 2px; }
small, .muted { color: var(--muted); }

@media (max-width: 768px) {
  html { font-size: 17px; }
  body { margin: .75rem; }
  h1 { font-size: 1.6rem; }
  h2 { font-size: 1.35rem; }
  h3 { font-size: 1.2rem; }
  table { font-size: .95rem; }
}

@media (prefers-color-scheme: dark) {
  :root {
    --text: #e6e6e6;
    --muted: #aaa;
    --bg: #121212;
    --border: #2a2a2a;
    --link: #7bb6ff;
  }
  pre { background: #1a1a1a; }
  th, td { border-color: var(--border); }
}
"@

# Stripped‑down stylesheet that just ensures the basics: viewport scaling, body font, and responsive images/tables.
$MinimalCss = @"
:root {
  --font-body: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
}

html { font-size: 16px; }
body {
  margin: 1rem;
  font-family: var(--font-body);
  line-height: 1.5;
  color: #222;
  background: #fff;
}

img, video, canvas, svg {
  max-width: 100%;
  height: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}
"@

# =========================
# LOGGING SETUP
# =========================
Set-Variable -Name LogEntries -Value @() -Scope Script
$Timestamp  = Get-Date -Format "yyyyMMdd_HHmmss"
$LogPath    = Join-Path -Path (Get-Location) -ChildPath "Log_$Timestamp.txt"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $time = Get-Date -Format "HH:mm:ss"
    $entry = "[$time][$Level] $Message"
    $script:LogEntries += $entry
    switch ($Level) {
        " OK "  { Write-Host $entry -ForegroundColor Green }
        "INFO"  { Write-Host $entry -ForegroundColor White }
        "WARN"  { Write-Host $entry -ForegroundColor Yellow }
        "ERROR" { Write-Host $entry -ForegroundColor Red }
        default { Write-Host $entry }
    }
}

# =========================
# FILE PICKER
# =========================
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Filter = "Web Archives|*.mht;*.mhtml;*.htm;*.html"
$dialog.Multiselect = $true

if ($dialog.ShowDialog() -ne " OK ") {
    Write-Log "No files selected. Exiting." "WARN"
    exit
}

$Files = $dialog.FileNames
Write-Log "Selected $($Files.Count) file(s)." "INFO"

# =========================
# HELPERS: Common utilities
# =========================

function Ensure-OutputFolder {
    if (-not (Test-Path $Config.OutputFolder)) {
        New-Item -ItemType Directory -Path $Config.OutputFolder | Out-Null
    }
}

function Repair-ListItemValues {
    param(
        [string]$Html,
        [string]$Mode = "mergeStyled"  # Options: off, renumber, merge, mergeStyled
    )

    if ($Mode -eq "off") {
        return $Html
    }

    # --- MERGE-STYLED MODE: merge <ol> blocks inside <td> and preserve all original attributes/styles ---
    if ($Mode -eq "mergeStyled") {
        $Html = [System.Text.RegularExpressions.Regex]::Replace($Html,
            '(?is)<td[^>]*>(.*?)</td>',
            {
                param($m)
                $cellContent = $m.Groups[1].Value

                # Find all <ol> blocks in this cell
                $olMatches = [System.Text.RegularExpressions.Regex]::Matches($cellContent, '(?is)<ol([^>]*)>(.*?)</ol>')
                if ($olMatches.Count -le 1) { return $m.Value }

                # Extract all <li> items across those <ol>s
                $liMatches = [System.Text.RegularExpressions.Regex]::Matches($cellContent, '(?is)<li([^>]*)>(.*?)</li>')
                if ($liMatches.Count -eq 0) { return $m.Value }

                # Use the first <ol>'s attributes and styles as the container
                $firstOlAttrs = $olMatches[0].Groups[1].Value

                # Rebuild merged <li> list, preserving all original attributes/styles
                $counter = 0
                $rebuiltLis = foreach ($li in $liMatches) {
                    $liAttrs = $li.Groups[1].Value
                    $content = $li.Groups[2].Value
                    $counter++
                    # Keep original attributes, just enforce correct sequential value=
                    "<li value='$counter'$liAttrs>$content</li>"
                }

                $rebuiltOl = "<ol$firstOlAttrs>`r`n$($rebuiltLis -join "`r`n")`r`n</ol>"
                return "<td>$rebuiltOl</td>"
            })
    }

    # --- RENUMBER MODE (also runs after mergeStyled) ---
    $Html = [System.Text.RegularExpressions.Regex]::Replace($Html, '(?is)<ol([^>]*)>(.*?)</ol>', {
        param($m)
        $attrs = $m.Groups[1].Value
        $inner = $m.Groups[2].Value

        $liMatches = [System.Text.RegularExpressions.Regex]::Matches($inner, '(?is)<li([^>]*)>(.*?)</li>')
        if ($liMatches.Count -eq 0) { return $m.Value }

        $allOnes = $true
        foreach ($li in $liMatches) {
            if ($li.Groups[1].Value -match 'value\s*=\s*["'']?(\d+)["'']?') {
                if ($matches[1] -ne '1') { $allOnes = $false; break }
            } else {
                $allOnes = $false; break
            }
        }

        $counter = 0
        $rebuiltLis = foreach ($li in $liMatches) {
            $liAttrs = $li.Groups[1].Value
            $content = $li.Groups[2].Value

            if (-not $allOnes -and $liAttrs -match 'value\s*=\s*["'']?(\d+)["'']?') {
                $num = [int]$matches[1]
                $counter = $num
                "<li value='$num'$liAttrs>$content</li>"
            } else {
                $counter++
                "<li value='$counter'$liAttrs>$content</li>"
            }
        }

        return "<ol$attrs>`r`n$($rebuiltLis -join "`r`n")`r`n</ol>"
    })

    return $Html
}

function Clean-LiAttributes {
    param([string]$Html)

    # Process each <ol> block separately
    $Html = [System.Text.RegularExpressions.Regex]::Replace($Html, '(?is)<ol([^>]*)>(.*?)</ol>', {
        param($m)
        $olAttrs = $m.Groups[1].Value
        $inner   = $m.Groups[2].Value

        # Find all <li> items
        $liMatches = [System.Text.RegularExpressions.Regex]::Matches($inner, '(?is)<li([^>]*)>(.*?)</li>')
        if ($liMatches.Count -eq 0) { return $m.Value }

        $counter = 0
        $rebuiltLis = foreach ($li in $liMatches) {
            $liAttrs = $li.Groups[1].Value
            $content = $li.Groups[2].Value

            # Remove any stray "value" fragments that aren't valid numbers
            $liAttrs = [System.Text.RegularExpressions.Regex]::Replace($liAttrs, "value[^=]*(['""])?[^'"">\s]*(['""])?", "")

            # Check if a valid numeric value= exists
            if ($liAttrs -match 'value\s*=\s*["'']?(\d+)["'']?') {
                $num = [int]$matches[1]
                $counter = $num
                "<li value='$num'$liAttrs>$content</li>"
            } else {
                # Auto‑repair: assign sequential number
                $counter++
                "<li value='$counter'$liAttrs>$content</li>"
            }
        }

        return "<ol$olAttrs>`r`n$($rebuiltLis -join "`r`n")`r`n</ol>"
    })

    return $Html
}

function Remove-RedundantUlWrappers {
    param([string]$Html)

    # Replace any <ul> that directly wraps an <ol> with just the <ol> content
    $pattern = '<ul[^>]*>\s*(<ol[^>]*>.*?</ol>)\s*</ul>'
    $options = [System.Text.RegularExpressions.RegexOptions]::Singleline -bor `
               [System.Text.RegularExpressions.RegexOptions]::IgnoreCase

    $Html = [regex]::Replace($Html, $pattern, '$1', $options)

    return $Html
}

function Sanitize-LiValues {
    param([string]$Html)

    $Html = [regex]::Replace($Html, '(?i)<li([^>]*)>', {
        param($m)
        $attrs = $m.Groups[1].Value

        # If there's a value= attribute, normalise it to digits only
        if ($attrs -match 'value\s*=\s*["'']?(\d+)["'']?') {
            $num = [int]$matches[1]
            # Strip any existing value= and re‑insert cleanly
            $attrs = [regex]::Replace($attrs, 'value\s*=\s*["'']?[^"''\s>]+["'']?', '')
            return "<li value='$num'$attrs>"
        } else {
            return "<li$attrs>"
        }
    })

    return $Html
}

function Repair-ListItemValuesSmart {
    param([string]$Html)

    # Process each <ol> block separately
    $Html = [regex]::Replace($Html, '(?is)<ol([^>]*)>(.*?)</ol>', {
        param($m)

        $olAttrs = $m.Groups[1].Value
        $inner   = $m.Groups[2].Value

        $liMatches = [regex]::Matches($inner, '(?is)<li([^>]*)>(.*?)</li>')
        if ($liMatches.Count -eq 0) { return $m.Value }

        $counter = 0
        $rebuiltLis = foreach ($li in $liMatches) {
            $liAttrs = $li.Groups[1].Value
            $content = $li.Groups[2].Value

            # Remove stray control characters
            $liAttrs = [regex]::Replace($liAttrs, '[\x00-\x1F]', '')

            # Remove any existing or broken value= fragments (including bare "value")
            $liAttrs = [regex]::Replace($liAttrs, '\bvalue(\s*=\s*[^ >]*)?', '', 'IgnoreCase')

            # Assign clean sequential numbering
            $counter++
            "<li value=$counter$liAttrs>$content</li>"
        }

        "<ol$olAttrs>`r`n$($rebuiltLis -join "`r`n")`r`n</ol>"
    })

    return $Html
}

function Sanitize-ImageAttributes {
    param([string]$Html)

    # Quote numeric width/height and strip stray control characters
    $Html = [System.Text.RegularExpressions.Regex]::Replace($Html, 'width\s*=\s*([0-9]+)', 'width="$1"')
    $Html = [System.Text.RegularExpressions.Regex]::Replace($Html, 'height\s*=\s*([0-9]+)', 'height="$1"')
    $Html = [System.Text.RegularExpressions.Regex]::Replace($Html, '[\x00-\x1F]', '')

    return $Html
}

function Remove-EmptyImageDimensions {
    param([string]$Html)

    # Case 1: Bare attributes (e.g., "width height" with no "=...")
    $Html = [regex]::Replace($Html, '\swidth\b(?!\s*=)', '', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    $Html = [regex]::Replace($Html, '\sheight\b(?!\s*=)', '', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)

    # Case 2: Empty or whitespace-only values (width="", width=' ', width=   )
    $Html = [regex]::Replace($Html, '\swidth\s*=\s*(?:"\s*"|''\s*''|\s*)', '', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    $Html = [regex]::Replace($Html, '\sheight\s*=\s*(?:"\s*"|''\s*''|\s*)', '', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)

    # Case 3: Control-character junk values (e.g., width=\x16)
    $Html = [regex]::Replace($Html, '\swidth\s*=\s*[\x00-\x1F]+', '', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    $Html = [regex]::Replace($Html, '\sheight\s*=\s*[\x00-\x1F]+', '', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)

    return $Html
}

function Ensure-ResponsiveCss {
    $cssPath = Join-Path $Config.OutputFolder $Config.CSSFile
    if (-not (Test-Path $cssPath)) {
        if ($Config.UseAdvancedCSS) {
            $cssContent = $ResponsiveInlineCss   # advanced rules
        } else {
            $cssContent = $MinimalCss            # baseline rules
        }
        $cssContent | Set-Content -Path $cssPath -Encoding UTF8
        Write-Log "Created starter CSS file at $cssPath" " OK "
    }
}

$cssInlineTag = if ($Config.UseAdvancedCSS) {
    "<style>$ResponsiveInlineCss</style>"
} else {
    "<style>$MinimalCss</style>"
}

function Ensure-ResponsiveCss {
    $cssPath = Join-Path $Config.OutputFolder $Config.CSSFile
    if (-not (Test-Path $cssPath)) {
        @"
:root {
  --font-body: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Consolas, Menlo, monospace;
  --text: #222;
  --muted: #666;
  --link: #2E75B5;
  --bg: #fff;
  --border: #ddd;
}

html { font-size: 16px; }
body {
  margin: 1rem;
  font-family: var(--font-body);
  line-height: 1.6;
  color: var(--text);
  background: var(--bg);
}

/* 1. OneNote/Word quirks cleanup */
[style*="mso-"] { all: unset; }
img[width], img[height] {
  height: auto !important;
  max-width: 100% !important;
}

/* 2. Typography polish */
h1 { font-size: 2rem; margin: 1.5rem 0 1rem; }
h2 { font-size: 1.6rem; margin: 1.25rem 0 .75rem; }
h3 { font-size: 1.3rem; margin: 1rem 0 .5rem; }
p, li { line-height: 1.6; }

/* 3. Code and preformatted blocks */
pre, code {
  font-family: var(--font-mono);
  background: #f8f8f8;
  border-radius: 4px;
  padding: .25rem .5rem;
}
pre {
  overflow-x: auto;
  padding: .75rem;
  border: 1px solid var(--border);
}

/* 4. Print-friendly styles */
@media print {
  body { color: black; background: white; }
  a::after { content: " (" attr(href) ")"; font-size: 90%; }
  nav, footer { display: none; }
}

/* 5. Container for readability */
.container { max-width: 72ch; margin: 0 auto; padding: 0 1rem; }

/* 6. Accessibility & responsiveness */
a { color: var(--link); word-break: break-word; }
a:focus, a:hover { outline: 2px dashed var(--link); outline-offset: 2px; }
small, .muted { color: var(--muted); }

@media (max-width: 768px) {
  html { font-size: 17px; }
  body { margin: .75rem; }
  h1 { font-size: 1.6rem; }
  h2 { font-size: 1.35rem; }
  h3 { font-size: 1.2rem; }
  table { font-size: .95rem; }
}

@media (prefers-color-scheme: dark) {
  :root {
    --text: #e6e6e6;
    --muted: #aaa;
    --bg: #121212;
    --border: #2a2a2a;
    --link: #7bb6ff;
  }
  pre { background: #1a1a1a; }
  th, td { border-color: var(--border); }
}
"@ | Set-Content -Path $cssPath -Encoding UTF8
        Write-Log "Created starter CSS file at $cssPath" " OK "
    }
}

function Inject-HeadContent {
    param(
        [string]$Html,
        [string]$CssHref,
        [bool]$InlineCss
    )
    if ($Html -notmatch "(?i)<head") {
        $Html = $Html -replace "(?i)<html[^>]*>", "$0`r`n<head></head>"
        Write-Log "Inserted missing <head> element" " OK "
    }

    $viewport = "<meta name='viewport' content='width=device-width, initial-scale=1.0'>"
    $cssLink  = "<link rel='stylesheet' href='$CssHref'>"
    $cssInlineTag = if ($Config.UseAdvancedCSS) {
		"<style>$ResponsiveInlineCss</style>"
	} else {
		"<style>$MinimalCss</style>"
	}


    $inject = if ($InlineCss) { "$viewport`r`n$cssInlineTag" } else { "$viewport`r`n$cssLink" }

    $Html = $Html -replace "(?i)(<head[^>]*>)", "`$1`r`n$inject"
    Write-Log "Injected viewport and CSS reference" " OK "
    return $Html
}

function Add-LineBreaks {
    param([string]$Html)
    $Html -replace ">\s*<", ">`r`n<"
}

function Clean-HtmlHead {
    param([string]$Html)

    # Extract the original <title> text if present
    $titleMatch = [regex]::Match($Html, '(?is)<title>(.*?)</title>')
    $titleText  = if ($titleMatch.Success) { $titleMatch.Groups[1].Value.Trim() } else { "Document" }

    # Regex to capture the <head>...</head> block
    $pattern = '(?is)(<head.*?>)(.*?)(</head>)'

    $Html = [regex]::Replace($Html, $pattern, {
        param($m)

        $headOpen  = $m.Groups[1].Value
        $headClose = $m.Groups[3].Value

        # Build a clean head block with preserved title
        $cleanHead = @"
$headOpen
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>$titleText</title>
  <link rel="stylesheet" href="responsive.css">
$headClose
"@

        return $cleanHead
    })

    return $Html
}

# =========================
# PHASE 3: MHT parsing helpers
# =========================

function Decode-QuotedPrintable {
    param([string]$Text)
    $t = $Text -replace "=\r?\n",""
    $t = $t -replace "=3D","="
    $t = [regex]::Replace($t, "=([0-9A-Fa-f]{2})", {
        try { [char][byte]("0x" + $args[0].Groups[1].Value) } catch { "" }
    })
    return $t
}

function Parse-Mht {
    param([string]$FilePath)

    $raw  = [System.IO.File]::ReadAllBytes($FilePath)
    $text = [System.Text.Encoding]::UTF8.GetString($raw)

    $boundaryMatch = [regex]::Match($text, 'boundary="([^"]+)"', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if (-not $boundaryMatch.Success) {
        Write-Log "No MIME boundary found in $FilePath" "ERROR"
        return $null
    }
    $boundary = $boundaryMatch.Groups[1].Value
    Write-Log "Detected MIME boundary: $boundary" "INFO"

    $parts = $text -split ("--" + [regex]::Escape($boundary))
    Write-Log "Found $($parts.Count) MIME parts" "INFO"

    if ($Config.DebugDumpParts) {
        Ensure-OutputFolder
        $dbgDir = Join-Path $Config.OutputFolder "DebugParts"
        if (-not (Test-Path $dbgDir)) { New-Item -ItemType Directory -Path $dbgDir | Out-Null }
        for ($i=0; $i -lt $parts.Count; $i++) {
            $pOut = Join-Path $dbgDir ("part_" + $i.ToString("00") + ".txt")
            Set-Content -Path $pOut -Value $parts[$i] -Encoding UTF8
        }
        Write-Log "Dumped MIME parts to $dbgDir" " OK "
    }

    $parsedParts = @()
    foreach ($part in $parts) {
        $partTrim = $part.Trim()
        if ([string]::IsNullOrWhiteSpace($partTrim)) { continue }

        $splitIndex = $partTrim.IndexOf("`r`n`r`n")
        if ($splitIndex -lt 0) { $splitIndex = $partTrim.IndexOf("`n`n") }
        if ($splitIndex -lt 0) {
            $headers = ""
            $body    = $partTrim
        } else {
            $headers = $partTrim.Substring(0, $splitIndex)
            $body    = $partTrim.Substring($splitIndex).Trim()
        }

        $ct  = ([regex]::Match($headers, "(?i)Content-Type:\s*(.+)")).Groups[1].Value.Trim()
        $cl  = ([regex]::Match($headers, "(?i)Content-Location:\s*(.+)")).Groups[1].Value.Trim()
        $cte = ([regex]::Match($headers, "(?i)Content-Transfer-Encoding:\s*(.+)")).Groups[1].Value.Trim()

        if ($cte -match "(?i)quoted-printable") {
            $body = Decode-QuotedPrintable $body
        }

        $parsedParts += [pscustomobject]@{
            ContentType             = $ct
            ContentLocation         = $cl
            ContentTransferEncoding = $cte
            Headers                 = $headers
            Body                    = $body
        }
    }

    $htmlPart = $parsedParts | Where-Object { $_.ContentType -match "(?i)text/html" } | Select-Object -First 1
    if (-not $htmlPart) {
        Write-Log "No HTML part found in $FilePath" "ERROR"
        return $null
    }

    $html = $htmlPart.Body
    Write-Log ("Extracted HTML block length: {0} chars" -f $html.Length) " OK "

    return [pscustomobject]@{
        Html     = $html
        Parts    = $parsedParts
        Boundary = $boundary
    }
}

# =========================
# PHASE 4: Image embedding helpers
# =========================

function Normalize-Base64 {
    param([string]$B64)
    if ([string]::IsNullOrWhiteSpace($B64)) { return $null }
    $clean = ($B64 -replace "\s","").Trim()
    $pad = $clean.Length % 4
    if ($pad -ne 0) { $clean = $clean + ("=" * (4 - $pad)) }
    return $clean
}

function Get-DataUriPrefix {
    param([string]$ContentType)
    $ct = if ($ContentType) { $ContentType.Trim() } else { "application/octet-stream" }
    "data:$ct;base64,"
}

function Expand-ImageKeys {
    param([string]$ContentLocation)
    $keys = @()
    if ([string]::IsNullOrWhiteSpace($ContentLocation)) { return $keys }

    $orig = $ContentLocation
    $keys += $orig

    $noScheme = ($orig -replace '(?i)^file:///', '')
    if ($noScheme -ne $orig) { $keys += $noScheme }

    $relPath = ($noScheme -replace '^[A-Za-z]:/[^/]+/', '')
    if ($relPath -and $relPath -ne $noScheme) { $keys += $relPath }

    try {
        $fileName = [System.IO.Path]::GetFileName($orig)
        if ($fileName) { $keys += $fileName }
    } catch {}

    if ($fileName) {
        $keys += ("cid:" + $fileName)
        $keys += ("cid:" + $fileName + "@")
    }

    $keys | Select-Object -Unique
}

function Build-ImageMap-FromMhtParts {
    param($Parts)

    $map = @{}
    foreach ($p in $Parts) {
        if ($p.ContentType -match "(?i)image/|font/|application/octet-stream") {
            $body = $p.Body
            $bytes = $null

            if ($p.ContentTransferEncoding -match "(?i)base64") {
                $b64 = Normalize-Base64 $body
                try { $bytes = [Convert]::FromBase64String($b64) } catch { $bytes = $null }
            }
            elseif ($p.ContentTransferEncoding -match "(?i)quoted-printable") {
                $b64 = Normalize-Base64 $body
                try { $bytes = [Convert]::FromBase64String($b64) } catch { $bytes = [System.Text.Encoding]::UTF8.GetBytes($body) }
            }
            else {
                $b64 = Normalize-Base64 $body
                try { $bytes = [Convert]::FromBase64String($b64) } catch { $bytes = [System.Text.Encoding]::UTF8.GetBytes($body) }
            }

            if ($bytes -ne $null -and $bytes.Length -gt 0) {
                $prefix = Get-DataUriPrefix $p.ContentType
                $dataUri = $prefix + [Convert]::ToBase64String($bytes)
                $keys = Expand-ImageKeys $p.ContentLocation
                if (-not $keys -or $keys.Count -eq 0) { $keys = @($p.ContentLocation, $p.Headers) }

                foreach ($k in $keys) {
                    if (-not [string]::IsNullOrWhiteSpace($k)) {
                        $map[$k] = $dataUri
                    }
                }
            }
        }
    }
    Write-Log ("Built image map entries (MHT): {0}" -f $map.Keys.Count) " OK "
    $map
}

function Build-ImageMap-FromDisk {
    param(
        [string]$HtmlFilePath,
        [string]$HtmlContent
    )
    $map = @{}
    $dir = Split-Path -Parent $HtmlFilePath

    $matches = [regex]::Matches($HtmlContent, "(?i)src\s*=\s*[""']([^""']+)[""']")
    foreach ($m in $matches) {
        $src = $m.Groups[1].Value
        if ($src -match "^(data:|cid:)") { continue }
        $path = if ([System.IO.Path]::IsPathRooted($src)) { $src } else { Join-Path $dir $src }
        if (Test-Path $path) {
            try {
                $bytes = [System.IO.File]::ReadAllBytes($path)
                $extName = ([System.IO.Path]::GetFileName($path)).ToLower()
                $ct = switch -regex ($extName) {
                    '.*\.png$'  { "image/png"; break }
                    '.*\.jpe?g$'{ "image/jpeg"; break }
                    '.*\.gif$'  { "image/gif"; break }
                    '.*\.svg$'  { "image/svg+xml"; break }
                    default     { "application/octet-stream" }
                }
                $prefix = Get-DataUriPrefix $ct
                $map[$src] = $prefix + [Convert]::ToBase64String($bytes)
            } catch {
                Write-Log "Failed to read image from disk: $path ($_)" "WARN"
            }
        }
    }
    Write-Log ("Built image map entries (disk): {0}" -f $map.Keys.Count) " OK "
    $map
}

function Normalize-Whitespace {
    param([string]$Html)

    # Collapse multiple spaces anywhere
    $Html = [regex]::Replace($Html, ' {2,}', ' ')

    # Collapse multiple blank lines
    $Html = [regex]::Replace($Html, '(\r?\n){2,}', "`r`n")

    # Trim spaces right before closing double quotes in attributes
    $Html = [regex]::Replace($Html, '\s+"', '"')

    # Trim spaces right before closing single quotes in attributes
    $Html = [regex]::Replace($Html, '\s+''', "'")

    # Tidy extra spaces after colon/semicolon inside style attributes
    $Html = [regex]::Replace($Html, '(?<=:)\s{2,}', ' ')
    $Html = [regex]::Replace($Html, '(?<=;)\s{2,}', ' ')

    return $Html
}

function Embed-Images-InHtml {
    param(
        [string]$Html,
        $Map
    )
    if (-not $Map) { return $Html }

    $replacements = 0
    foreach ($key in $Map.Keys) {
        if ([string]::IsNullOrWhiteSpace($key)) { continue }
        $escapedKey = [regex]::Escape($key)

        $before = $Html
        $Html = [regex]::Replace($Html, "(?i)(src\s*=\s*[""'])$escapedKey([""'])", {
            param($m)
            $pre = $m.Groups[1].Value
            $post = $m.Groups[2].Value
            "$pre$($Map[$key])$post"
        })
        if ($Html -ne $before) { $replacements++ }

        $before = $Html
        $Html = [regex]::Replace($Html, "(?i)(href\s*=\s*[""'])$escapedKey([""'])", {
            param($m)
            $pre = $m.Groups[1].Value
            $post = $m.Groups[2].Value
            "$pre$($Map[$key])$post"
        })
        if ($Html -ne $before) { $replacements++ }
    }

    Write-Log ("Embedded images: {0} replacements" -f $replacements) " OK "
    $Html
}

# =========================
# MAIN PROCESSING LOOP (Phases 1–4)
# =========================
$Processed = 0; $Skipped = 0; $Errors = 0
Ensure-OutputFolder
Ensure-ResponsiveCss

foreach ($file in $Files) {
    try {
        Write-Log "Processing: $file" "INFO"

        $ext = [IO.Path]::GetExtension($file).ToLower()
        $html = $null
        $imageMap = $null

        if ($ext -in @(".htm",".html")) {
            $html = Get-Content -Path $file -Raw -Encoding UTF8
            if ($Config.DecodeImages) {
                $imageMap = Build-ImageMap-FromDisk -HtmlFilePath $file -HtmlContent $html
            }
        }
        elseif ($ext -in @(".mht",".mhtml")) {
            $parsed = Parse-Mht -FilePath $file
            if ($parsed -eq $null) { $Skipped++; continue }
            $html = $parsed.Html
            if ($Config.DecodeImages) {
                $imageMap = Build-ImageMap-FromMhtParts -Parts $parsed.Parts
            }
        } else {
            Write-Log "Unsupported extension: $ext" "WARN"
            $Skipped++
            continue
        }

        if (-not $html) { $Skipped++; continue }

		# Clean the <head> section, preserving original title
		$html = Clean-HtmlHead -Html $html

        # Ensure <!DOCTYPE html> is present
        if ($html -notmatch "(?i)<!DOCTYPE") {
            $html = "<!DOCTYPE html>`r`n" + $html
            Write-Log "Inserted <!DOCTYPE html> for standards mode" " OK "
        }

        # Ensure <html> has a lang attribute
		if ($html -match "(?i)<html(?![^>]*\blang=)") {
			$lang = $Config.LangCode
			$html = $html -replace "(?i)<html([^>]*)>", "<html lang='$lang'$1>"
			Write-Log "Inserted lang='$lang' attribute into <html>" " OK "
		}

        # Ensure <title> exists inside <head>
        if ($html -notmatch "(?i)<title>") {
            $fileTitle = [System.IO.Path]::GetFileNameWithoutExtension($file)
            $html = $html -replace "(?i)(<head[^>]*>)", "`$1`r`n<title>$fileTitle</title>"
            Write-Log "Inserted <title>$fileTitle</title>" " OK "
        }

        if ($Config.InjectCSS) {
            $html = Inject-HeadContent -Html $html -CssHref $Config.CSSFile -InlineCss $Config.InlineCSSInsteadOfLink
        }

        if ($Config.DecodeImages -and $imageMap -and $imageMap.Keys.Count -gt 0) {
            $html = Embed-Images-InHtml -Html $html -Map $imageMap
        }

		# Existing repair (merge/renumber/styled), then smart cleanup
		if ($Config.RepairListValues -in @("renumber","merge","mergeStyled")) {
			$html = Repair-ListItemValues -Html $html -Mode $Config.RepairListValues
			$html = Repair-ListItemValuesSmart -Html $html
		}
		
		# Strip redundant <ul> wrappers
		$html = Remove-RedundantUlWrappers -Html $html

		# Image attribute cleanup near the end (before writing output)
		$html = Sanitize-ImageAttributes -Html $html
		$html = Remove-EmptyImageDimensions -Html $html

		# Whitespace normaliser pass before saving
		$html = Normalize-Whitespace -Html $html
	
		# Add a line‑break pass before saving
		$html = Add-LineBreaks -Html $html

        $outFile = Join-Path $Config.OutputFolder ([IO.Path]::GetFileNameWithoutExtension($file) + "_cleaned.html")
        Set-Content -Path $outFile -Value $html -Encoding UTF8

        Write-Log "Saved cleaned file: $outFile" " OK "
        $Processed++
    }
    catch {
        Write-Log "Error processing $file : $_" "ERROR"
        $Errors++
    }
}

# =========================
# SUMMARY (Phase 2)
# =========================
$summary = "Processed=$Processed | Skipped=$Skipped | Errors=$Errors"
Write-Log $summary "INFO"

if ($Config.LogFile) {
    $script:LogEntries | Out-File -FilePath $LogPath -Encoding UTF8
    Write-Host "Log saved to $LogPath" -ForegroundColor Cyan
}
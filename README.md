# OneNote HTML Cleaner (All‑in‑One PowerShell Script)

A single‑file PowerShell solution for cleaning and modernizing HTML exported from Microsoft OneNote.  
This project began as a small script and has grown into a configurable processing pipeline with built‑in functions for repairing lists, sanitizing attributes, and formatting output. End users edit a simple config section inside the script — no external modules or configs required.

---

## Features

- **Modern head cleanup**: Replaces legacy meta tags, preserves original `<title>`, removes OneNote‑specific cruft.
- **HTML5‑compliant structure**: Strips obsolete attributes (`border`, `cellpadding`, `summary`, `type`) and flattens invalid list nesting.
- **List repair**: Fixes numbering; supports sequential or smart renumbering modes.
- **Image cleanup**: Removes empty dimensions and sanitizes attributes.
- **Readable output**: Normalizes whitespace and adds line breaks.
- **Single file**: Everything bundled into one `.ps1` for easy sharing.

---

## 📂 Project Layout

- **`OneNoteHtmlCleaner.ps1`** — the only file you need.
  - Config section (edit directly to change behavior)
  - Processing pipeline (order of cleanup steps)
  - All functions (grouped logically: Head, Structure, Lists, Images, Formatting)

For contributors, the repository may also include modular source files and tests used during development, but releases ship the single all‑in‑one script.

---

## Configuration

Edit the config near the top of `OneNoteHtmlCleaner.ps1`:

```powershell
# --- Config Section ---
$Config = @{
  RepairListValues = "Smart"   # Options: "Sequential", "Smart"
  EnableLogging    = $true      # Enable verbose logging
}
```
Adjust values and save — no external config files are needed.

---

## Quick Start

1. Download or clone the repository.
2. Open PowerShell in the project directory.
3. Run the cleaner:
   ```powershell
   .\OneNoteHtmlCleaner.ps1 -InFile "TestFile.htm" -OutFile "TestFile_cleaned.htm"

---

## 🧪 Testing (for contributors)

- Pester tests validate function behavior against sample inputs.
- Run all tests:
  ```powershell
  Invoke-Pester .\Tests

---

## Development Notes

- Functions are grouped by purpose (Head, Structure, Lists, Images, Formatting).
- During development, code may be modular; releases are concatenated into one file for convenience.
- Logging via `Write-Verbose` is available when running with `-Verbose`.

---

## License

MIT License — free to use, modify, and share.

---

## Contributing

Contributions are welcome:

- Fork the repo
- Make changes (preferably in the modular source)
- Add/update tests
- Open a pull request

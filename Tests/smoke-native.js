const fs = require('node:fs');
const path = require('node:path');

const CRITERIA = [
  { id: 1, title: 'Structure', automation: 'partial' },
  { id: 2, title: 'Content', automation: 'partial' },
  { id: 3, title: 'Images & Media', automation: 'manual' },
  { id: 4, title: 'Links', automation: 'manual' },
  { id: 5, title: 'Tables/List Layout', automation: 'manual' },
  { id: 6, title: 'Whitespace & Margins', automation: 'manual' },
  { id: 7, title: 'Metadata', automation: 'automated' },
  { id: 8, title: 'MHTML Artifacts', automation: 'automated' },
  { id: 9, title: 'Accessibility', automation: 'manual' }
];

const AUTOMATED_CRITERIA_IDS = new Set([1, 2, 7, 8]);

function parseArgs(argv) {
  const args = {
    cleanedDir: path.join('Tests', 'Cleaned'),
    fixturePath: path.join('Tests', 'expected', 'native-regression.json')
  };
  for (let i = 2; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--cleaned-dir' && argv[i + 1]) {
      args.cleanedDir = argv[i + 1];
      i += 1;
      continue;
    }
    if (value === '--fixture' && argv[i + 1]) {
      args.fixturePath = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function walkHtmlFiles(dirPath) {
  const results = [];
  if (!fs.existsSync(dirPath)) return results;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkHtmlFiles(fullPath));
    } else if (entry.isFile() && /\.html?$/i.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function check(condition, message, failures, criterionId = null) {
  if (!condition) {
    failures.push({ criterionId, message });
  }
}

function checkCommonHtmlQuality(filePath, html, failures) {
  check(/<!doctype html>/i.test(html), `${filePath}: missing <!doctype html>`, failures, 1);
  check(/<body\b[^>]*>/i.test(html) && /<\/body>/i.test(html), `${filePath}: missing <body> structure`, failures, 1);

  const visibleText = String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  check(visibleText.length >= 20, `${filePath}: expected readable content text`, failures, 2);

  check(/<meta\s+charset=["']?utf-8["']?/i.test(html), `${filePath}: missing UTF-8 charset meta`, failures, 7);
  check(/<title>\s*[^<]+\s*<\/title>/i.test(html), `${filePath}: missing meaningful <title>`, failures, 7);

  const hasMhtmlArtifacts = /(^From:|multipart\/related|Single File Web Page|Web Archive)/im.test(html) ||
    /\n--[-\w]{2,}/m.test(html);
  check(!hasMhtmlArtifacts, `${filePath}: appears to contain MHTML artifacts`, failures, 8);
}

function relative(filePath) {
  return filePath.split(path.sep).join('/');
}

function run() {
  const args = parseArgs(process.argv);
  const cleanedDir = path.resolve(process.cwd(), args.cleanedDir);
  const fixturePath = path.resolve(process.cwd(), args.fixturePath);
  const failures = [];

  check(fs.existsSync(cleanedDir), `Missing cleaned output directory: ${cleanedDir}`, failures);
  if (failures.length) {
    renderAndExit(failures, []);
    return;
  }

  const sectionDir = path.join(cleanedDir, 'Test Section_converted', 'Test Section');
  const notebookDir = path.join(cleanedDir, 'Test Notebook_converted', 'Test Notebook');

  check(fs.existsSync(sectionDir), `Missing section output directory: ${relative(sectionDir)}`, failures);
  check(fs.existsSync(notebookDir), `Missing notebook output directory: ${relative(notebookDir)}`, failures);

  const sectionFiles = walkHtmlFiles(sectionDir);
  const notebookFiles = walkHtmlFiles(notebookDir);
  const checkedFiles = [...sectionFiles, ...notebookFiles];

  check(sectionFiles.length >= 1, 'Expected at least one converted .one page in Test Section output.', failures);
  check(notebookFiles.length >= 1, 'Expected at least one converted .onepkg page in Test Notebook output.', failures);

  for (const filePath of checkedFiles) {
    const html = readText(filePath);
    checkCommonHtmlQuality(relative(filePath), html, failures);
  }

  for (const filePath of sectionFiles) {
    const html = readText(filePath);
    check(/<h1>\s*[^<]+\s*<\/h1>/i.test(html), `${relative(filePath)}: expected H1 for page title`, failures, 1);
    check(/Converted from native OneNote section/i.test(html), `${relative(filePath)}: expected native .one conversion marker`, failures, 2);
    check(/<(p|ul|ol|table|h2|h3)\b/i.test(html), `${relative(filePath)}: expected semantic content block markup`, failures, 1);
  }

  for (const filePath of notebookFiles) {
    const html = readText(filePath);
    check(/Converted from OneNote notebook package/i.test(html), `${relative(filePath)}: expected .onepkg conversion marker`, failures, 2);
    check(/Section path:\s*<code>[^<]+<\/code>/i.test(html), `${relative(filePath)}: expected section path metadata`, failures, 2);
  }

  applyRegressionFixtureAssertions(cleanedDir, fixturePath, failures);

  renderAndExit(failures, checkedFiles.map(relative));
}

function applyRegressionFixtureAssertions(cleanedDir, fixturePath, failures) {
  check(fs.existsSync(fixturePath), `Missing regression fixture file: ${relative(fixturePath)}`, failures);
  if (!fs.existsSync(fixturePath)) return;

  const fixture = readJson(fixturePath);

  const groups = Array.isArray(fixture.groups) ? fixture.groups : [];
  for (const group of groups) {
    const folderPath = path.join(cleanedDir, group.folder || '');
    check(fs.existsSync(folderPath), `Fixture group missing folder: ${relative(folderPath)}`, failures);
    if (!fs.existsSync(folderPath)) continue;
    const htmlFiles = walkHtmlFiles(folderPath);
    if (typeof group.minHtmlFiles === 'number') {
      check(
        htmlFiles.length >= group.minHtmlFiles,
        `Fixture group ${group.label || group.folder}: expected at least ${group.minHtmlFiles} HTML files, found ${htmlFiles.length}`,
        failures
      );
    }
  }

  const requiredFiles = Array.isArray(fixture.requiredFiles) ? fixture.requiredFiles : [];
  for (const relPath of requiredFiles) {
    const filePath = path.join(cleanedDir, relPath);
    check(fs.existsSync(filePath), `Fixture required file missing: ${relative(filePath)}`, failures);
  }

  const fileAssertions = fixture.files || {};
  for (const [relPath, assertions] of Object.entries(fileAssertions)) {
    const filePath = path.join(cleanedDir, relPath);
    if (!fs.existsSync(filePath)) {
      check(false, `Fixture file missing for assertions: ${relative(filePath)}`, failures);
      continue;
    }

    const html = readText(filePath);
    const mustContain = Array.isArray(assertions.mustContain) ? assertions.mustContain : [];
    const mustNotContain = Array.isArray(assertions.mustNotContain) ? assertions.mustNotContain : [];

    for (const expectedText of mustContain) {
      check(
        html.includes(expectedText),
        `${relative(filePath)}: expected fixture text not found -> ${expectedText}`,
        failures,
        2
      );
    }

    for (const forbiddenText of mustNotContain) {
      check(
        !html.includes(forbiddenText),
        `${relative(filePath)}: found forbidden fixture text -> ${forbiddenText}`,
        failures,
        8
      );
    }
  }
}

function renderAndExit(failures, filesChecked) {
  console.log('Native smoke test: ReviewChecklist starter checks');
  console.log(`Files checked: ${filesChecked.length}`);

  if (filesChecked.length) {
    for (const file of filesChecked) {
      console.log(`  - ${file}`);
    }
  }

  renderCriteriaCoverage(failures);

  if (failures.length === 0) {
    console.log('Result: PASS');
    process.exit(0);
  }

  console.log('Result: FAIL');
  for (const failure of failures) {
    const prefix = failure.criterionId ? `[C${failure.criterionId}] ` : '';
    console.log(`  - ${prefix}${failure.message}`);
  }
  process.exit(1);
}

function renderCriteriaCoverage(failures) {
  const failedCriteria = new Set(
    failures
      .map((item) => item.criterionId)
      .filter((value) => typeof value === 'number')
  );

  console.log('Criteria coverage:');
  for (const criterion of CRITERIA) {
    if (!AUTOMATED_CRITERIA_IDS.has(criterion.id)) {
      console.log(`  - C${criterion.id} ${criterion.title}: manual review`);
      continue;
    }

    const status = failedCriteria.has(criterion.id) ? 'FAIL' : 'PASS';
    const mode = criterion.automation === 'automated' ? 'automated' : 'partial automation';
    console.log(`  - C${criterion.id} ${criterion.title}: ${status} (${mode})`);
  }
}

run();
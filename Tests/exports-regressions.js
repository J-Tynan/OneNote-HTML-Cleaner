import fs from 'node:fs';
import path from 'node:path';

// simple checker for exported HTML structure
function analyze(html) {
  const issues = [];
  const htmlLangMatch = html.match(/<html[^>]*\blang\s*=\s*["']?([^"'\s>]+)["']?/i);
  if (!htmlLangMatch) {
    issues.push('missing lang attribute on <html>');
  } else {
    const lang = htmlLangMatch[1].trim();
    if (!/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(lang)) {
      issues.push(`invalid lang value on <html>: ${lang}`);
    }
  }
  if (!/<title>\s*[^<]+\s*<\/title>/i.test(html)) {
    issues.push('missing or empty <title>');
  }
  if (!/<main[\s>]/i.test(html)) {
    issues.push('missing <main> landmark');
  } else {
    const mainHtml = html.match(/<main[\s\S]*?<\/main>/i);
    if (mainHtml && !/<h1[\s>]/i.test(mainHtml[0])) {
      issues.push('missing <h1> inside <main>');
    }
  }
  // Ensure spacing guardrails only inspect inline style attributes.
  // We intentionally allow textual-fidelity spacing (for example text-indent / line-height)
  // and only block letter/word spacing overrides that tend to degrade readability.
  const inlineStyleMatches = [...html.matchAll(/\bstyle\s*=\s*(["'])([\s\S]*?)\1/gi)];
  const hasDisallowedInlineSpacing = inlineStyleMatches.some((match) => {
    const styleText = match[2] || '';
    return /(?:letter-spacing|word-spacing)\s*:/i.test(styleText);
  });
  if (hasDisallowedInlineSpacing) {
    issues.push('contains disallowed inline spacing styles');
  }
  // OneNote/Office artifacts we want to strip: xmlns:* declarations, mso- attributes,
  // and leftover Main-File/File-List links in the body.
  if (/\bxmlns:/i.test(html)) {
    issues.push('contains xmlns: declaration');
  }
  if (/\bmso-/i.test(html)) {
    issues.push('contains mso- artifact');
  }
  if (/Main-File/i.test(html)) {
    issues.push('contains Main-File link');
  }
  return issues;
}

function analyzeFixtureSpecific(html, fileName) {
  const issues = [];
  if (fileName === 'DevToys.html') {
    const imageCount = (html.match(/<img\b/gi) || []).length;
    if (imageCount < 3) {
      issues.push(`expected embedded images in DevToys export (found ${imageCount})`);
    }
  }
  return issues;
}

(async () => {
  const argv = process.argv.slice(2);
  // by default, validate the cleaned HTML outputs users download; allow override
  const dir = argv[0] || path.join('Tests', 'Cleaned');
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    console.error('directory not found:', dir);
    process.exit(1);
  }
  const files = fs.readdirSync(dir).filter(f => f.match(/\.html?$/i));
  let overallFail = false;
  for (const file of files) {
    const full = path.join(dir, file);
    const html = fs.readFileSync(full, 'utf8');
    const issues = [
      ...analyze(html),
      ...analyzeFixtureSpecific(html, file)
    ];
    if (issues.length) {
      overallFail = true;
      console.log(`${file}: ${issues.join('; ')}`);
    } else {
      console.log(`${file}: OK`);
    }
  }
  process.exit(overallFail ? 1 : 0);
})();

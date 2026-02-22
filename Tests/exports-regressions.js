import fs from 'node:fs';
import path from 'node:path';

// simple checker for exported HTML structure
function analyze(html) {
  const issues = [];
  if (!/<html[^>]*\blang=/i.test(html)) {
    issues.push('missing lang attribute on <html>');
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
  return issues;
}

(async () => {
  const argv = process.argv.slice(2);
  const dir = argv[0] || path.join('Tests', 'exports-from-mht');
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    console.error('directory not found:', dir);
    process.exit(1);
  }
  const files = fs.readdirSync(dir).filter(f => f.match(/\.html?$/i));
  let overallFail = false;
  for (const file of files) {
    const full = path.join(dir, file);
    const html = fs.readFileSync(full, 'utf8');
    const issues = analyze(html);
    if (issues.length) {
      overallFail = true;
      console.log(`${file}: ${issues.join('; ')}`);
    } else {
      console.log(`${file}: OK`);
    }
  }
  process.exit(overallFail ? 1 : 0);
})();

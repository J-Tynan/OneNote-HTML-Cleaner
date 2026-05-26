import assert from 'assert';

const { normalizeWhitespace } = await import('../src/pipeline/format.js');

console.log('running html-formatting unit tests');

{
  const raw = '<!DOCTYPE html>\r\n<html>\r\n<body>\r\n<div>One</div>  \r\n\r\n\r\n<p>&nbsp;Two\u00a0</p>\t\r\n</body>\r\n</html>\r\n';
  const normalized = normalizeWhitespace(raw);

  assert(!/\r/.test(normalized));
  assert(!/[ \t]+\n/.test(normalized));
  assert(!/\n{3,}/.test(normalized));
  assert(normalized.includes('<div>One</div>\n\n<p> Two </p>'));
}

{
  const raw = '<!DOCTYPE html>\n<html>\n<body>\n<script>\nconst value = 1;  \n\nconsole.log(value);\n</script>\n\n\n<pre>  first\n\nsecond  </pre>\n\n\n<p>Done</p>\n</body>\n</html>';
  const normalized = normalizeWhitespace(raw);

  assert(normalized.includes('<script>\nconst value = 1;  \n\nconsole.log(value);\n</script>'));
  assert(normalized.includes('<pre>  first\n\nsecond  </pre>'));
  assert(normalized.includes('</pre>\n\n<p>Done</p>'));
}

console.log('html-formatting: PASS');
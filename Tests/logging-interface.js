import { createLogger, info } from '../src/logging.js';

// simple assertion helper
function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

/**
 * capture console.log messages produced during fn
 */
function capture(fn) {
  const out = [];
  const orig = { log: console.log, info: console.info, warn: console.warn, error: console.error };
  ['log','info','warn','error'].forEach(level => {
    console[level] = (...args) => { out.push(args.join(' ')); };
  });
  try {
    fn();
  } finally {
    Object.assign(console, orig);
  }
  return out;
}

try {
  const logger = createLogger('test');
  const lines = capture(() => {
    logger.info({ msg: 'hello world', meta: { foo: 'bar' } });
    info('test', { msg: 'secondary call' }); // compatibility path
  });
  // expect two lines
  assert(lines.length === 2, `expected 2 log lines, got ${lines.length}`);
  assert(lines[0].includes('[test] INFO'), 'prefix missing');
  assert(lines[0].includes('hello world'), 'message missing');
  assert(lines[1].includes('secondary call'), 'secondary message missing');
  console.log('logging-interface: PASS');
  process.exit(0);
} catch (err) {
  console.error('logging-interface: FAIL', err && err.stack ? err.stack : err);
  process.exit(1);
}

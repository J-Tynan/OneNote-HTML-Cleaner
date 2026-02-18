// Test harness logger — enable with TEST_VERBOSE=1
const TEST_VERBOSE = Boolean(process.env.TEST_VERBOSE && process.env.TEST_VERBOSE !== '0');
function testLog(...args) { if (!TEST_VERBOSE) return; console.log('[TEST]', ...args); }
module.exports = { TEST_VERBOSE, testLog };
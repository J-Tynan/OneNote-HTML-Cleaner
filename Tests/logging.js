// Test harness logger — enable with TEST_VERBOSE=1
export const TEST_VERBOSE = Boolean(process.env.TEST_VERBOSE && process.env.TEST_VERBOSE !== '0');
export function testLog(...args) { if (!TEST_VERBOSE) return; console.log('[TEST]', ...args); }
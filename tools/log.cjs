// Lightweight CLI verbosity helper — enable with CLI_VERBOSE=1
const CLI_VERBOSE = Boolean(process.env.CLI_VERBOSE && process.env.CLI_VERBOSE !== '0');
function logCli(...args) { if (!CLI_VERBOSE) return; console.log('[CLI]', ...args); }
module.exports = { CLI_VERBOSE, logCli };
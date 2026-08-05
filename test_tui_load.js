const { launchTui } = require('./dist/cli/tui.js');
// Mock process.exit and set a timeout
const origExit = process.exit;
process.exit = () => { console.log("Exited"); };
// This will just start the TUI. But we can't easily script the keypresses.

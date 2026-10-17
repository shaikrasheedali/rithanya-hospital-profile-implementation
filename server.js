// Compatibility entrypoint. `index.js` is the canonical production
// entrypoint; this thin wrapper keeps legacy cPanel start commands
// (`node server.js`) working without duplicating boot logic.
require("./index.js");

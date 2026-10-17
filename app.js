// Compatibility entrypoint. `index.js` is the canonical production
// entrypoint; this thin wrapper keeps legacy PaaS start commands
// (`node app.js`) working without duplicating boot logic.
require("./index.js");

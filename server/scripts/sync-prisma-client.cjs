const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../..');
const serverDir = path.resolve(__dirname, '..');

const serverPrisma = path.join(serverDir, 'node_modules', '.prisma');
const rootPrisma = path.join(rootDir, 'node_modules', '.prisma');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  if (path.resolve(src) === path.resolve(dest)) return;
  try {
    fs.mkdirSync(dest, { recursive: true });
  } catch {}
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      try {
        fs.copyFileSync(srcPath, destPath);
      } catch (e) {
        // Non-fatal if destination file is locked or busy
      }
    }
  }
}

// Sync between server and root node_modules — always propagate the NEWER build
// (prisma generate outputs to root ../node_modules, so root is fresh after generate).
// Copying stale over fresh destroys the just-generated client, so compare mtimes.
function mtime(p) {
  try {
    return fs.statSync(p).mtimeMs;
  } catch {
    return 0;
  }
}
const serverIndex = path.join(serverPrisma, "client", "index.d.ts");
const rootIndex = path.join(rootPrisma, "client", "index.d.ts");
if (fs.existsSync(serverPrisma) && path.resolve(serverPrisma) !== path.resolve(rootPrisma)) {
  const serverT = mtime(serverIndex);
  const rootT = mtime(rootIndex);
  if (rootT >= serverT && fs.existsSync(rootPrisma)) {
    copyDir(rootPrisma, serverPrisma);
    console.log("[sync-prisma] Synced .prisma from root (fresh) to server node_modules");
  } else {
    copyDir(serverPrisma, rootPrisma);
    console.log("[sync-prisma] Synced .prisma to root node_modules");
  }
}

// Ensure default.js and default.d.ts exist in all client locations
const targets = [
  path.join(serverPrisma, 'client'),
  path.join(rootPrisma, 'client')
];

for (const clientDir of targets) {
  if (fs.existsSync(clientDir)) {
    const defJs = path.join(clientDir, 'default.js');
    if (!fs.existsSync(defJs)) {
      try {
        fs.writeFileSync(defJs, "module.exports = { ...require('./index.js') };\n");
        console.log(`[sync-prisma] Created fallback default.js at ${defJs}`);
      } catch {}
    }
    const defDts = path.join(clientDir, 'default.d.ts');
    if (!fs.existsSync(defDts)) {
      try {
        fs.writeFileSync(defDts, "export * from './index';\n");
      } catch {}
    }
  }
}

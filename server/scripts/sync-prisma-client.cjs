const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../..');
const serverDir = path.resolve(__dirname, '..');

const serverPrisma = path.join(serverDir, 'node_modules', '.prisma');
const rootPrisma = path.join(rootDir, 'node_modules', '.prisma');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Sync between server and root node_modules
if (fs.existsSync(serverPrisma) && !fs.existsSync(rootPrisma)) {
  copyDir(serverPrisma, rootPrisma);
  console.log('[sync-prisma] Copied .prisma from server to root node_modules');
} else if (fs.existsSync(rootPrisma) && !fs.existsSync(serverPrisma)) {
  copyDir(rootPrisma, serverPrisma);
  console.log('[sync-prisma] Copied .prisma from root to server node_modules');
}

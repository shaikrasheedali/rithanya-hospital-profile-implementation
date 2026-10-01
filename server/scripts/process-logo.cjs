const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function run() {
  const rootDir = path.resolve(__dirname, '../..');
  const inputPath = path.join(rootDir, 'logo.jpeg');
  
  const clientPublic = path.join(rootDir, 'client', 'public');
  const clientAssets = path.join(rootDir, 'client', 'src', 'assets');
  const serverPublic = path.join(rootDir, 'server', 'public');

  fs.mkdirSync(clientPublic, { recursive: true });
  fs.mkdirSync(clientAssets, { recursive: true });
  fs.mkdirSync(serverPublic, { recursive: true });

  const image = sharp(inputPath);
  const { width, height } = await image.metadata();
  console.log(`Original image: ${width}x${height}`);

  // Get raw RGBA buffer
  const raw = await image.ensureAlpha().raw().toBuffer();
  // 4 channels: R, G, B, A
  // Flood fill from (0,0) to find all connected background pixels
  const visited = new Uint8Array(width * height);
  const queue = [0]; // index of (0,0)
  visited[0] = 1;

  function isWhiteLike(idx) {
    const p = idx * 4;
    const r = raw[p];
    const g = raw[p + 1];
    const b = raw[p + 2];
    // Background is near white (e.g. R, G, B all > 230)
    return r > 230 && g > 230 && b > 230;
  }

  // Also seed other corners and outer edges
  for (let x = 0; x < width; x++) {
    const topIdx = x;
    const botIdx = (height - 1) * width + x;
    if (!visited[topIdx] && isWhiteLike(topIdx)) {
      visited[topIdx] = 1;
      queue.push(topIdx);
    }
    if (!visited[botIdx] && isWhiteLike(botIdx)) {
      visited[botIdx] = 1;
      queue.push(botIdx);
    }
  }
  for (let y = 0; y < height; y++) {
    const leftIdx = y * width;
    const rightIdx = y * width + (width - 1);
    if (!visited[leftIdx] && isWhiteLike(leftIdx)) {
      visited[leftIdx] = 1;
      queue.push(leftIdx);
    }
    if (!visited[rightIdx] && isWhiteLike(rightIdx)) {
      visited[rightIdx] = 1;
      queue.push(rightIdx);
    }
  }

  let head = 0;
  while (head < queue.length) {
    const curr = queue[head++];
    const cx = curr % width;
    const cy = Math.floor(curr / width);

    // 4 neighbors
    const neighbors = [];
    if (cx > 0) neighbors.push(curr - 1);
    if (cx < width - 1) neighbors.push(curr + 1);
    if (cy > 0) neighbors.push(curr - width);
    if (cy < height - 1) neighbors.push(curr + width);

    for (const n of neighbors) {
      if (!visited[n] && isWhiteLike(n)) {
        visited[n] = 1;
        queue.push(n);
      }
    }
  }

  console.log(`Flood-filled ${queue.length} background pixels out of ${width * height}`);

  // Now process alpha:
  // For pixels in background or near background edge, make transparent or smoothly fade
  for (let i = 0; i < width * height; i++) {
    const p = i * 4;
    const r = raw[p];
    const g = raw[p + 1];
    const b = raw[p + 2];

    if (visited[i]) {
      // It's definitely background
      // Check distance from white for smooth edge
      const minVal = Math.min(r, g, b);
      if (minVal >= 250) {
        raw[p + 3] = 0;
      } else {
        // Smooth antialiased edge
        const t = (250 - minVal) / (250 - 230);
        raw[p + 3] = Math.max(0, Math.min(255, Math.round(t * 255)));
      }
    } else {
      // Foreground pixel
      // If it's extremely close to white and bordering a visited pixel, antialias
      if (r > 240 && g > 240 && b > 240) {
        // Check if any neighbor is visited
        const cx = i % width;
        const cy = Math.floor(i / width);
        let border = false;
        if (cx > 0 && visited[i - 1]) border = true;
        if (cx < width - 1 && visited[i + 1]) border = true;
        if (cy > 0 && visited[i - width]) border = true;
        if (cy < height - 1 && visited[i + width]) border = true;

        if (border) {
          const minVal = Math.min(r, g, b);
          const t = Math.max(0, (255 - minVal) / 20);
          raw[p + 3] = Math.round(t * 255);
        }
      }
    }
  }

  // Trim transparent edges so logo is neatly bounded
  const transparentPng = await sharp(raw, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();

  const trimmed = await sharp(transparentPng)
    .trim()
    .toBuffer();

  // Save full-res transparent logo
  const logoTargets = [
    path.join(clientPublic, 'logo.png'),
    path.join(clientAssets, 'logo.png'),
    path.join(serverPublic, 'logo.png'),
  ];
  for (const t of logoTargets) {
    await sharp(trimmed).png().toFile(t);
    console.log(`Saved ${t}`);
  }

  // Save square favicon (256x256, 64x64, 32x32)
  const squareFavicon = await sharp(trimmed)
    .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const faviconTargets = [
    path.join(clientPublic, 'favicon.png'),
    path.join(clientPublic, 'favicon.ico'),
    path.join(serverPublic, 'favicon.png'),
    path.join(serverPublic, 'favicon.ico'),
  ];
  for (const t of faviconTargets) {
    await sharp(squareFavicon).toFile(t);
    console.log(`Saved ${t}`);
  }

  // Apple touch icon (180x180)
  const touchIcon = await sharp(trimmed)
    .resize(180, 180, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp(touchIcon).toFile(path.join(clientPublic, 'apple-touch-icon.png'));
  console.log('Saved apple-touch-icon.png');
}

run().catch(console.error);

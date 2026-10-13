// Generates simple PNG app icons without native deps (dark tile with a rising bar chart).
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pad) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const bg = [14, 17, 22], acc = [91, 140, 255], acc2 = [52, 199, 113];
  const inner = size * (1 - 2 * pad);
  const x0 = size * pad;
  const bars = [0.35, 0.55, 0.8];
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let col = bg;
      const u = (x - x0) / inner, v = (y - x0) / inner;
      if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
        for (let i = 0; i < 3; i++) {
          const bx = 0.12 + i * 0.29, bw = 0.2, h = bars[i];
          if (u >= bx && u <= bx + bw && v >= 0.88 - h && v <= 0.88) col = i === 2 ? acc2 : acc;
        }
      }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = col[0]; raw[o + 1] = col[1]; raw[o + 2] = col[2]; raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-192.png", png(192, 0.14));
writeFileSync("public/icons/icon-512.png", png(512, 0.14));
writeFileSync("public/icons/icon-512-maskable.png", png(512, 0.24));
writeFileSync("public/icons/apple-touch-icon.png", png(180, 0.14));
console.log("icons written");

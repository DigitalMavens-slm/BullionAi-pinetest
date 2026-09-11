/*
 * Generates launcher assets from assets/logo-mark.png (BullionAI gold "B" logo).
 * The source has a solid white background — white is keyed out to transparency
 * before compositing so the gold/navy logo sits clean on the navy tile.
 *
 *   - icon.png                     1024x1024  navy tile, logo ~72%
 *   - android-icon-foreground.png  1024x1024  transparent, logo ~56% (adaptive safe zone)
 *   - splash-icon.png              1024x1024  transparent, logo ~56%
 *   - favicon.png                  48x48
 */
const sharp = require("sharp");
const path = require("path");
const A = (f) => path.join(__dirname, "..", "assets", f);

const NAVY = "#0A2540";
const SRC = A("logo-mark.png");

/** Key near-white pixels to transparent, feathering the edge. */
async function keyWhite(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const min = Math.min(r, g, b), max = Math.max(r, g, b);
    const isWhiteish = min > 225 && (max - min) < 24; // low-saturation near-white
    if (isWhiteish) {
      // feather: 225-249 fades alpha out, >=249 fully transparent
      const t = Math.max(0, Math.min(1, (max - 225) / 24));
      data[i + 3] = Math.round(data[i + 3] * (1 - t));
    }
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

async function main() {
  const keyed = await keyWhite(SRC);
  const meta = await sharp(keyed).metadata();
  console.log("keyed logo:", meta.width + "x" + meta.height);

  // 1) App icon — navy tile, logo at 72% width
  {
    const logo = await sharp(keyed).resize({ width: Math.round(1024 * 0.72) }).png().toBuffer();
    const m = await sharp(logo).metadata();
    await sharp({ create: { width: 1024, height: 1024, channels: 4, background: NAVY } })
      .composite([{ input: logo, left: Math.round((1024 - m.width) / 2), top: Math.round((1024 - m.height) / 2) }])
      .png()
      .toFile(A("icon.png"));
    console.log("icon.png written (navy tile)");
  }

  // 2) Adaptive foreground — transparent, logo inside the 66% safe zone
  for (const [file, scale] of [["android-icon-foreground.png", 0.56], ["splash-icon.png", 0.56]]) {
    const logo = await sharp(keyed).resize({ width: Math.round(1024 * scale) }).png().toBuffer();
    const m = await sharp(logo).metadata();
    await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: logo, left: Math.round((1024 - m.width) / 2), top: Math.round((1024 - m.height) / 2) }])
      .png()
      .toFile(A(file));
    console.log(file, "written (transparent)");
  }

  // 3) Favicon
  {
    const logo = await sharp(keyed).resize(48, 48, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    await sharp({ create: { width: 48, height: 48, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: logo, left: 0, top: 0 }])
      .png()
      .toFile(A("favicon.png"));
    console.log("favicon.png written");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
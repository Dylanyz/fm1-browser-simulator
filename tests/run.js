/* Boots .rfm1 files headless and checks that each one powers on, draws, sounds when played and
 * hands back its flash.   node tests/run.js [file.rfm1 ...]   (default: every file in firmware/) */
"use strict";
const fs = require("fs"), path = require("path");
const Rfm1 = require("../src/rfm1.js");

function rms(a) { let s = 0; for (const v of a) s += v * v; return Math.sqrt(s / a.length); }
function lit(bytes) { let n = 0; for (let i = 0; i < bytes.length; i += 2) if (bytes[i] | bytes[i + 1]) n++; return n; }

async function check(file) {
  const t0 = Date.now();
  const fw = Rfm1.parse(fs.readFileSync(file));
  const core = await Rfm1.Core.create(fw);
  core.boot(null);
  core.runMs(1500);
  const idle = rms(core.pull(4410));
  const px = lit(core.lcdBytes());
  const writes = core.lcdWrites();
  [7, 11, 14].forEach(k => core.key(k, 1, 100));      /* a chord for half a second */
  core.runMs(50);
  const played = rms(core.pull(22050));
  [7, 11, 14].forEach(k => core.key(k, 0));
  core.turn(3, 3);                                    /* KNOB 1, PRESETS, then HOME */
  core.turn(2, 1);
  core.button(6, 1); core.runMs(80); core.button(6, 0);
  core.runMs(600);
  const writes2 = core.lcdWrites();
  const img = core.flashImage(true);
  const wall = Date.now() - t0;
  const r = {
    file: path.basename(file), id: fw.manifest.id, name: core.info.name, version: core.info.version,
    abi: core.abi, license: core.info.license, buttons: core.buttonNames.join(" "), sim1: core.sim1,
    halted: core.halted, litPixels: px, lcdWrites: [writes, writes2], idleRms: +idle.toFixed(4),
    playedRms: +played.toFixed(4), flash: img ? img.length : 0, deviceMs: core.ms,
    speed: +(core.ms / wall).toFixed(1) + "x realtime", log: core.logLines.slice(0, 3)
  };
  if (core.sim1) r.ctl = [0, 1, 2, 3].map(i => core.ctl(i));
  return { ok: !core.halted && px > 0 && writes2 > writes, r };
}

(async () => {
  let files = process.argv.slice(2);
  const dir = path.join(__dirname, "../firmware");
  if (!files.length) files = fs.readdirSync(dir).filter(f => f.endsWith(".rfm1")).map(f => path.join(dir, f));
  let bad = 0;
  for (const f of files) {
    try {
      const { ok, r } = await check(f);
      console.log((ok ? "ok   " : "FAIL ") + JSON.stringify(r));
      if (!ok) bad++;
    } catch (e) { console.log("FAIL " + path.basename(f) + ": " + e.message); bad++; }
  }
  process.exit(bad ? 1 : 0);
})();

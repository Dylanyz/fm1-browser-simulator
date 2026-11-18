# How a firmware plugs in

The simulator runs one kind of file: an **`.rfm1`**. That is an FM-1 firmware's host build compiled to
WebAssembly, with a small JSON manifest inside it. The format belongs to the FM-1 community, not to this
project: it is defined in [RemoteFM1IOS `docs/RFM1-FORMAT.md`](https://github.com/Quixotic7/RemoteFM1IOS/blob/main/docs/RFM1-FORMAT.md),
wraps FM1VST's `fm1core` ABI (version 6), and the same files run in RemoteFM1 for iOS and in FM1VST. This page
says how this simulator drives a module, and documents one optional extension of its own.

## Why this format

FM-1 firmwares come from a few families: Felucca and its many forks, fm1-base apps, and firmwares written from
scratch (h1). Each has its own hardware layer, so a simulator that tried to compile every firmware itself would
need a port per family. `fm1core` already solved that: one small C ABI (a panel struct, a clock, an audio call,
a flash image) that each family's glue implements once. `.rfm1` puts that ABI in WebAssembly, and the toolchains
already produce it:

| Family | How to get an `.rfm1` |
| --- | --- |
| fm1-base apps (CTL-1, AMB-1, ...) | `tools/build.py APP_DIR --rfm1` in [fm1-base](https://github.com/charlesvestal/fm1-base) |
| Felucca, ChoralRoot, Melodee, SLOOP and other cores FM1VST knows | FM1VST's `fm1_add_rfm1` ([FM1VST](https://github.com/Quixotic7/FM1VST)) |
| Already built, 50+ firmwares | the [RemoteFM1FW release](https://github.com/Quixotic7/RemoteFM1FW/releases/latest) |
| h1 | `tools/build_rfm1.sh` in [h1](https://github.com/jakehandy/h1) |
| Anything else | implement the exports below (h1's `port/rfm1/rfm1.c` is a 400-line example with no libc) |

What the format can't carry is the device's own `.fwsc` package. That is machine code for the FM-1's JieLi chip,
and running it needs an emulator of that CPU, which this project doesn't have.

## What the simulator checks

`src/rfm1.js` refuses a file unless:

- it is a WebAssembly module with an `rfm1` custom section holding JSON with `rfm1: 1`, `abi`, `id`, `name`,
  `version`, `license` and `source_url`;
- it imports nothing outside `wasi_snapshot_preview1` (stdout and stderr go to the page's log; the rest are
  stubs, and `proc_exit` halts the firmware);
- it exports `memory` and the `rfm1_*` functions, `rfm1_version()` is 1, `rfm1_get(6)` (or 5) returns a
  descriptor, and every `rfm1_layout(i)` offset matches the wasm32 layout of `fm1core.h`.

## How it drives a module

1. `_initialize()` if exported, then `rfm1_get(6)` and the layout check.
2. Boot: `rfm1_flash_stage(ptr, n)` with the flash image this browser saved for the firmware's `id` (or `(0, 0)`
   for a fresh one), `rfm1_options("fm1core:staged", 0, 0, 1)`, `rfm1_boot_options(-1, 0, -1)`, `panel.ready = 2`,
   `rfm1_init(0)`.
3. The clock, one device millisecond at a time: `rfm1_tick(ms)`, then `rfm1_frame()` when `ms % 15 == 0` or
   `rfm1_idle()` otherwise, then `rfm1_audio(buf, 128)` for every 128-frame block due at 44.1 kHz. While sound is
   on, the audio callback pulls the clock forward as far as it needs samples; before that, the page's animation
   frames run it in real time.
4. Input goes into the panel between calls: `keys` (with `key_vel` set first, from where the key was hit),
   `buttons` through `btn_id`, encoder detents into `enc` through `enc_id` and `enc_dir`, MASTER into `master`
   (0..1023), Web MIDI as USB-MIDI packets through `rfm1_midi_in`.
5. Output is read back after each frame: the 240 × 240 RGB565 screen (high byte first) when `lcd_writes` moves,
   the LED matrix through `keymap`, `led_play_green`, the 14 `button_names`, and `rfm1_stats` for the CPU figure.
6. Saving: when `rfm1_flash_dirty()` moves, the page copies `rfm1_flash()` into IndexedDB under the firmware's
   `id`. When the page is hidden it calls `rfm1_flash_sync()` first.

It also reads, when present: `rfm1_labels_epoch` / `rfm1_label` (FM1VST's live labels: what each button and knob
does right now) and the `rfm1.skin` sections (a background behind the panel and an accent colour).

## The `sim1` extension (optional)

An FM-1 encoder is endless, so a host can only send it clicks. That is fine for a knob, and awkward for a slider:
the slider doesn't know where the value is. `sim1` lets a firmware tell the simulator what each knob is tied to
right now, so a slider or knob can show the value and jump straight to a new one. A host that doesn't know these
exports ignores them, and the module still runs everywhere else.

| Export | Signature | Meaning |
| --- | --- | --- |
| `rfm1_sim1_version` | `() -> i32` | 1 |
| `rfm1_sim1_ctl` | `(role, out) -> i32` | fills `out` with `{i32 value, i32 lo, i32 hi, char name[32], char text[32]}` for knob role `role` (SELECT, ALGORITHM, PRESETS, KNOB 1..4). Returns 1 if the role has a value a slider may set outright, 0 if it stays a relative encoder (the name and text still show). |
| `rfm1_sim1_ctl_set` | `(role, value) -> ()` | set it, the way a panel change would |
| `rfm1_sim1_accent` | `() -> i32` | `0xRRGGBB` for the page's accent colour right now, or -1 |
| `rfm1_sim1_link_bytes` | `() -> i32` | bytes the last frame sent to the panel, for the screen-link meter (without it the page counts changed rows itself) |

`out` is 76 bytes the host gets from `rfm1_alloc`. All of them are called between clock calls, like every other
export.

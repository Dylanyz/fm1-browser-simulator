# Notice: the RemoteFM1 parts

All of the simulator is MIT ([LICENSE](LICENSE)).

The "my FM-1" toggle talks to an FM-1 running [RemoteFM1](https://github.com/Quixotic7/RemoteFM1), whose protocol
(version 2) is the work of Michael P Jones (Quixotic7) and the RemoteFM1 contributors.

| File | Licence | Where it comes from |
|---|---|---|
| `src/remote.js` | MIT | New code. The protocol's facts (message numbers, body layouts, timings, the panel's MIDI) were taken from RemoteFM1's `docs/PROTOCOL.md` (GPL-3.0-only: facts only, see below), `proto/rfm1.h` and `firmware/src/remote_proto.h` (MPL-2.0), and the LED row bits from `firmware/src/rfm_host.c` (MPL-2.0). libremotefm1's `host/src/session.c` and `panel.c` (MPL-2.0) were read for how a host behaves (the 60 ms settle window before PANEL_R corrects a control, its waits and retries); none of their code was translated. |
| `tests/remote.js` | MIT | New code: a fake MIDI port and a fake FM-1 written from the protocol. |

Not consulted: RemoteFM1's web player (`web/`, including `web/remote/remote.js`), which is GPL-3.0-only. No GPL
code went into any file here. RemoteFM1's `docs/PROTOCOL.md` is itself GPL-3.0-only: only facts about the
protocol were taken from it, never its text.

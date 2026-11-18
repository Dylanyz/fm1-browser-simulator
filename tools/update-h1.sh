#!/bin/sh
# Rebuilds the bundled h1 from a checkout of github.com/jakehandy/h1 and refreshes dist/.
#   tools/update-h1.sh [PATH_TO_H1] [VERSION]     (default ../h1, version "dev")
set -e
cd "$(dirname "$0")/.."
H1="${1:-../h1}"
"$H1/tools/build_rfm1.sh" "${2:-dev}"
cp "$H1/dist/h1.rfm1" firmware/h1.rfm1
node tests/run.js firmware/h1.rfm1
node tools/build.js

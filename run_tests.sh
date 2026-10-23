#!/usr/bin/env sh
# Runs the GUT suite headless. Set GODOT to your Godot 4.7 binary if it isn't on PATH.
set -e
GODOT="${GODOT:-godot}"
cd "$(dirname "$0")"
"$GODOT" --headless --import >/dev/null 2>&1 || true
"$GODOT" --headless -s addons/gut/gut_cmdln.gd

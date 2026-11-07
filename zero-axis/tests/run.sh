#!/bin/zsh
set -e
TASK_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENGINE="${GODOT_BIN:-$TASK_DIR/../.local/godot/Godot.app/Contents/MacOS/Godot}"
"$ENGINE" --headless --path "$TASK_DIR" --editor --import --quit
"$ENGINE" --headless --path "$TASK_DIR" --script tests/run_tests.gd
"$ENGINE" --headless --path "$TASK_DIR" --script tests/playthrough.gd

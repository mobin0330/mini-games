#!/bin/zsh
set -e
TASK_DIR="$(cd "$(dirname "$0")" && pwd)"
ENGINE="$TASK_DIR/../.local/godot/Godot.app/Contents/MacOS/Godot"
if [[ ! -x "$ENGINE" ]]; then
  ENGINE="$(command -v godot || command -v godot4 || true)"
fi
if [[ -z "$ENGINE" || ! -x "$ENGINE" ]]; then
  echo '请安装 Godot 4.5.2 或更新的 4.x 稳定版，然后导入 project.godot。'
  exit 1
fi
exec "$ENGINE" --path "$TASK_DIR" "$@"

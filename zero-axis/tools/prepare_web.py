"""Prepare same-origin, strict-CSP Godot shell. Never changes authentication."""
from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1]
for name in ('index.html','loader.js','web.css'):
    shutil.copyfile(root/'web'/name,root/'build/web'/name)
shutil.copyfile(root/'docs/level-06.png',root/'build/web/preview.png')
print('Prepared CSP-compatible browser shell and in-game preview.')

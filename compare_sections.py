from pathlib import Path
import sys
lines = Path('src/bot.js').read_text(encoding='utf-8').splitlines()
for idx in range(740, 770):
    sys.stdout.buffer.write(f"A {idx+1}: {lines[idx]}\n".encode('utf-8'))
sys.stdout.buffer.write(b"---\n")
for idx in range(1780, 1810):
    sys.stdout.buffer.write(f"B {idx+1}: {lines[idx]}\n".encode('utf-8'))

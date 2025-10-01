from pathlib import Path
text = Path('src/bot.js').read_text(encoding='utf-8')
start = text.index("bot.action(/^complaint:(.+)$/i")
end = text.index("bot.action(/^application:(confirm|decline):", start)
print(text[start:end].encode('unicode_escape'))

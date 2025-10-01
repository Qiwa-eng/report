from pathlib import Path

path = Path('src/bot.js')
text = path.read_text(encoding='utf-8')
old = "  const lines = await repository.getLines();\n  const userLines = lines.filter((line) => user.lineIds.includes(line.id));\n\n  if (!userLines.length) {\n    await ctx.reply(t(language, 'notLinked'));\n    return;\n  }\n\n  const keyboard = Markup.inlineKeyboard(\n    userLines.map((line) => [Markup.button.callback(${line.title} (), complaint:)])\n  );\n\n  await ctx.reply(t(language, 'complaintPrompt'), keyboard);\n"
new = "  clearUserState(ctx.from.id);\n\n  await sendComplaintLineMenu(ctx, user, language);\n"
if old not in text:
    raise SystemExit('bot.hears block not found')
path.write_text(text.replace(old, new, 1), encoding='utf-8')

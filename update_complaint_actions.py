from pathlib import Path

path = Path('src/bot.js')
text = path.read_text(encoding='utf-8')
old_block = "bot.action(/^complaint:(.+)$/i, async (ctx) => {\n  if (isAdmin(ctx.from.id)) {\n    await ctx.answerCbQuery();\n    return;\n  }\n\n  if (await isStopWork(ctx)) {\n    await ctx.answerCbQuery('🚧');\n    clearUserState(ctx.from.id);\n    return;\n  }\n\n  const lineId = ctx.match[1];\n  const user = await repository.getUser(ctx.from.id);\n  const language = getUserLanguage(user);\n\n  if (!user || !user.lineIds.includes(lineId)) {\n    await ctx.answerCbQuery(t(language, 'noAccessLine'), { show_alert: true });\n    return;\n  }\n\n  const line = await repository.getLine(lineId);\n\n  userStates.set(Number(ctx.from.id), {\n    type: 'awaitingComplaintDescription',\n    payload: { lineId },\n  });\n\n  const responseText = t(language, 'complaintLineChosen', {\n    lineTitle: line?.title,\n    lineId,\n  });\n\n  await ctx.answerCbQuery('✅');\n  try {\n    await ctx.editMessageText(responseText);\n  } catch (error) {\n    await ctx.reply(responseText);\n  }\n});\n"

if old_block not in text:
    raise SystemExit('old complaint block not found')

new_block = """bot.action(/^complaint:(.+)$/i, async (ctx) => {
  if (isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery();
    return;
  }

  if (await isStopWork(ctx)) {
    await ctx.answerCbQuery('🚧');
    clearUserState(ctx.from.id);
    return;
  }

  const lineId = decodeCallbackComponent(ctx.match[1]);
  const user = await repository.getUser(ctx.from.id);
  const language = getUserLanguage(user);

  if (!user || !user.lineIds.includes(lineId)) {
    await ctx.answerCbQuery(t(language, 'noAccessLine'), { show_alert: true });
    return;
  }

  const line = await repository.getLine(lineId);

  if (!line) {
    await ctx.answerCbQuery(t(language, 'lineMissing'), { show_alert: true });
    return;
  }

  const sipOptions = getSipOptions(line);

  if (sipOptions.length) {
    userStates.set(Number(ctx.from.id), {
      type: 'awaitingComplaintSip',
      payload: { lineId, sipOptions },
    });

    const promptText = t(language, 'complaintChooseSip', {
      lineTitle: line.title,
      lineId: line.id,
    });
    const keyboard = buildSipKeyboard(line, sipOptions, language);

    await ctx.answerCbQuery('✅');
    try {
      await ctx.editMessageText(promptText, keyboard);
    } catch (error) {
      await ctx.reply(promptText, keyboard);
    }
    return;
  }

  userStates.set(Number(ctx.from.id), {
    type: 'awaitingComplaintDescription',
    payload: { lineId, sip: null },
  });

  const responseText = t(language, 'complaintLineChosen', {
    lineTitle: line?.title,
    lineId,
  });

  await ctx.answerCbQuery('✅');
  try {
    await ctx.editMessageText(responseText);
  } catch (error) {
    await ctx.reply(responseText);
  }
});

bot.action(/^complaintSip:([^:]+):(.+)$/i, async (ctx) => {
  if (isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery();
    return;
  }

  if (await isStopWork(ctx)) {
    await ctx.answerCbQuery('🚧');
    clearUserState(ctx.from.id);
    return;
  }

  const lineId = decodeCallbackComponent(ctx.match[1]);
  const sip = decodeCallbackComponent(ctx.match[2]);
  const user = await repository.getUser(ctx.from.id);
  const language = getUserLanguage(user);

  if (!user || !user.lineIds.includes(lineId)) {
    await ctx.answerCbQuery(t(language, 'noAccessLine'), { show_alert: true });
    return;
  }

  const line = await repository.getLine(lineId);

  if (!line) {
    await ctx.answerCbQuery(t(language, 'lineMissing'), { show_alert: true });
    return;
  }

  const sipOptions = getSipOptions(line);

  if (!sipOptions.includes(sip)) {
    await ctx.answerCbQuery(t(language, 'complaintSipInvalid'), { show_alert: true });
    return;
  }

  userStates.set(Number(ctx.from.id), {
    type: 'awaitingComplaintDescription',
    payload: { lineId, sip },
  });

  const responseText = t(language, 'complaintSipChosen', {
    sip,
    lineTitle: line.title,
    lineId: line.id,
  });

  await ctx.answerCbQuery('✅');
  try {
    await ctx.editMessageText(responseText);
  } catch (error) {
    await ctx.reply(responseText);
  }
});

bot.action(/^complaintBack:(.+)$/i, async (ctx) => {
  if (isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery();
    return;
  }

  const user = await repository.getUser(ctx.from.id);
  const language = getUserLanguage(user);

  if (!user || user.status !== 'active') {
    await ctx.answerCbQuery();
    return;
  }

  clearUserState(ctx.from.id);

  await ctx.answerCbQuery();
  await sendComplaintLineMenu(ctx, user, language, { edit: true });
});
"""

text = text.replace(old_block, new_block, 1)
path.write_text(text, encoding='utf-8')

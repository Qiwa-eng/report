const { Telegraf, Markup } = require('telegraf');
const { getConfig } = require('./config');
const repository = require('./repository');

const config = getConfig();
const bot = new Telegraf(config.botToken);

const userStates = new Map();
const adminStates = new Map();

let crocoStickerIds = null;
let crocoStickerPromise = null;

function isNil(value) {
  return value === null || value === undefined;
}

function getNestedValue(source, path) {
  if (isNil(source)) {
    return undefined;
  }

  const keys = Array.isArray(path) ? path : String(path).split('.');
  let result = source;

  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];

    if (isNil(result)) {
      return undefined;
    }

    result = result[key];
  }

  return result;
}

function coalesce(value, fallback) {
  return isNil(value) ? fallback : value;
}

const LANGUAGE_NAMES = {
  ru: 'Русский',
  en: 'English',
};

const LOCALE_BY_LANGUAGE = {
  ru: 'ru-RU',
  en: 'en-US',
};

const translations = {
  ru: {
    mainMenuPrompt: '✨ Выберите действие в меню ниже.',
    complaintButton: '🆘 Жалоба',
    settingsButton: '⚙️ Настройки',
    complaintChooseLine: '📞 Выберите линию, на которую хотите пожаловаться:',
    complaintLineChosen: ({ lineTitle, lineId }) =>
      [
        '🔎 Линия выбрана!',
        `📞 Линия: ${lineTitle || lineId}`,
        '',
        '📝 Опишите проблему одним сообщением 👇',
      ].join('\n'),
    complaintSent: '✅ Жалоба отправлена! Спасибо за обратную связь 🙏',
    complaintError: '⚠️ Не удалось отправить жалобу. Сообщите администратору.',
    notActive: '⏳ Ваша заявка ещё на рассмотрении. Ждите решения, пожалуйста.',
    notLinked: '🔗 Вы пока не привязаны ни к одной линии. Напишите администратору.',
    banned: '⛔️ Доступ заблокирован. Обратитесь к администратору.',
    pendingApplied: '📝 Ваша заявка отправлена на модерацию. Ожидайте ответа 💬',
    alreadyPending: '📝 Ваша заявка уже в обработке. Ожидайте, пожалуйста.',
    languagePrompt: '🌐 Выберите язык интерфейса / Choose your interface language:',
    languageReminder:
      '🌐 Пожалуйста, выберите язык с помощью кнопок ниже.\n🌍 Please choose a language using the buttons below.',
    languageConfirmed: ({ languageName }) => `✅ Язык интерфейса: ${languageName}!`,
    stopWork: ({ until, message }) =>
      `🚧 ${message}${until ? `\n🗓 Доступ откроется после: ${until}` : ''}`,
    adminPanel: '📋 Панель администратора.',
    adminUseMenu: '🛠 Используйте /admin для панели.',
    noAccessLine: '🚫 Нет доступа к указанной линии.',
    lineNotConfigured: '⚠️ Для этой линии не настроена группа логов. Жалоба не отправлена.',
    lineMissing: '❗️ Линия не найдена. Свяжитесь с администратором.',
    muteActive: ({ until }) => `🔇 Вы временно не можете отправлять сообщения. Мут до: ${until}`,
    muteActiveComplaints: ({ until }) =>
      `🔇 Вы временно не можете отправлять жалобы. Мут до: ${until}`,
    applicationDeclinedUser:
      '❌ Ваша заявка отклонена. Свяжитесь с администратором для уточнения.',
    applicationApprovedUser: ({ lineTitle, lineId }) =>
      `🎉 Ваша заявка одобрена! Вы привязаны к линии ${lineTitle || lineId}.`,
    applicationApprovedAdmin: ({ lineTitle, lineId }) =>
      `✅ Пользователь привязан к линии ${lineTitle || lineId}.`,
    languageSelectionSent: '🌐 Отправлена просьба выбрать язык.',
    selectLineManualHint: '🔢 Введите ID линии для пользователя.',
    linesListEmpty: '📭 Линии ещё не созданы.',
    usersListEmpty: '📭 Пользователей пока нет.',
    adminUsersStatusUpdated: '✅ Статус пользователя обновлён.',
    adminUsersStatusUnchanged: 'ℹ️ Статус уже установлен.',
    adminUsersMuteUpdated: ({ hours }) => `🔇 Мут установлен на ${hours} ч.`,
    adminUsersMuteCleared: '🔊 Мут снят.',
    adminUsersMuteAlreadyCleared: 'ℹ️ Мут не активен.',
    adminUsersNotFound: 'Пользователь не найден.',
    stopWorkActivated: '🚧 Стоп-ворк активирован.',
    stopWorkDisabled: '✅ Стоп-ворк отключён.',
    muteRemoved: ({ userId }) => `🔊 Мут для пользователя ${userId} снят.`,
    muted: ({ userId, hours }) => `🔇 Пользователь ${userId} замьючен на ${hours} ч.`,
    bannedUser: ({ userId }) => `⛔️ Пользователь ${userId} забанен.`,
    adminSettingsTitle: '⚙️ Настройки администратора.',
    adminSettingsStopWorkMessageButton: '✏️ Сообщение стоп-ворка',
    adminSettingsShowConfigButton: '📄 Текущая конфигурация',
    adminSettingsStopWorkMessagePrompt:
      '💬 Отправьте текст сообщения стоп-ворка по умолчанию. Чтобы сбросить, отправьте "-".',
    adminSettingsStopWorkMessageUpdated:
      '✅ Сообщение стоп-ворка по умолчанию обновлено.',
    adminSettingsStopWorkMessageCurrent: ({ message }) =>
      `ℹ️ Текущее сообщение: ${message || '—'}`,
    adminSettingsConfig: ({ stopWorkActive, stopWorkUntil, stopWorkMessage, defaultMessage }) =>
      [
        '⚙️ Текущие настройки:',
        `🚧 Стоп-ворк: ${stopWorkActive ? 'активен' : 'выключен'}`,
        `🗓 До: ${stopWorkUntil || '—'}`,
        `💬 Сообщение стоп-ворка: ${stopWorkMessage || '—'}`,
        `💬 Сообщение по умолчанию: ${defaultMessage || '—'}`,
      ].join('\n'),
    attachedUser: ({ userLabel, lineTitle, lineId }) =>
      `🔗 ${userLabel} привязан к линии ${lineTitle || lineId}.`,
    detachedUser: ({ userId, lineId }) => `✂️ Пользователь ${userId} отвязан от линии ${lineId}.`,
    lineGroupSet: ({ lineTitle, groupId }) =>
      `📡 Для линии ${lineTitle} установлен чат ${groupId}.`,
    lineCreated: ({ lineTitle, lineId }) => `🆕 Линия ${lineTitle || lineId} создана.`,
    complainLogTitle: ({ userLabel, lineTitle, lineId }) =>
      `🚨 Жалоба от ${userLabel}\n📞 Линия: ${lineTitle || lineId}`,
    complainLogSip: ({ sip }) => `📟 SIP: ${sip}`,
    complainLogMessageLabel: '📝 Сообщение:',
    complaintLogResolveButton: '✅ Решено',
    complaintLogCancelButton: '❌ Отменить',
    complaintLogResolvedNote: ({ userLabel }) =>
      `✅ Решено администратором: ${userLabel}`,
    complaintLogCancelledNote: ({ userLabel }) =>
      `❌ Отменено администратором: ${userLabel}`,
    complaintLogStatusUpdated: '✅ Статус жалобы обновлён.',
    complaintLogStatusAlreadySet: 'ℹ️ Статус уже установлен.',
    complaintLogNoAccess: '🚫 Нет доступа.',
    complaintPrompt: '📞 Выберите линию, чтобы оставить жалобу:',
    backButton: '⬅️ Назад',
    settingsPrompt: '⚙️ Настройки. Выберите действие ниже:',
    settingsChangeLanguageOption: '🌐 Сменить язык',
    settingsInstructionsOption: '📘 Инструкция',
    settingsInstructions:
      [
        'ℹ️ Как оставить жалобу:',
        '1️⃣ Нажмите «🆘 Жалоба».',
        '2️⃣ Выберите линию и, если требуется, конкретный номер.',
        '3️⃣ Опишите проблему одним сообщением — администраторы получат его в рабочем чате.',
        '',
        'Также в разделе настроек вы всегда можете сменить язык интерфейса.',
      ].join('\n'),
    complaintCancelButton: '❌ Отмена',
    complaintCancelled: '✅ Жалоба отменена. Возвращаем вас в главное меню.',
    coldButton: '❄️ Холодки',
    coldInstructions:
      'Подключаете сюда холодку, и она может жаловаться сама, без вашей помощи.\nДля холодки будет только выбор языка и жалоба.',
    coldNoProfiles: '❄️ Пока нет настроенных холодок. Обратитесь к администратору.',
    coldListTitle: '📋 Подключённые холодки:',
    coldProfileStatusPending: '⏳ ждёт подключения',
    coldProfileStatusActive: '✅ подключена',
    coldSetupTitle: '❄️ Настройка холодки.',
    coldSetupMenuPrompt: 'Выберите действие ниже:',
    coldSetupAddButton: '➕ Подключить холодку',
    coldSetupManageButton: '⚙️ Настроить',
    coldSetupRemoveButton: '🗑 Отключить',
    coldProfileDetails: ({ username, lineTitle, lineId, sip, status }) =>
      [
        `❄️ ${username}`,
        `📞 Линия: ${lineTitle || lineId}`,
        `📟 SIP: ${sip}`,
        `📊 Статус: ${status}`,
      ].join('\n'),
    coldSetupChooseLine: 'Выберите линию для холодки:',
    coldSetupNoLines: 'У вас нет привязанных линий для холодки.',
    coldSetupChooseSip: ({ lineTitle, lineId }) =>
      `Выберите SIP номер для ${lineTitle || lineId}:`,
    coldSetupSipManualButton: '✏️ Ввести SIP вручную',
    coldSetupEnterSip: ({ lineTitle, lineId }) =>
      `Отправьте SIP номер для ${lineTitle || lineId}.`,
    coldSetupEnterUsername:
      'Отправьте @username холодки. Пример: @example.',
    coldSetupInvalidUsername:
      'Пожалуйста, отправьте корректный username (например, @example).',
    coldSetupInvalidSip: 'Пожалуйста, отправьте корректный SIP номер.',
    coldSetupSaved: ({ username, lineTitle, lineId, sip }) =>
      [
        '✅ Холодка сохранена.',
        `👤 Username: ${username}`,
        `📞 Линия: ${lineTitle || lineId}`,
        `📟 SIP: ${sip}`,
        '🚀 Передайте этому аккаунту запустить бота, чтобы завершить подключение.',
      ].join('\n'),
    coldSetupUsernameInUse: 'Этот username уже используется для другой холодки.',
    coldSetupCancelled: '❌ Настройка холодки отменена.',
    coldRemoved: '🗑 Холодка отключена.',
    coldSetupCancelButton: '❌ Отмена',
    coldRemoveConfirm: 'Вы уверены, что хотите отключить эту холодку?',
    coldRemoveConfirmButton: '✅ Отключить',
    complaintChooseSip: ({ lineTitle, lineId }) =>
      `📟 Выберите конкретный номер из диапазона ${lineTitle || lineId}`,
    complaintSipReminder:
      '📟 Пожалуйста, выберите конкретный номер с помощью кнопок ниже.',
    complaintSipChosen: ({ sip, lineTitle, lineId }) =>
      [
        '🎉 Номер выбран!',
        `📟 ${sip}`,
        `📞 Линия: ${lineTitle || lineId}`,
        '',
        '📝 Опишите проблему одним сообщением 👇',
      ].join('\n'),
    complaintSipInvalid: '⚠️ Выберите номер из списка.',
    complaintDescriptionReminder:
      '💬 Отправьте текст жалобы одним сообщением или нажмите «❌ Отмена».',
    coldAdminChooseLine: 'Выберите линию для холодки:',
    coldAdminNoLines: 'У пользователя нет привязанных линий.',
    coldAdminUploadPrompt:
      'Загрузите холодок в формате username;сип. Можно отправить несколько строк — каждая новая строка = отдельная холодка.',
    coldAdminUploadInvalid:
      '⚠️ Не удалось распознать ни одной записи. Используйте формат username;сип.',
    coldAdminUploadSuccess: ({ processed, created, updated }) =>
      `✅ Холодки обновлены. Обработано: ${processed}. Новых: ${created}. Обновлено: ${updated}.`,
    pendingApplicationsList: ({ items }) => `📥 Ожидающие заявки\n${items.join('\n')}`,
    pendingApplicationsEmpty: '✨ Нет активных заявок.',
    userListFooter: ({ count }) => `\n... и ещё ${count}`,
    stats: ({ totalUsers, activeUsers, bannedUsers, totalLines, pending }) =>
      [
        `👥 Всего пользователей: ${totalUsers}`,
        `🟢 Активных: ${activeUsers}`,
        `⛔️ Забаненных: ${bannedUsers}`,
        `📞 Всего линий: ${totalLines}`,
        `⏳ Ожидающих заявок: ${pending}`,
      ].join('\n'),
    sipStatsTitle: '📈 Статистика SIPов:',
    sipStatsRow: ({ lineTitle, lineId, sip, total, resolved, cancelled }) =>
      `• ${lineTitle || lineId} • SIP ${sip} — всего ${total}, решено ${resolved}, отклонено ${cancelled}`,
    sipStatsEmpty: '📭 Пока нет жалоб с SIP номерами.',
    stopWorkStatus: ({ active, until, message }) =>
      `🚧 Стоп-ворк: ${active ? 'активен' : 'выключен'}${until ? `\n🗓 До: ${until}` : ''}${
        message ? `\n💬 Сообщение: ${message}` : ''
      }`,
    waitingForLineIdFormat: 'ℹ️ Укажите ID линии. Пример: 101;Support',
    attachUserFormat: 'ℹ️ Формат: userId;lineId',
    setGroupFormat: 'ℹ️ Формат: lineId;chatId. Можно переслать сообщение из группы.',
    banPrompt: '🔢 Отправьте userId для бана.',
    mutePrompt: '🔢 Отправьте userId и часы мута через точку с запятой (пример: 12345;2).',
    unmutePrompt: '🔢 Отправьте userId;0 чтобы снять мут.',
    stopWorkPrompt:
      '🕒 Отправьте дату и текст: YYYY-MM-DD HH:MM;Сообщение (дата опциональна).',
    adminAwaitLineId: ({ userLabel }) => `🔢 Введите ID линии для пользователя ${userLabel}.`,
    applicationDeclinedAdmin: ({ userLabel }) => `❌ Заявка отклонена: ${userLabel}`,
    applicationDeclinedCb: '❌ Заявка отклонена',
    applicationConfirmCb: '✍️ Введите ID линии в чате',
    applicationDeclineAlert: '❌ Заявка отклонена',
    applicationNotFound: 'Заявка не найдена',
    userNotFound: 'Пользователь не найден. Нажмите /start.',
    genericError: '⚠️ Произошла ошибка. Попробуйте позже.',
    menuReminder: '🔁 Используйте кнопки меню.',
  },
  en: {
    mainMenuPrompt: '✨ Choose an option from the menu below.',
    complaintButton: '🆘 Complaint',
    settingsButton: '⚙️ Settings',
    complaintChooseLine: '📞 Choose a line to report:',
    complaintLineChosen: ({ lineTitle, lineId }) =>
      `🔎 Line ${lineTitle || lineId} selected! Describe the issue in one message 👇`,
    complaintSent: '✅ Complaint sent! Thank you for the feedback 🙏',
    complaintError: '⚠️ Failed to send the complaint. Please notify an admin.',
    notActive: '⏳ Your application is still under review. Please wait.',
    notLinked: '🔗 You are not linked to any line yet. Contact an admin.',
    banned: '⛔️ Access denied. Contact an administrator.',
    pendingApplied: '📝 Your application was submitted for moderation. Please wait 💬',
    alreadyPending: '📝 Your application is already being processed. Please wait.',
    languagePrompt: '🌐 Choose your interface language:',
    languageReminder: '🌐 Please pick a language using the buttons below.',
    languageConfirmed: ({ languageName }) => `✅ Interface language set to ${languageName}!`,
    stopWork: ({ until, message }) =>
      `🚧 ${message}${until ? `\n🗓 Access will open after: ${until}` : ''}`,
    adminPanel: '📋 Admin panel.',
    adminUseMenu: '🛠 Use /admin to open the panel.',
    noAccessLine: '🚫 You have no access to that line.',
    lineNotConfigured: '⚠️ This line has no log group configured. Complaint not sent.',
    lineMissing: '❗️ Line not found. Contact an administrator.',
    muteActive: ({ until }) => `🔇 You are muted until: ${until}`,
    muteActiveComplaints: ({ until }) =>
      `🔇 You cannot submit complaints while muted. Until: ${until}`,
    applicationDeclinedUser:
      '❌ Your application was declined. Contact an administrator for details.',
    applicationApprovedUser: ({ lineTitle, lineId }) =>
      `🎉 Your application is approved! You are linked to the line ${lineTitle || lineId}.`,
    applicationApprovedAdmin: ({ lineTitle, lineId }) =>
      `✅ User linked to ${lineTitle || lineId}.`,
    languageSelectionSent: '🌐 Language selection prompt sent.',
    selectLineManualHint: '🔢 Enter the line ID for the user.',
    linesListEmpty: '📭 No lines created yet.',
    usersListEmpty: '📭 No users yet.',
    adminUsersStatusUpdated: '✅ User status updated.',
    adminUsersStatusUnchanged: 'ℹ️ Status is already set.',
    adminUsersMuteUpdated: ({ hours }) => `🔇 Mute applied for ${hours}h.`,
    adminUsersMuteCleared: '🔊 Mute removed.',
    adminUsersMuteAlreadyCleared: 'ℹ️ No active mute.',
    adminUsersNotFound: 'User not found.',
    stopWorkActivated: '🚧 Stop-work mode activated.',
    stopWorkDisabled: '✅ Stop-work disabled.',
    muteRemoved: ({ userId }) => `🔊 Mute removed for user ${userId}.`,
    muted: ({ userId, hours }) => `🔇 User ${userId} muted for ${hours}h.`,
    bannedUser: ({ userId }) => `⛔️ User ${userId} banned.`,
    adminSettingsTitle: '⚙️ Administrator settings.',
    adminSettingsStopWorkMessageButton: '✏️ Stop-work message',
    adminSettingsShowConfigButton: '📄 Current configuration',
    adminSettingsStopWorkMessagePrompt:
      '💬 Send the default stop-work message text. Send "-" to reset.',
    adminSettingsStopWorkMessageUpdated: '✅ Default stop-work message updated.',
    adminSettingsStopWorkMessageCurrent: ({ message }) =>
      `ℹ️ Current message: ${message || '—'}`,
    adminSettingsConfig: ({ stopWorkActive, stopWorkUntil, stopWorkMessage, defaultMessage }) =>
      [
        '⚙️ Current configuration:',
        `🚧 Stop-work: ${stopWorkActive ? 'enabled' : 'disabled'}`,
        `🗓 Until: ${stopWorkUntil || '—'}`,
        `💬 Stop-work message: ${stopWorkMessage || '—'}`,
        `💬 Default message: ${defaultMessage || '—'}`,
      ].join('\n'),
    attachedUser: ({ userLabel, lineTitle, lineId }) =>
      `🔗 ${userLabel} linked to ${lineTitle || lineId}.`,
    detachedUser: ({ userId, lineId }) => `✂️ User ${userId} unlinked from ${lineId}.`,
    lineGroupSet: ({ lineTitle, groupId }) =>
      `📡 Chat ${groupId} assigned to line ${lineTitle}.`,
    lineCreated: ({ lineTitle, lineId }) => `🆕 Line ${lineTitle || lineId} created.`,
    complainLogTitle: ({ userLabel, lineTitle, lineId }) =>
      `🚨 Complaint from ${userLabel}\n📞 Line: ${lineTitle || lineId}`,
    complainLogSip: ({ sip }) => `📟 SIP: ${sip}`,
    complainLogMessageLabel: '📝 Message:',
    complaintLogResolveButton: '✅ Resolved',
    complaintLogCancelButton: '❌ Cancel',
    complaintLogResolvedNote: ({ userLabel }) => `✅ Resolved by: ${userLabel}`,
    complaintLogCancelledNote: ({ userLabel }) => `❌ Cancelled by: ${userLabel}`,
    complaintLogStatusUpdated: '✅ Complaint status updated.',
    complaintLogStatusAlreadySet: 'ℹ️ Status already set.',
    complaintLogNoAccess: '🚫 Access denied.',
    complaintPrompt: '📞 Choose a line for your complaint:',
    backButton: '⬅️ Back',
    settingsPrompt: '⚙️ Settings. Pick an option below:',
    settingsChangeLanguageOption: '🌐 Change language',
    settingsInstructionsOption: '📘 How it works',
    settingsInstructions:
      [
        'ℹ️ How to submit a complaint:',
        '1️⃣ Tap “🆘 Complaint”.',
        '2️⃣ Choose the line and, if needed, a specific number.',
        '3️⃣ Describe the issue in one message — admins will receive it in the log chat.',
        '',
        'You can always switch the interface language from the settings menu.',
      ].join('\n'),
    complaintCancelButton: '❌ Cancel',
    complaintCancelled: '✅ Complaint cancelled. Back to the main menu.',
    coldButton: '❄️ Cold agents',
    coldInstructions:
      'Connect your cold agent here so it can complain automatically without your help.\nA cold agent will only see the language selector and the complaint action.',
    coldNoProfiles: '❄️ No cold agents configured yet. Ask an administrator.',
    coldListTitle: '📋 Connected cold agents:',
    coldProfileStatusPending: '⏳ waiting to connect',
    coldProfileStatusActive: '✅ connected',
    coldSetupTitle: '❄️ Cold agent setup.',
    coldSetupMenuPrompt: 'Choose an action below:',
    coldSetupAddButton: '➕ Add cold agent',
    coldSetupManageButton: '⚙️ Configure',
    coldSetupRemoveButton: '🗑 Remove',
    coldProfileDetails: ({ username, lineTitle, lineId, sip, status }) =>
      [
        `❄️ ${username}`,
        `📞 Line: ${lineTitle || lineId}`,
        `📟 SIP: ${sip}`,
        `📊 Status: ${status}`,
      ].join('\n'),
    coldSetupChooseLine: 'Choose a line for the cold agent:',
    coldSetupNoLines: 'You have no linked lines for a cold agent.',
    coldSetupChooseSip: ({ lineTitle, lineId }) =>
      `Pick a SIP number for ${lineTitle || lineId}:`,
    coldSetupSipManualButton: '✏️ Enter SIP manually',
    coldSetupEnterSip: ({ lineTitle, lineId }) =>
      `Send the SIP number for ${lineTitle || lineId}.`,
    coldSetupEnterUsername:
      'Send the cold agent @username. Example: @example.',
    coldSetupInvalidUsername:
      'Please send a valid username (for example, @example).',
    coldSetupInvalidSip: 'Please send a valid SIP number.',
    coldSetupSaved: ({ username, lineTitle, lineId, sip }) =>
      [
        '✅ Cold agent saved.',
        `👤 Username: ${username}`,
        `📞 Line: ${lineTitle || lineId}`,
        `📟 SIP: ${sip}`,
        '🚀 Ask this account to start the bot to finish the setup.',
      ].join('\n'),
    coldSetupUsernameInUse: 'This username is already used by another cold agent.',
    coldSetupCancelled: '❌ Cold agent setup cancelled.',
    coldRemoved: '🗑 Cold agent removed.',
    coldSetupCancelButton: '❌ Cancel',
    coldRemoveConfirm: 'Are you sure you want to remove this cold agent?',
    coldRemoveConfirmButton: '✅ Remove',
    complaintChooseSip: ({ lineTitle, lineId }) =>
      `📟 Pick a specific number from ${lineTitle || lineId}`,
    complaintSipReminder: '📟 Please pick a specific number using the buttons below.',
    complaintSipChosen: ({ sip, lineTitle, lineId }) =>
      `🎉 Number ${sip} selected for ${lineTitle || lineId}! Describe the issue in one message 👇`,
    complaintSipInvalid: '⚠️ Please choose a number from the list.',
    complaintDescriptionReminder:
      '💬 Please send your complaint text in a single message or tap “❌ Cancel”.',
    coldAdminChooseLine: 'Choose a line for the cold agent:',
    coldAdminNoLines: 'The user has no linked lines.',
    coldAdminUploadPrompt:
      'Upload cold agents in the format username;sip. You can send several lines — one per cold agent.',
    coldAdminUploadInvalid:
      '⚠️ No entries recognised. Please use the format username;sip.',
    coldAdminUploadSuccess: ({ processed, created, updated }) =>
      `✅ Cold agents updated. Processed: ${processed}. New: ${created}. Updated: ${updated}.`,
    pendingApplicationsList: ({ items }) => `📥 Pending applications\n${items.join('\n')}`,
    pendingApplicationsEmpty: '✨ No pending applications.',
    userListFooter: ({ count }) => `\n... plus ${count} more`,
    stats: ({ totalUsers, activeUsers, bannedUsers, totalLines, pending }) =>
      [
        `👥 Total users: ${totalUsers}`,
        `🟢 Active: ${activeUsers}`,
        `⛔️ Banned: ${bannedUsers}`,
        `📞 Lines: ${totalLines}`,
        `⏳ Pending apps: ${pending}`,
      ].join('\n'),
    sipStatsTitle: '📈 SIP statistics:',
    sipStatsRow: ({ lineTitle, lineId, sip, total, resolved, cancelled }) =>
      `• ${lineTitle || lineId} • SIP ${sip} — total ${total}, resolved ${resolved}, declined ${cancelled}`,
    sipStatsEmpty: '📭 No SIP complaints yet.',
    stopWorkStatus: ({ active, until, message }) =>
      `🚧 Stop-work: ${active ? 'enabled' : 'disabled'}${until ? `\n🗓 Until: ${until}` : ''}${
        message ? `\n💬 Message: ${message}` : ''
      }`,
    waitingForLineIdFormat: 'ℹ️ Provide the line ID. Example: 101;Support',
    attachUserFormat: 'ℹ️ Format: userId;lineId',
    setGroupFormat: 'ℹ️ Format: lineId;chatId. You can forward a message from the target group.',
    banPrompt: '🔢 Send the userId to ban.',
    mutePrompt: '🔢 Send userId;hours to mute (e.g. 12345;2).',
    unmutePrompt: '🔢 Send userId;0 to remove mute.',
    stopWorkPrompt: '🕒 Send: YYYY-MM-DD HH:MM;Message (date optional).',
    adminAwaitLineId: ({ userLabel }) => `🔢 Enter the line ID for ${userLabel}.`,
    applicationDeclinedAdmin: ({ userLabel }) => `❌ Application declined: ${userLabel}`,
    applicationDeclinedCb: '❌ Application declined',
    applicationConfirmCb: '✍️ Enter the line ID in chat',
    applicationDeclineAlert: '❌ Application declined',
    applicationNotFound: 'Application not found',
    userNotFound: 'User not found. Use /start.',
    genericError: '⚠️ An error occurred. Try again later.',
    menuReminder: '🔁 Use the menu buttons.',
  },
};

const COMPLAINT_STATUS_MARKERS = {
  resolved: ['✅ Решено', '✅ Resolved'],
  cancelled: ['❌ Отменено', '❌ Cancelled'],
};

const USERS_PAGE_SIZE = 8;

const USER_STATUS_LABELS = {
  active: 'Активен',
  pending: 'На модерации',
  banned: 'Забанен',
  declined: 'Отклонён',
};

const USER_STATUS_ICONS = {
  active: '🟢',
  pending: '⏳',
  banned: '⛔️',
  declined: '❌',
};

const APPLICATION_STATUS_LABELS = {
  pending: '⏳ На модерации',
  approved: '✅ Подтверждена',
  declined: '❌ Отклонена',
};

const MAX_SIP_OPTIONS = 25;
const NEW_COLD_PROFILE_KEY = 'new';

function normalizeColdUsername(value) {
  if (!value) {
    return '';
  }

  return String(value).trim().replace(/^@+/, '').toLowerCase();
}

function encodeColdProfileKey(profileId) {
  return encodeCallbackComponent(profileId || NEW_COLD_PROFILE_KEY);
}

function decodeColdProfileKey(value) {
  const decoded = decodeCallbackComponent(value);
  return decoded === NEW_COLD_PROFILE_KEY ? null : decoded;
}

function encodeCallbackComponent(value) {
  return encodeURIComponent(String(value));
}

function decodeCallbackComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
}

function chunk(array, size) {
  const result = [];
  for (let index = 0; index < array.length; index += size) {
    result.push(array.slice(index, index + size));
  }
  return result;
}

function parseSipRange(value) {
  if (!value) {
    return [];
  }

  const matches = [...String(value).matchAll(/(\d{2,})\s*[-–—]\s*(\d{2,})/g)];

  for (const match of matches) {
    const start = Number(match[1]);
    const end = Number(match[2]);

    if (
      Number.isFinite(start) &&
      Number.isFinite(end) &&
      end >= start &&
      end - start + 1 <= MAX_SIP_OPTIONS
    ) {
      const options = [];
      for (let cursor = start; cursor <= end; cursor += 1) {
        options.push(String(cursor));
      }
      if (options.length) {
        return options;
      }
    }
  }

  return [];
}

function getSipOptions(line) {
  if (!line) {
    return [];
  }

  const sources = [line.title, line.id];
  for (const source of sources) {
    const options = parseSipRange(source);
    if (options.length) {
      return options;
    }
  }

  return [];
}

function formatLineButtonLabel(line) {
  if (line.title && line.title !== line.id) {
    return `📞 ${line.title} • #${line.id}`;
  }
  return `📞 ${line.id}`;
}

function buildSipKeyboard(line, options, language) {
  const rows = chunk(options, 3).map((group) =>
    group.map((sip) =>
      Markup.callbackButton(
        `☎️ ${sip}`,
        `complaintSip:${encodeCallbackComponent(line.id)}:${encodeCallbackComponent(sip)}`
      )
    )
  );

  rows.push([
    Markup.callbackButton(
      t(language, 'backButton'),
      `complaintBack:${encodeCallbackComponent(line.id)}`
    ),
    Markup.callbackButton(t(language, 'complaintCancelButton'), 'complaintCancel'),
  ]);

  return Markup.inlineKeyboard(rows).extra();
}

async function sendComplaintLineMenu(ctx, user, language, { edit = false } = {}) {
  const lines = await repository.getLines();
  const userLines = lines.filter((line) => user.lineIds.includes(line.id));

  if (!userLines.length) {
    await ctx.reply(t(language, 'notLinked'));
    return;
  }

  const keyboardRows = userLines.map((line) => [
    Markup.callbackButton(
      formatLineButtonLabel(line),
      `complaint:${encodeCallbackComponent(line.id)}`
    ),
  ]);

  keyboardRows.push([Markup.callbackButton(t(language, 'complaintCancelButton'), 'complaintCancel')]);

  const keyboard = Markup.inlineKeyboard(keyboardRows).extra();

  const text = t(language, 'complaintPrompt');

  if (edit) {
    try {
      await ctx.editMessageText(text, keyboard);
    } catch (error) {
      await ctx.reply(text, keyboard);
    }
    return;
  }

  await ctx.reply(text, keyboard);
}

const LANGUAGE_CODES = Object.keys(LANGUAGE_NAMES);

function ensureLanguage(code) {
  return LANGUAGE_CODES.includes(code) ? code : 'ru';
}

function getUserLanguage(user) {
  return ensureLanguage(getNestedValue(user, 'language'));
}

function t(language, key, params = {}) {
  const code = ensureLanguage(language);
  const value = coalesce(translations[code][key], translations.ru[key]);
  if (typeof value === 'function') {
    return value(params);
  }
  return value;
}

function formatDateForLanguage(isoString, language) {
  if (!isoString) {
    return null;
  }
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleString(LOCALE_BY_LANGUAGE[language] || LOCALE_BY_LANGUAGE.ru);
}

async function loadCrocoStickerIds() {
  if (crocoStickerIds) {
    return crocoStickerIds;
  }

  if (crocoStickerPromise) {
    return crocoStickerPromise;
  }

  crocoStickerPromise = bot.telegram
    .getStickerSet('Crocosaurus')
    .then((set) => {
      const stickers = getNestedValue(set, 'stickers');
      if (!Array.isArray(stickers)) {
        return [];
      }
      return stickers.map((item) => item.file_id);
    })
    .catch((error) => {
      console.error('Failed to load Crocosaurus stickers', error);
      return [];
    })
    .then((stickers) => {
      crocoStickerIds = stickers;
      return stickers;
    })
    .finally(() => {
      crocoStickerPromise = null;
    });

  return crocoStickerPromise;
}

async function sendRandomCrocoSticker(ctx) {
  try {
    const stickers = await loadCrocoStickerIds();
    if (!stickers.length) {
      return;
    }

    const randomIndex = Math.floor(Math.random() * stickers.length);
    const stickerId = stickers[randomIndex];
    await ctx.replyWithSticker(stickerId);
  } catch (error) {
    console.error('Failed to send Crocosaurus sticker', error);
  }
}

function userKeyboard(language, { showColdButton = false } = {}) {
  const rows = [[{ text: t(language, 'complaintButton') }]];

  if (showColdButton) {
    rows.push([{ text: t(language, 'coldButton') }]);
  }

  rows.push([{ text: t(language, 'settingsButton') }]);
  return Markup.keyboard(rows).resize().extra();
}

function userSettingsKeyboard(language) {
  return Markup.inlineKeyboard([
    [
      Markup.callbackButton(
        t(language, 'settingsChangeLanguageOption'),
        'settings:language'
      ),
    ],
    [
      Markup.callbackButton(
        t(language, 'settingsInstructionsOption'),
        'settings:instructions'
      ),
    ],
  ]).extra();
}

function settingsInstructionsKeyboard(language) {
  return Markup.inlineKeyboard([
    [Markup.callbackButton(t(language, 'backButton'), 'settings:menu')],
  ]).extra();
}

function buildComplaintLogKeyboard(complaintId, fallbackUserId) {
  const identifier = complaintId
    ? `id:${complaintId}`
    : fallbackUserId !== undefined
      ? `user:${fallbackUserId}`
      : null;

  if (!identifier) {
    return Markup.inlineKeyboard([]).extra();
  }

  return Markup.inlineKeyboard([
    [
      Markup.callbackButton(
        t('ru', 'complaintLogResolveButton'),
        `complaintLog:resolve:${identifier}`
      ),
      Markup.callbackButton(
        t('ru', 'complaintLogCancelButton'),
        `complaintLog:cancel:${identifier}`
      ),
    ],
  ]).extra();
}

async function sendSettingsMenu(ctx, language, { edit = false } = {}) {
  const text = t(language, 'settingsPrompt');
  const keyboard = userSettingsKeyboard(language);

  if (edit) {
    try {
      await ctx.editMessageText(text, keyboard);
      return;
    } catch (error) {
      // Message might be not editable; fall back to a regular reply below.
    }
  }

  await ctx.reply(text, keyboard);
}

async function sendColdOverview(ctx, user, language, { edit = false } = {}) {
  const [profiles, lines] = await Promise.all([
    repository.getColdProfilesByOwner(user.id),
    repository.getLines(),
  ]);

  const lineMap = new Map(lines.map((line) => [line.id, line]));

  const listItems = profiles.map((profile) => {
    const line = lineMap.get(profile.lineId);
    const lineLabel = line ? line.title || line.id : profile.lineId;
    const statusKey = profile.userId
      ? 'coldProfileStatusActive'
      : 'coldProfileStatusPending';
    const status = t(language, statusKey);
    const username = profile.username || `@${profile.normalizedUsername}`;
    return `• ${username} — ${lineLabel}, SIP ${profile.sip} (${status})`;
  });

  const parts = [
    t(language, 'coldSetupTitle'),
    t(language, 'coldSetupMenuPrompt'),
    '',
    t(language, 'coldInstructions'),
  ];

  if (listItems.length) {
    parts.push('', t(language, 'coldListTitle'), ...listItems);
  } else {
    parts.push('', t(language, 'coldNoProfiles'));
  }

  const buttonRows = profiles.map((profile) => {
    const line = lineMap.get(profile.lineId);
    const lineLabel = line ? line.title || line.id : profile.lineId;
    const label = `${t(language, 'coldSetupManageButton')} • ${lineLabel} • SIP ${profile.sip}`;
    return [
      Markup.callbackButton(
        label,
        `cold:profile:${encodeCallbackComponent(profile.id)}`
      ),
    ];
  });

  if (user.lineIds.length) {
    buttonRows.push([
      Markup.callbackButton(t(language, 'coldSetupAddButton'), 'cold:setup:new'),
    ]);
  }

  const keyboard = buttonRows.length
    ? Markup.inlineKeyboard(buttonRows).extra()
    : null;
  const text = parts.join('\n');

  if (edit) {
    await editOrReply(ctx, text, keyboard || undefined);
  } else if (keyboard) {
    await ctx.reply(text, keyboard);
  } else {
    await ctx.reply(text);
  }
}

async function sendColdLineSelection(ctx, user, language, { profileId } = {}) {
  const lines = await repository.getLines();
  const userLines = lines.filter((line) => user.lineIds.includes(line.id));

  if (!userLines.length) {
    await ctx.reply(t(language, 'coldSetupNoLines'));
    return;
  }

  clearUserState(ctx.from.id);

  const profileKey = encodeColdProfileKey(profileId);

  const buttons = userLines.map((line) => [
    Markup.callbackButton(
      formatLineButtonLabel(line),
      `cold:lineSelect:${profileKey}:${encodeCallbackComponent(line.id)}`
    ),
  ]);

  buttons.push([
    Markup.callbackButton(t(language, 'backButton'), 'cold:menu'),
    Markup.callbackButton(t(language, 'coldSetupCancelButton'), 'cold:cancel'),
  ]);

  const keyboard = Markup.inlineKeyboard(buttons).extra();
  const text = t(language, 'coldSetupChooseLine');

  await editOrReply(ctx, text, keyboard);
}

async function promptColdSipInput(ctx, user, language, { profileId, line }) {
  const profileKey = encodeColdProfileKey(profileId);

  userStates.set(Number(ctx.from.id), {
    type: 'awaitingColdSipInput',
    payload: { profileId, lineId: line.id },
  });

  const keyboard = Markup.inlineKeyboard([
    [Markup.callbackButton(t(language, 'backButton'), `cold:lineMenu:${profileKey}`)],
    [Markup.callbackButton(t(language, 'coldSetupCancelButton'), 'cold:cancel')],
  ]).extra();

  const text = t(language, 'coldSetupEnterSip', {
    lineTitle: line.title,
    lineId: line.id,
  });

  await editOrReply(ctx, text, keyboard);
}

async function sendColdSipSelection(ctx, user, language, { profileId, line }) {
  const sipOptions = getSipOptions(line);

  if (!sipOptions.length) {
    await promptColdSipInput(ctx, user, language, { profileId, line });
    return;
  }

  clearUserState(ctx.from.id);

  const profileKey = encodeColdProfileKey(profileId);
  const buttons = chunk(sipOptions, 3).map((group) =>
    group.map((sip) =>
      Markup.callbackButton(
        `☎️ ${sip}`,
        `cold:sipSelect:${profileKey}:${encodeCallbackComponent(line.id)}:${encodeCallbackComponent(sip)}`
      )
    )
  );

  buttons.push([
    Markup.callbackButton(
      t(language, 'coldSetupSipManualButton'),
      `cold:sipManual:${profileKey}:${encodeCallbackComponent(line.id)}`
    ),
  ]);

  buttons.push([
    Markup.callbackButton(t(language, 'backButton'), `cold:lineMenu:${profileKey}`),
    Markup.callbackButton(t(language, 'coldSetupCancelButton'), 'cold:cancel'),
  ]);

  const keyboard = Markup.inlineKeyboard(buttons).extra();
  const text = t(language, 'coldSetupChooseSip', {
    lineTitle: line.title,
    lineId: line.id,
  });

  await editOrReply(ctx, text, keyboard);
}

async function promptColdUsername(ctx, user, language, { profileId, line, sip }) {
  const profileKey = encodeColdProfileKey(profileId);

  userStates.set(Number(ctx.from.id), {
    type: 'awaitingColdUsername',
    payload: { profileId, lineId: line.id, sip },
  });

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.callbackButton(
        t(language, 'backButton'),
        `cold:sipBack:${profileKey}:${encodeCallbackComponent(line.id)}`
      ),
    ],
    [Markup.callbackButton(t(language, 'coldSetupCancelButton'), 'cold:cancel')],
  ]).extra();

  const text = t(language, 'coldSetupEnterUsername');
  await editOrReply(ctx, text, keyboard);
}

async function resolveColdActionUser(ctx) {
  if (isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery();
    return null;
  }

  if (await isStopWork(ctx)) {
    await ctx.answerCbQuery('🚧');
    clearUserState(ctx.from.id);
    return null;
  }

  const user = await repository.getUser(ctx.from.id);

  if (!user) {
    await ctx.answerCbQuery('🚫', { show_alert: true });
    await ctx.reply(t('ru', 'userNotFound'));
    return null;
  }

  const language = getUserLanguage(user);

  if (user.status === 'banned') {
    await ctx.answerCbQuery('🚫', { show_alert: true });
    await ctx.reply(t(language, 'banned'));
    return null;
  }

  if (user.status !== 'active') {
    await ctx.answerCbQuery('🚫', { show_alert: true });
    await ctx.reply(t(language, 'notActive'));
    return null;
  }

  if (!user.language) {
    await ctx.answerCbQuery('🌐', { show_alert: true });
    await promptLanguageSelection(user.id, language);
    return null;
  }

  return { user, language };
}

function languageSelectionKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.callbackButton('🇷🇺 Русский', 'language:ru'),
      Markup.callbackButton('🇬🇧 English', 'language:en'),
    ],
  ]).extra();
}

function adminMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.callbackButton('📥 Заявки', 'admin:applications:list')],
    [Markup.callbackButton('🧭 Линии', 'admin:lines:menu')],
    [Markup.callbackButton('👥 Пользователи', 'admin:users:menu')],
    [Markup.callbackButton('📊 Статистика', 'admin:stats')],
    [Markup.callbackButton('⛔️ Стоп ворк', 'admin:stopwork:menu')],
    [Markup.callbackButton('⚙️ Настройки', 'admin:settings')],
  ]).extra();
}

function adminLinesKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.callbackButton('➕ Создать линию', 'admin:lines:create')],
    [Markup.callbackButton('📜 Список линий', 'admin:lines:list')],
    [Markup.callbackButton('🔗 Привязать пользователя', 'admin:lines:attachUser')],
    [Markup.callbackButton('✂️ Отвязать пользователя', 'admin:lines:detachUser')],
    [Markup.callbackButton('📡 Назначить группу логов', 'admin:lines:setGroup')],
    [Markup.callbackButton('⬅️ Назад', 'admin:back')],
  ]).extra();
}

function adminSettingsKeyboard(language) {
  const code = ensureLanguage(language);
  return Markup.inlineKeyboard([
    [
      Markup.callbackButton(
        t(code, 'adminSettingsStopWorkMessageButton'),
        'admin:settings:stopworkMessage'
      ),
    ],
    [
      Markup.callbackButton(
        t(code, 'adminSettingsShowConfigButton'),
        'admin:settings:show'
      ),
    ],
    [Markup.callbackButton(t(code, 'backButton'), 'admin:back')],
  ]).extra();
}

function adminUsersKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.callbackButton('📋 Список пользователей', 'admin:users:list')],
    [Markup.callbackButton('⛔️ Бан', 'admin:users:ban')],
    [Markup.callbackButton('🔇 Мут', 'admin:users:mute')],
    [Markup.callbackButton('🔊 Снять мут', 'admin:users:unmute')],
    [Markup.callbackButton('⬅️ Назад', 'admin:back')],
  ]).extra();
}

function adminStopWorkKeyboard(active) {
  const buttons = [];
  if (active) {
    buttons.push([Markup.callbackButton('✅ Отключить', 'admin:stopwork:disable')]);
  } else {
    buttons.push([Markup.callbackButton('🚧 Включить', 'admin:stopwork:enable')]);
  }
  buttons.push([Markup.callbackButton('⬅️ Назад', 'admin:back')]);
  return Markup.inlineKeyboard(buttons).extra();
}

function isAdmin(userId) {
  return config.admins.includes(Number(userId));
}

function formatUserLabel(user) {
  const parts = [];
  if (user.username) {
    parts.push(`@${user.username}`);
  }
  if (user.firstName) {
    parts.push(user.firstName);
  }
  if (user.lastName) {
    parts.push(user.lastName);
  }
  parts.push(`ID: ${user.id}`);
  return parts.join(' | ');
}

function formatUserLabelFromContext(from) {
  if (!from) {
    return 'ID: unknown';
  }

  const username = from.username ? `@${from.username}` : null;
  const firstName = from.first_name || from.firstName || null;
  const lastName = from.last_name || from.lastName || null;
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

  const parts = [];
  if (username) {
    parts.push(username);
  }
  if (fullName) {
    parts.push(fullName);
  }
  parts.push(`ID: ${from.id}`);

  return parts.join(' | ');
}

function formatUserButtonLabel(user) {
  const icon = USER_STATUS_ICONS[user.status] || '👤';
  if (user.username) {
    return `${icon} @${user.username}`;
  }

  const fullName = [user.firstName, user.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();

  if (fullName) {
    return `${icon} ${fullName}`;
  }

  return `${icon} ID ${user.id}`;
}

function formatApplicationButtonLabel(application, user) {
  if (user) {
    return `${application.id} • ${formatUserButtonLabel(user)}`;
  }

  return `${application.id} • ID ${application.userId}`;
}

function formatApplicationCard(application, user) {
  const userLabel = formatUserLabel(user || { id: application.userId });
  const userLanguage = getNestedValue(user, 'language');
  const languageLabel = userLanguage
    ? LANGUAGE_NAMES[userLanguage] || userLanguage
    : '—';
  const createdAt = formatDateForLanguage(application.createdAt, 'ru');
  const updatedAt = formatDateForLanguage(application.updatedAt, 'ru');
  const userStatusLabel = user
    ? USER_STATUS_LABELS[user.status] || user.status
    : null;
  const lines = [
    '📄 Заявка на доступ',
    `🆔 ID: ${application.id}`,
    `🙋‍♂️ Пользователь: ${userLabel}`,
    `⏳ Статус заявки: ${
      APPLICATION_STATUS_LABELS[application.status] || application.status
    }`,
  ];

  if (userStatusLabel) {
    lines.push(`👤 Статус пользователя: ${userStatusLabel}`);
  } else {
    lines.push('👤 Пользователь не найден в базе.');
  }

  lines.push(`🌐 Язык: ${languageLabel}`);

  if (user) {
    const lineIds = Array.isArray(user.lineIds) ? user.lineIds : [];
    lines.push(`📞 Линии: ${lineIds.length ? lineIds.join(', ') : '—'}`);
  }

  lines.push(`📅 Создана: ${createdAt || '—'}`);
  lines.push(`🕒 Обновлена: ${updatedAt || '—'}`);

  if (application.comment) {
    lines.push('', `💬 Комментарий: ${application.comment}`);
  }

  return lines.filter(Boolean).join('\n');
}

async function editOrReply(ctx, text, keyboard) {
  try {
    if (keyboard) {
      await ctx.editMessageText(text, keyboard);
    } else {
      await ctx.editMessageText(text);
    }
  } catch (error) {
    const errorDescription = getNestedValue(error, ['response', 'description']);
    if (errorDescription && errorDescription.includes('message is not modified')) {
      return;
    }

    if (keyboard) {
      await ctx.reply(text, keyboard);
    } else {
      await ctx.reply(text);
    }
  }
}

function setAdminState(adminId, state) {
  if (state) {
    adminStates.set(Number(adminId), state);
  } else {
    adminStates.delete(Number(adminId));
  }
}

function clearUserState(userId) {
  userStates.delete(Number(userId));
}

async function notifyAdminsAboutApplication(user, application) {
  const text = [
    '🚨 Новая заявка!',
    `🙋‍♂️ Пользователь: ${formatUserLabel(user)}`,
    `🆔 ID заявки: ${application.id}`,
    '⚙️ Выберите действие:',
  ].join('\n');

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.callbackButton('❌ Отклонить', `application:decline:${application.id}`),
      Markup.callbackButton('✅ Подтвердить', `application:confirm:${application.id}`),
    ],
  ]).extra();

  await Promise.all(
    config.admins.map((adminId) =>
      bot.telegram
        .sendMessage(adminId, text, keyboard)
        .catch(() => undefined)
    )
  );
}

function buildAdminUsersList(users, page = 0) {
  const totalPages = Math.max(1, Math.ceil(users.length / USERS_PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 0), totalPages - 1);
  const start = safePage * USERS_PAGE_SIZE;
  const end = start + USERS_PAGE_SIZE;
  const items = users.slice(start, end);

  const buttons = items.map((user) => [
    Markup.callbackButton(
      `${formatUserButtonLabel(user)} • ${user.id}`,
      `admin:users:view:${user.id}:${safePage}`
    ),
  ]);

  if (totalPages > 1) {
    const navRow = [];
    if (safePage > 0) {
      navRow.push(
        Markup.callbackButton('⬅️ Предыдущие', `admin:users:page:${safePage - 1}`)
      );
    }
    if (safePage < totalPages - 1) {
      navRow.push(
        Markup.callbackButton('Следующие ➡️', `admin:users:page:${safePage + 1}`)
      );
    }
    if (navRow.length) {
      buttons.push(navRow);
    }
  }

  buttons.push([Markup.callbackButton('⬅️ Назад', 'admin:users:menu')]);

  const total = users.length;
  const active = users.filter((item) => item.status === 'active').length;
  const pending = users.filter((item) => item.status === 'pending').length;
  const banned = users.filter((item) => item.status === 'banned').length;
  const declined = users.filter((item) => item.status === 'declined').length;

  const summaryParts = [`Всего: ${total}`, `Активных: ${active}`];
  if (pending) {
    summaryParts.push(`На модерации: ${pending}`);
  }
  if (declined) {
    summaryParts.push(`Отклонено: ${declined}`);
  }
  if (banned) {
    summaryParts.push(`Забанено: ${banned}`);
  }

  const text = [
    `👥 Пользователи (страница ${safePage + 1}/${totalPages})`,
    summaryParts.join(' • '),
  ]
    .filter(Boolean)
    .join('\n');

  return { text, keyboard: Markup.inlineKeyboard(buttons).extra(), page: safePage };
}

function buildAdminUserDetailsKeyboard(user, page, isMuted, options = {}) {
  const { showColdSetupButton = false } = options;
  const statusActiveLabel =
    user.status === 'active' ? '✅ Активен' : '✅ Активировать';
  const statusBannedLabel =
    user.status === 'banned' ? '⛔️ Заблокирован' : '⛔️ Забанить';
  const unmuteLabel = isMuted ? '🔊 Снять мут' : '🔊 Мут отсутствует';

  const rows = [
    [
      Markup.callbackButton(
        statusActiveLabel,
        `admin:users:status:active:${user.id}:${page}`
      ),
      Markup.callbackButton(
        statusBannedLabel,
        `admin:users:status:banned:${user.id}:${page}`
      ),
    ],
    [
      Markup.callbackButton('🔇 Мут 1ч', `admin:users:mute:1:${user.id}:${page}`),
      Markup.callbackButton('🔇 Мут 4ч', `admin:users:mute:4:${user.id}:${page}`),
    ],
    [
      Markup.callbackButton('🔇 Мут 24ч', `admin:users:mute:24:${user.id}:${page}`),
      Markup.callbackButton(unmuteLabel, `admin:users:unmute:${user.id}:${page}`),
    ],
  ];

  if (showColdSetupButton) {
    rows.push([
      Markup.callbackButton(
        '❄️ Настроить холодку',
        `admin:users:cold:menu:${user.id}:${page}`
      ),
    ]);
  }

  rows.push([Markup.callbackButton('⬅️ К списку', `admin:users:page:${page}`)]);

  return Markup.inlineKeyboard(rows).extra();
}

async function renderAdminUsersPage(ctx, page = 0) {
  const users = await repository.getUsers();
  if (!users.length) {
    return false;
  }

  const sortedUsers = [...users].sort((a, b) => {
    const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return bTime - aTime;
  });

  const { text, keyboard } = buildAdminUsersList(sortedUsers, page);
  await editOrReply(ctx, text, keyboard);
  return true;
}

async function renderAdminUserDetails(ctx, userId, page = 0) {
  const user = await repository.getUser(userId);
  if (!user) {
    return false;
  }

  const [lines, coldProfilesOwned, coldProfile] = await Promise.all([
    repository.getLines(),
    repository.getColdProfilesByOwner(user.id),
    repository.getColdProfileByUserId(user.id),
  ]);
  const lineTitles = user.lineIds
    .map((lineId) => {
      const line = lines.find((item) => item.id === lineId);
      return line ? line.title || line.id : lineId;
    })
    .filter(Boolean);

  const muteState = await ensureMuteState(user);
  const muteText = muteState.muted
    ? formatDateForLanguage(muteState.until, 'ru') || muteState.until
    : '—';

  const languageCode = user.language ? ensureLanguage(user.language) : null;
  const languageLabel = languageCode ? LANGUAGE_NAMES[languageCode] : '—';
  const createdAt = formatDateForLanguage(user.createdAt, 'ru');
  const updatedAt = formatDateForLanguage(user.updatedAt, 'ru');

  const details = [
    `🙋‍♂️ ${formatUserLabel(user)}`,
    `📊 Статус: ${USER_STATUS_LABELS[user.status] || user.status}`,
    `🌐 Язык: ${languageLabel}`,
    `🔇 Мут до: ${muteState.muted ? muteText : '—'}`,
    `📞 Линии: ${lineTitles.length ? lineTitles.join(', ') : '—'}`,
  ];

  if (coldProfile) {
    const coldLine = lines.find((item) => item.id === coldProfile.lineId);
    const coldLineLabel = coldLine ? coldLine.title || coldLine.id : coldProfile.lineId;
    details.push(`❄️ Холодка: ${coldLineLabel} • SIP ${coldProfile.sip}`);

    if (coldProfile.ownerId) {
      const owner = await repository.getUser(coldProfile.ownerId);
      const ownerLabel = owner ? formatUserLabel(owner) : coldProfile.ownerId;
      details.push(`👤 Владелец: ${ownerLabel}`);
    }
  } else {
    const coldCount = coldProfilesOwned.length;
    details.push(`❄️ Холодок: ${coldCount || '—'}`);
  }

  if (createdAt) {
    details.push(`🗓 Создан: ${createdAt}`);
  }
  if (updatedAt) {
    details.push(`♻️ Обновлён: ${updatedAt}`);
  }

  const keyboard = buildAdminUserDetailsKeyboard(user, page, muteState.muted, {
    showColdSetupButton: !coldProfile,
  });
  await editOrReply(ctx, details.join('\n'), keyboard);
  return true;
}

async function promptLanguageSelection(userId, language = 'ru') {
  userStates.set(Number(userId), { type: 'awaitingLanguageChoice' });
  const code = ensureLanguage(language);
  try {
    await bot.telegram.sendMessage(
      userId,
      t(code, 'languagePrompt'),
      languageSelectionKeyboard()
    );
  } catch (error) {
    console.error('Failed to send language selection prompt', error);
  }
}

async function isStopWork(ctx) {
  const settings = await repository.getSettings();
  const active = getNestedValue(settings, ['stopWork', 'active']);

  if (!active || isAdmin(ctx.from.id)) {
    return false;
  }

  const user = await repository.getUser(ctx.from.id);
  const language = getUserLanguage(user);
  const defaultMessage =
    settings.defaultStopWorkMessage || config.defaultStopWorkMessage;
  const message =
    getNestedValue(settings, ['stopWork', 'message']) || defaultMessage;
  const untilText = formatDateForLanguage(
    getNestedValue(settings, ['stopWork', 'until']),
    language
  );

  await ctx.reply(t(language, 'stopWork', { until: untilText, message }));
  return true;
}

function parseDateTime(input) {
  if (!input) return null;
  const cleaned = input.trim().replace(' ', 'T');
  const date = new Date(cleaned);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

async function ensureMuteState(user) {
  const mutedUntil = getNestedValue(user, 'mutedUntil');
  if (!mutedUntil) {
    return { muted: false, until: null };
  }

  const untilDate = new Date(mutedUntil);
  if (Number.isNaN(untilDate.getTime()) || untilDate.getTime() <= Date.now()) {
    await repository.setUserMute(user.id, null);
    return { muted: false, until: null };
  }

  return { muted: true, until: mutedUntil };
}

async function sendMainMenu(ctx, user) {
  const targetUser = user || (await repository.getUser(ctx.from.id));
  if (!targetUser) {
    return;
  }

  const language = getUserLanguage(targetUser);
  const coldProfile = targetUser.id
    ? await repository.getColdProfileByUserId(targetUser.id)
    : null;
  const showColdButton = targetUser.status === 'active' && !coldProfile;

  await ctx.reply(
    t(language, 'mainMenuPrompt'),
    userKeyboard(language, { showColdButton })
  );
}
async function processAdminState(ctx) {
  const state = adminStates.get(Number(ctx.from.id));
  if (!state) {
    return false;
  }

  const messageText = getNestedValue(ctx, ['message', 'text']);
  const text = messageText ? messageText.trim() : '';
  if (!text) {
    return true;
  }

  try {
    switch (state.type) {
      case 'awaitingLineAssignment': {
        const lineId = text;
        const line = await repository.getLine(lineId);
        if (!line) {
          await ctx.reply(t('ru', 'lineMissing'));
          return true;
        }

        const { applicationId, userId } = state.payload;
        const { user, line: updatedLine } = await repository.attachUserToLine(userId, lineId);
        await repository.setUserStatus(userId, 'active');
        await repository.updateApplication(applicationId, { status: 'approved', lineId });

        const language = getUserLanguage(user);
        try {
          await bot.telegram.sendMessage(
            userId,
            t(language, 'applicationApprovedUser', {
              lineTitle: updatedLine.title,
              lineId: updatedLine.id,
            })
          );
        } catch (error) {
          console.error('Failed to notify user about approval', error);
        }

        await promptLanguageSelection(userId);

        await ctx.reply(
          t('ru', 'applicationApprovedAdmin', {
            lineTitle: updatedLine.title,
            lineId: updatedLine.id,
          })
        );
        setAdminState(ctx.from.id, null);
        break;
      }
      case 'awaitingLineCreation': {
        const [rawId, ...rest] = text.split(';');
        const lineId = (rawId || '').trim();
        const title = rest.join(';').trim();

        if (!lineId) {
          await ctx.reply(t('ru', 'waitingForLineIdFormat'));
          return true;
        }

        const line = await repository.createLine({ id: lineId, title: title || undefined });
        await ctx.reply(
          t('ru', 'lineCreated', { lineTitle: line.title, lineId: line.id })
        );
        setAdminState(ctx.from.id, null);
        break;
      }
      case 'awaitingUserLineAttach': {
        const [rawUserId, rawLineId] = text.split(';');
        const userId = Number((rawUserId || '').trim());
        const lineId = (rawLineId || '').trim();

        if (!userId || !lineId) {
          await ctx.reply(t('ru', 'attachUserFormat'));
          return true;
        }

        const { user, line } = await repository.attachUserToLine(userId, lineId);
        await repository.setUserStatus(userId, 'active');

        const language = getUserLanguage(user);
        try {
          await bot.telegram.sendMessage(
            userId,
            t(language, 'applicationApprovedUser', {
              lineTitle: line.title,
              lineId: line.id,
            })
          );
          if (!user.language) {
            await promptLanguageSelection(userId);
          }
        } catch (error) {
          console.error('Failed to notify user about attach', error);
        }

        await ctx.reply(
          t('ru', 'attachedUser', {
            userLabel: formatUserLabel(user),
            lineTitle: line.title,
            lineId: line.id,
          })
        );
        setAdminState(ctx.from.id, null);
        break;
      }
      case 'awaitingUserLineDetach': {
        const [rawUserId, rawLineId] = text.split(';');
        const userId = Number((rawUserId || '').trim());
        const lineId = (rawLineId || '').trim();

        if (!userId || !lineId) {
          await ctx.reply(t('ru', 'attachUserFormat'));
          return true;
        }

        await repository.detachUserFromLine(userId, lineId);
        await ctx.reply(t('ru', 'detachedUser', { userId, lineId }));
        setAdminState(ctx.from.id, null);
        break;
      }
      case 'awaitingLineGroup': {
        let lineId = text;
        let groupId = null;

        if (text.includes(';')) {
          const [linePart, groupPart] = text.split(';', 2);
          lineId = linePart.trim();
          groupId = groupPart.trim();
        }

        if (!groupId && ctx.message.forward_from_chat) {
          groupId = ctx.message.forward_from_chat.id;
        }

        if (!lineId || !groupId) {
          await ctx.reply(t('ru', 'setGroupFormat'));
          return true;
        }

        const line = await repository.setLineGroup(lineId, groupId);
        await ctx.reply(
          t('ru', 'lineGroupSet', { lineTitle: line.title, groupId })
        );
        setAdminState(ctx.from.id, null);
        break;
      }
      case 'awaitingBanUser': {
        const userId = Number(text);
        if (!userId) {
          await ctx.reply(t('ru', 'banPrompt'));
          return true;
        }
        await repository.setUserStatus(userId, 'banned');
        await ctx.reply(t('ru', 'bannedUser', { userId }));
        setAdminState(ctx.from.id, null);
        break;
      }
      case 'awaitingMuteUser': {
        const [rawUserId, rawHours] = text.split(';');
        const userId = Number((rawUserId || '').trim());
        const hours = Number((rawHours || '').trim());

        if (!userId) {
          await ctx.reply(t('ru', 'mutePrompt'));
          return true;
        }

        if (!Number.isFinite(hours) || hours < 0) {
          await ctx.reply(t('ru', 'mutePrompt'));
          return true;
        }

        if (!hours) {
          await repository.setUserMute(userId, null);
          await ctx.reply(t('ru', 'muteRemoved', { userId }));
          setAdminState(ctx.from.id, null);
          break;
        }

        const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
        await repository.setUserMute(userId, until);
        await ctx.reply(t('ru', 'muted', { userId, hours }));
        setAdminState(ctx.from.id, null);
        break;
      }
      case 'awaitingStopWorkEnable': {
        let message = text;
        let untilIso = null;

        if (text.includes(';')) {
          const [maybeUntil, ...rest] = text.split(';');
          const parsed = parseDateTime(maybeUntil.trim());
          if (parsed) {
            untilIso = parsed.toISOString();
            const defaultMessage =
              (await repository.getDefaultStopWorkMessage()) ||
              config.defaultStopWorkMessage;
            message = rest.join(';').trim() || defaultMessage;
          }
        }

        message = message.trim();
        if (!message) {
          const defaultMessage =
            (await repository.getDefaultStopWorkMessage()) ||
            config.defaultStopWorkMessage;
          message = defaultMessage;
        }

        await repository.setStopWork({ active: true, until: untilIso, message });
        await ctx.reply(t('ru', 'stopWorkActivated'));
        setAdminState(ctx.from.id, null);
        break;
      }
      case 'awaitingDefaultStopWorkMessage': {
        const language = state.language || 'ru';
        const normalized = text === '-' ? '' : text.trim();
        const stored = await repository.setDefaultStopWorkMessage(normalized);
        const finalMessage = stored || config.defaultStopWorkMessage;

        const confirmation = [
          t(language, 'adminSettingsStopWorkMessageUpdated'),
          t(language, 'adminSettingsStopWorkMessageCurrent', {
            message: finalMessage,
          }),
        ].join('\n');

        await ctx.reply(confirmation);
        setAdminState(ctx.from.id, null);
        break;
      }
      case 'awaitingColdUpload': {
        const { userId, lineId, page } = state.payload || {};
        const rows = text
          .split(/\r?\n/)
          .map((row) => row.trim())
          .filter(Boolean);

        const entries = rows
          .map((row) =>
            row
              .split(/[;,\t]+/)
              .map((part) => part.trim())
              .filter(Boolean)
          )
          .filter((parts) => parts.length >= 2)
          .map((parts) => ({ username: parts[0], sip: parts[1] }));

        if (!entries.length) {
          await ctx.reply(t('ru', 'coldAdminUploadInvalid'));
          return true;
        }

        try {
          const result = await repository.upsertColdProfiles(userId, lineId, entries);

          if (!result.processed) {
            await ctx.reply(t('ru', 'coldAdminUploadInvalid'));
            return true;
          }

          await ctx.reply(
            t('ru', 'coldAdminUploadSuccess', {
              processed: result.processed,
              created: result.created,
              updated: result.updated,
            })
          );
        } catch (error) {
          console.error('Failed to upsert cold profiles', error);
          await ctx.reply(t('ru', 'genericError'));
          return true;
        }

        setAdminState(ctx.from.id, null);
        await renderAdminUserDetails(ctx, userId, page);
        break;
      }
      default:
        setAdminState(ctx.from.id, null);
        return false;
    }
  } catch (error) {
    console.error('Admin state error', error);
    await ctx.reply(`⚠️ Ошибка: ${error.message}`);
  }

  return true;
}
async function processUserState(ctx, providedUser) {
  const state = userStates.get(Number(ctx.from.id));
  if (!state) {
    return false;
  }

  const user = providedUser || (await repository.getUser(ctx.from.id));
  if (!user) {
    clearUserState(ctx.from.id);
    await ctx.reply(t('ru', 'userNotFound'));
    return true;
  }

  const language = getUserLanguage(user);

  if (state.type === 'awaitingLanguageChoice') {
    await ctx.reply(t(language, 'languageReminder'));
    return true;
  }

  if (state.type === 'awaitingColdSipInput') {
    const value = text.trim();
    const { profileId, lineId } = state.payload || {};

    if (!lineId) {
      clearUserState(ctx.from.id);
      await ctx.reply(t(language, 'genericError'));
      return true;
    }

    if (!value) {
      await ctx.reply(t(language, 'coldSetupInvalidSip'));
      return true;
    }

    if (!user.lineIds.includes(lineId)) {
      clearUserState(ctx.from.id);
      await ctx.reply(t(language, 'noAccessLine'));
      return true;
    }

    const line = await repository.getLine(lineId);

    if (!line) {
      clearUserState(ctx.from.id);
      await ctx.reply(t(language, 'lineMissing'));
      return true;
    }

    await promptColdUsername(ctx, user, language, {
      profileId,
      line,
      sip: value,
    });
    return true;
  }

  if (state.type === 'awaitingColdUsername') {
    const normalized = normalizeColdUsername(text);

    if (!normalized) {
      await ctx.reply(t(language, 'coldSetupInvalidUsername'));
      return true;
    }

    const payload = state.payload || {};
    const { profileId, lineId, sip } = payload;

    if (!lineId || !sip) {
      clearUserState(ctx.from.id);
      await ctx.reply(t(language, 'genericError'));
      return true;
    }

    try {
      const profile = await repository.saveColdProfileForOwner(user.id, {
        profileId,
        lineId,
        sip,
        username: `@${normalized}`,
      });

      clearUserState(ctx.from.id);

      const line = await repository.getLine(profile.lineId);
      const successText = t(language, 'coldSetupSaved', {
        username: profile.username || `@${profile.normalizedUsername}`,
        lineTitle: line ? line.title : undefined,
        lineId: profile.lineId,
        sip: profile.sip,
      });

      await ctx.reply(successText);

      const freshUser = await repository.getUser(user.id);
      await sendColdOverview(ctx, freshUser || user, language);
    } catch (error) {
      if (error && error.code === 'COLD_USERNAME_CONFLICT') {
        await ctx.reply(t(language, 'coldSetupUsernameInUse'));
      } else if (error && error.code === 'COLD_LINE_FORBIDDEN') {
        clearUserState(ctx.from.id);
        await ctx.reply(t(language, 'noAccessLine'));
      } else if (error && error.code === 'COLD_INVALID_SIP') {
        await ctx.reply(t(language, 'coldSetupInvalidSip'));
      } else {
        console.error('Failed to save cold profile', error);
        clearUserState(ctx.from.id);
        await ctx.reply(t(language, 'genericError'));
      }
    }

    return true;
  }

  if (state.type === 'awaitingComplaintSip') {
    const line = await repository.getLine(state.payload.lineId);

    if (!line) {
      await ctx.reply(t(language, 'lineMissing'));
      clearUserState(ctx.from.id);
      return true;
    }

    const sipOptions = (
      getNestedValue(state, ['payload', 'sipOptions']) || getSipOptions(line)
    ).filter(Boolean);

    if (!sipOptions.length) {
      userStates.set(Number(ctx.from.id), {
        type: 'awaitingComplaintDescription',
        payload: { lineId: line.id, sip: null },
      });

      await ctx.reply(
        t(language, 'complaintLineChosen', {
          lineTitle: line.title,
          lineId: line.id,
        })
      );
      return true;
    }

    const keyboard = buildSipKeyboard(line, sipOptions, language);
    await ctx.reply(t(language, 'complaintSipReminder'), keyboard);
    return true;
  }

  const mute = await ensureMuteState(user);
  if (mute.muted) {
    const untilText = formatDateForLanguage(mute.until, language) || mute.until;
    await ctx.reply(t(language, 'muteActive', { until: untilText }));
    return true;
  }

  if (state.type === 'awaitingComplaintDescription') {
    const textMessage = getNestedValue(ctx, ['message', 'text']);
    if (!textMessage) {
      await ctx.reply(t(language, 'complaintDescriptionReminder'));
      return true;
    }

    const normalizedText = textMessage.trim().toLowerCase();
    const cancelVariants = ['/cancel', t(language, 'complaintCancelButton')];
    if (
      cancelVariants.some(
        (variant) =>
          typeof variant === 'string' && normalizedText === variant.trim().toLowerCase()
      )
    ) {
      clearUserState(ctx.from.id);
      await ctx.reply(t(language, 'complaintCancelled'));
      await sendMainMenu(ctx, user);
      return true;
    }

    const line = await repository.getLine(state.payload.lineId);

    if (!line) {
      await ctx.reply(t(language, 'lineMissing'));
      clearUserState(ctx.from.id);
      return true;
    }

    if (!line.groupId) {
      await ctx.reply(t(language, 'lineNotConfigured'));
      clearUserState(ctx.from.id);
      return true;
    }

    const sip = getNestedValue(state, ['payload', 'sip']) || null;
    const coldProfileId = getNestedValue(state, ['payload', 'coldProfileId']) || null;
    const logParts = [
      t('ru', 'complainLogTitle', {
        userLabel: formatUserLabel(user),
        lineTitle: line.title,
        lineId: line.id,
      }),
    ];

    if (sip) {
      logParts.push(t('ru', 'complainLogSip', { sip }));
    }

    logParts.push('', t('ru', 'complainLogMessageLabel'), textMessage);

    const logMessage = logParts.join('\n');

    let complaintRecord = null;

    try {
      complaintRecord = await repository.createComplaint({
        userId: user.id,
        lineId: line.id,
        sip,
        message: textMessage,
        coldProfileId,
      });
    } catch (error) {
      console.error('Failed to store complaint record', error);
    }

    try {
      const complaintId = complaintRecord ? complaintRecord.id : undefined;
      const sentMessage = await bot.telegram.sendMessage(
        line.groupId,
        logMessage,
        buildComplaintLogKeyboard(complaintId, user.id)
      );
      await ctx.reply(t(language, 'complaintSent'));
      await sendRandomCrocoSticker(ctx);

      if (complaintRecord) {
        await repository.setComplaintLogInfo(complaintRecord.id, {
          chatId: getNestedValue(sentMessage, ['chat', 'id']),
          messageId: sentMessage.message_id,
        });
      }
    } catch (error) {
      console.error('Failed to send complaint', error);
      if (complaintRecord) {
        await repository.deleteComplaint(complaintRecord.id);
      }
      await ctx.reply(t(language, 'complaintError'));
    }

    clearUserState(ctx.from.id);
    return true;
  }

  return false;
}

bot.start(async (ctx) => {
  let user = await repository.upsertUser(ctx.from);

  if (ctx.from.username) {
    try {
      const profile = await repository.getColdProfileByUsername(ctx.from.username);
      if (profile && (!profile.userId || Number(profile.userId) === Number(user.id))) {
        await repository.setColdProfileUser(profile.id, user.id);
        await repository.attachUserToLine(user.id, profile.lineId);
        await repository.setUserStatus(user.id, 'active');
        user = await repository.getUser(user.id);
      }
    } catch (error) {
      console.error('Failed to activate cold profile', error);
    }
  }

  if (!isAdmin(ctx.from.id) && (await isStopWork(ctx))) {
    clearUserState(ctx.from.id);
    return;
  }

  if (user.status === 'banned') {
    await ctx.reply(t(getUserLanguage(user), 'banned'));
    return;
  }

  if (isAdmin(ctx.from.id)) {
    await ctx.reply(t('ru', 'adminPanel'), adminMenuKeyboard());
    return;
  }

  if (user.status === 'active') {
    if (!user.language) {
      await promptLanguageSelection(user.id);
      return;
    }
    await sendMainMenu(ctx, user);
    return;
  }

  const { application, created } = await repository.createApplication(user.id);
  const language = getUserLanguage(user);

  if (created) {
    await sendRandomCrocoSticker(ctx);
    await ctx.reply(t(language, 'pendingApplied'));
    await notifyAdminsAboutApplication(user, application);
  } else {
    await ctx.reply(t(language, 'alreadyPending'));
  }
});

bot.command('admin', async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    return;
  }

  await ctx.reply(t('ru', 'adminPanel'), adminMenuKeyboard());
});

bot.hears(/жалоба|complaint/i, async (ctx) => {
  if (isAdmin(ctx.from.id)) {
    return;
  }

  const user = await repository.getUser(ctx.from.id);
  const language = getUserLanguage(user);

  if (await isStopWork(ctx)) {
    clearUserState(ctx.from.id);
    return;
  }

  if (!user || user.status !== 'active') {
    await ctx.reply(t(language, 'notActive'));
    return;
  }

  if (!user.language) {
    await promptLanguageSelection(user.id);
    return;
  }

  const mute = await ensureMuteState(user);
  if (mute.muted) {
    const untilText = formatDateForLanguage(mute.until, language) || mute.until;
    await ctx.reply(t(language, 'muteActiveComplaints', { until: untilText }));
    return;
  }

  if (!user.lineIds.length) {
    await ctx.reply(t(language, 'notLinked'));
    return;
  }

  const coldProfile = await repository.getColdProfileByUserId(user.id);
  if (coldProfile) {
    const line = await repository.getLine(coldProfile.lineId);
    if (!line) {
      await ctx.reply(t(language, 'lineMissing'));
      return;
    }

    userStates.set(Number(user.id), {
      type: 'awaitingComplaintDescription',
      payload: {
        lineId: line.id,
        sip: coldProfile.sip,
        coldProfileId: coldProfile.id,
      },
    });

    const responseText = t(language, 'complaintSipChosen', {
      sip: coldProfile.sip,
      lineTitle: line.title,
      lineId: line.id,
    });

    await ctx.reply(responseText);
    return;
  }

  await sendComplaintLineMenu(ctx, user, language);
});

bot.hears(/настройки|settings/i, async (ctx) => {
  if (isAdmin(ctx.from.id)) {
    return;
  }

  if (await isStopWork(ctx)) {
    clearUserState(ctx.from.id);
    return;
  }

  const user = await repository.getUser(ctx.from.id);

  if (!user) {
    await ctx.reply(t('ru', 'userNotFound'));
    return;
  }

  const language = getUserLanguage(user);

  if (user.status === 'banned') {
    await ctx.reply(t(language, 'banned'));
    return;
  }

  if (user.status !== 'active') {
    await ctx.reply(t(language, 'notActive'));
    return;
  }

  await sendSettingsMenu(ctx, language);
});

bot.hears(/холодки|cold\s+agents?/i, async (ctx) => {
  if (isAdmin(ctx.from.id)) {
    return;
  }

  if (await isStopWork(ctx)) {
    clearUserState(ctx.from.id);
    return;
  }

  const user = await repository.getUser(ctx.from.id);
  if (!user) {
    await ctx.reply(t('ru', 'userNotFound'));
    return;
  }

  const language = getUserLanguage(user);

  if (user.status === 'banned') {
    await ctx.reply(t(language, 'banned'));
    return;
  }

  if (user.status !== 'active') {
    await ctx.reply(t(language, 'notActive'));
    return;
  }
  if (!user.language) {
    await promptLanguageSelection(user.id, language);
    return;
  }

  const coldProfile = await repository.getColdProfileByUserId(user.id);
  if (coldProfile) {
    await ctx.reply(t(language, 'coldInstructions'));
    return;
  }

  await sendColdOverview(ctx, user, language);
});

bot.action('settings:language', async (ctx) => {
  if (isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery();
    return;
  }

  const user = await repository.getUser(ctx.from.id);

  if (!user) {
    await ctx.answerCbQuery('🚫', { show_alert: true });
    await ctx.reply(t('ru', 'userNotFound'));
    return;
  }

  const language = getUserLanguage(user);

  if (user.status === 'banned') {
    await ctx.answerCbQuery('🚫', { show_alert: true });
    await ctx.reply(t(language, 'banned'));
    return;
  }

  if (user.status !== 'active') {
    await ctx.answerCbQuery('🚫', { show_alert: true });
    await ctx.reply(t(language, 'notActive'));
    return;
  }

  await ctx.answerCbQuery('🌐');

  try {
    await ctx.editMessageReplyMarkup();
  } catch (error) {
    // Message might be not editable; ignore silently.
  }

  await promptLanguageSelection(user.id, language);
});

bot.action('settings:instructions', async (ctx) => {
  if (isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery();
    return;
  }

  const user = await repository.getUser(ctx.from.id);
  const language = getUserLanguage(user);

  if (!user) {
    await ctx.answerCbQuery('🚫', { show_alert: true });
    await ctx.reply(t('ru', 'userNotFound'));
    return;
  }

  if (user.status === 'banned') {
    await ctx.answerCbQuery('🚫', { show_alert: true });
    await ctx.reply(t(language, 'banned'));
    return;
  }

  if (user.status !== 'active') {
    await ctx.answerCbQuery('🚫', { show_alert: true });
    await ctx.reply(t(language, 'notActive'));
    return;
  }

  await ctx.answerCbQuery('ℹ️');

  const text = t(language, 'settingsInstructions');
  const keyboard = settingsInstructionsKeyboard(language);

  try {
    await ctx.editMessageText(text, keyboard);
  } catch (error) {
    await ctx.reply(text);
  }
});

bot.action('settings:menu', async (ctx) => {
  if (isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery();
    return;
  }

  const user = await repository.getUser(ctx.from.id);

  if (!user) {
    await ctx.answerCbQuery('🚫', { show_alert: true });
    await ctx.reply(t('ru', 'userNotFound'));
    return;
  }

  const language = getUserLanguage(user);

  if (user.status === 'banned') {
    await ctx.answerCbQuery('🚫', { show_alert: true });
    await ctx.reply(t(language, 'banned'));
    return;
  }

  if (user.status !== 'active') {
    await ctx.answerCbQuery('🚫', { show_alert: true });
    await ctx.reply(t(language, 'notActive'));
    return;
  }

  await ctx.answerCbQuery();
  await sendSettingsMenu(ctx, language, { edit: true });
});

bot.action('cold:menu', async (ctx) => {
  const resolved = await resolveColdActionUser(ctx);
  if (!resolved) {
    return;
  }

  const { user, language } = resolved;
  await ctx.answerCbQuery('❄️');
  await sendColdOverview(ctx, user, language, { edit: true });
});

bot.action('cold:setup:new', async (ctx) => {
  const resolved = await resolveColdActionUser(ctx);
  if (!resolved) {
    return;
  }

  const { user, language } = resolved;
  await ctx.answerCbQuery('➕');
  await sendColdLineSelection(ctx, user, language, { profileId: null });
});

bot.action(/^cold:profile:(.+)$/i, async (ctx) => {
  const resolved = await resolveColdActionUser(ctx);
  if (!resolved) {
    return;
  }

  const profileId = decodeCallbackComponent(ctx.match[1]);
  const { user, language } = resolved;

  const profile = await repository.getColdProfileById(profileId);

  if (!profile || Number(profile.ownerId) !== Number(user.id)) {
    await ctx.answerCbQuery('🚫', { show_alert: true });
    return;
  }

  const line = await repository.getLine(profile.lineId);
  const statusKey = profile.userId
    ? 'coldProfileStatusActive'
    : 'coldProfileStatusPending';
  const status = t(language, statusKey);
  const text = t(language, 'coldProfileDetails', {
    username: profile.username || `@${profile.normalizedUsername}`,
    lineTitle: line ? line.title : undefined,
    lineId: profile.lineId,
    sip: profile.sip,
    status,
  });

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.callbackButton(
        t(language, 'coldSetupManageButton'),
        `cold:setup:edit:${encodeCallbackComponent(profile.id)}`
      ),
    ],
    [
      Markup.callbackButton(
        t(language, 'coldSetupRemoveButton'),
        `cold:remove:${encodeCallbackComponent(profile.id)}`
      ),
    ],
    [Markup.callbackButton(t(language, 'backButton'), 'cold:menu')],
  ]).extra();

  await ctx.answerCbQuery('❄️');
  await editOrReply(ctx, text, keyboard);
});

bot.action(/^cold:setup:edit:(.+)$/i, async (ctx) => {
  const resolved = await resolveColdActionUser(ctx);
  if (!resolved) {
    return;
  }

  const profileId = decodeCallbackComponent(ctx.match[1]);
  const { user, language } = resolved;

  const profile = await repository.getColdProfileById(profileId);

  if (!profile || Number(profile.ownerId) !== Number(user.id)) {
    await ctx.answerCbQuery('🚫', { show_alert: true });
    return;
  }

  await ctx.answerCbQuery('⚙️');
  await sendColdLineSelection(ctx, user, language, { profileId });
});

bot.action(/^cold:lineMenu:(.+)$/i, async (ctx) => {
  const resolved = await resolveColdActionUser(ctx);
  if (!resolved) {
    return;
  }

  const profileId = decodeColdProfileKey(ctx.match[1]);
  const { user, language } = resolved;

  await ctx.answerCbQuery('⬅️');
  await sendColdLineSelection(ctx, user, language, { profileId });
});

bot.action(/^cold:lineSelect:([^:]+):(.+)$/i, async (ctx) => {
  const resolved = await resolveColdActionUser(ctx);
  if (!resolved) {
    return;
  }

  const profileId = decodeColdProfileKey(ctx.match[1]);
  const lineId = decodeCallbackComponent(ctx.match[2]);
  const { user, language } = resolved;

  if (!user.lineIds.includes(lineId)) {
    await ctx.answerCbQuery(t(language, 'noAccessLine'), { show_alert: true });
    return;
  }

  const line = await repository.getLine(lineId);

  if (!line) {
    await ctx.answerCbQuery(t(language, 'lineMissing'), { show_alert: true });
    return;
  }

  await ctx.answerCbQuery('📞');
  await sendColdSipSelection(ctx, user, language, { profileId, line });
});

bot.action(/^cold:sipSelect:([^:]+):([^:]+):(.+)$/i, async (ctx) => {
  const resolved = await resolveColdActionUser(ctx);
  if (!resolved) {
    return;
  }

  const profileId = decodeColdProfileKey(ctx.match[1]);
  const lineId = decodeCallbackComponent(ctx.match[2]);
  const sip = decodeCallbackComponent(ctx.match[3]);
  const { user, language } = resolved;

  if (!user.lineIds.includes(lineId)) {
    await ctx.answerCbQuery(t(language, 'noAccessLine'), { show_alert: true });
    return;
  }

  const line = await repository.getLine(lineId);

  if (!line) {
    await ctx.answerCbQuery(t(language, 'lineMissing'), { show_alert: true });
    return;
  }

  const sipOptions = getSipOptions(line);

  if (sipOptions.length && !sipOptions.includes(sip)) {
    await ctx.answerCbQuery(t(language, 'complaintSipInvalid'), { show_alert: true });
    return;
  }

  await ctx.answerCbQuery('☎️');
  await promptColdUsername(ctx, user, language, { profileId, line, sip });
});

bot.action(/^cold:sipManual:([^:]+):(.+)$/i, async (ctx) => {
  const resolved = await resolveColdActionUser(ctx);
  if (!resolved) {
    return;
  }

  const profileId = decodeColdProfileKey(ctx.match[1]);
  const lineId = decodeCallbackComponent(ctx.match[2]);
  const { user, language } = resolved;

  if (!user.lineIds.includes(lineId)) {
    await ctx.answerCbQuery(t(language, 'noAccessLine'), { show_alert: true });
    return;
  }

  const line = await repository.getLine(lineId);

  if (!line) {
    await ctx.answerCbQuery(t(language, 'lineMissing'), { show_alert: true });
    return;
  }

  await ctx.answerCbQuery('✏️');
  await promptColdSipInput(ctx, user, language, { profileId, line });
});

bot.action(/^cold:sipBack:([^:]+):(.+)$/i, async (ctx) => {
  const resolved = await resolveColdActionUser(ctx);
  if (!resolved) {
    return;
  }

  const profileId = decodeColdProfileKey(ctx.match[1]);
  const lineId = decodeCallbackComponent(ctx.match[2]);
  const { user, language } = resolved;

  const line = await repository.getLine(lineId);

  if (!line) {
    await ctx.answerCbQuery(t(language, 'lineMissing'), { show_alert: true });
    return;
  }

  clearUserState(ctx.from.id);
  await ctx.answerCbQuery('⬅️');
  await sendColdSipSelection(ctx, user, language, { profileId, line });
});

bot.action('cold:cancel', async (ctx) => {
  const resolved = await resolveColdActionUser(ctx);
  if (!resolved) {
    return;
  }

  const { user, language } = resolved;
  clearUserState(ctx.from.id);
  await ctx.answerCbQuery('❌');
  await editOrReply(ctx, t(language, 'coldSetupCancelled'));
  await sendColdOverview(ctx, user, language);
});

bot.action(/^cold:remove:(.+)$/i, async (ctx) => {
  const resolved = await resolveColdActionUser(ctx);
  if (!resolved) {
    return;
  }

  const profileId = decodeCallbackComponent(ctx.match[1]);
  const { user, language } = resolved;
  const profile = await repository.getColdProfileById(profileId);

  if (!profile || Number(profile.ownerId) !== Number(user.id)) {
    await ctx.answerCbQuery('🚫', { show_alert: true });
    return;
  }

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.callbackButton(
        t(language, 'coldRemoveConfirmButton'),
        `cold:remove:confirm:${encodeCallbackComponent(profile.id)}`
      ),
    ],
    [Markup.callbackButton(t(language, 'backButton'), `cold:profile:${encodeCallbackComponent(profile.id)}`)],
    [Markup.callbackButton(t(language, 'coldSetupCancelButton'), 'cold:cancel')],
  ]).extra();

  await ctx.answerCbQuery('⚠️');
  await editOrReply(ctx, t(language, 'coldRemoveConfirm'), keyboard);
});

bot.action(/^cold:remove:confirm:(.+)$/i, async (ctx) => {
  const resolved = await resolveColdActionUser(ctx);
  if (!resolved) {
    return;
  }

  const profileId = decodeCallbackComponent(ctx.match[1]);
  const { user, language } = resolved;

  try {
    const removed = await repository.deleteColdProfile(profileId, user.id);

    if (!removed) {
      await ctx.answerCbQuery('🚫', { show_alert: true });
      return;
    }

    clearUserState(ctx.from.id);
    await ctx.answerCbQuery('🗑');
    await editOrReply(ctx, t(language, 'coldRemoved'));
    await sendColdOverview(ctx, user, language);
  } catch (error) {
    console.error('Failed to remove cold profile', error);
    await ctx.answerCbQuery('⚠️', { show_alert: true });
  }
});

bot.action(/^complaint:(.+)$/i, async (ctx) => {
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
    lineTitle: line ? line.title : undefined,
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

bot.action('complaintCancel', async (ctx) => {
  if (isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery();
    return;
  }

  const user = await repository.getUser(ctx.from.id);
  const language = getUserLanguage(user);

  clearUserState(ctx.from.id);

  await ctx.answerCbQuery();
  await ctx.reply(t(language, 'complaintCancelled'));
  await sendMainMenu(ctx, user);
});

bot.action(/^application:(confirm|decline):(.+)$/i, async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery('🚫', { show_alert: true });
    return;
  }

  const action = ctx.match[1];
  const applicationId = ctx.match[2];
  const application = await repository.getApplicationById(applicationId);

  if (!application) {
    await ctx.answerCbQuery(t('ru', 'applicationNotFound'), { show_alert: true });
    return;
  }

  const user = await repository.getUser(application.userId);

  if (!user) {
    await ctx.answerCbQuery(t('ru', 'applicationNotFound'), { show_alert: true });
    return;
  }

  if (action === 'decline') {
    await repository.updateApplication(applicationId, { status: 'declined' });
    await repository.setUserStatus(user.id, 'declined');

    await ctx.answerCbQuery(t('ru', 'applicationDeclinedCb'));
    await ctx.editMessageText(
      t('ru', 'applicationDeclinedAdmin', { userLabel: formatUserLabel(user) })
    );

    try {
      await bot.telegram.sendMessage(
        user.id,
        t(getUserLanguage(user), 'applicationDeclinedUser')
      );
    } catch (error) {
      console.error('Failed to notify user about decline', error);
    }
    return;
  }

  setAdminState(ctx.from.id, {
    type: 'awaitingLineAssignment',
    payload: { applicationId, userId: user.id },
  });

  await ctx.answerCbQuery(t('ru', 'applicationConfirmCb'), { show_alert: true });
  await ctx.reply(
    t('ru', 'adminAwaitLineId', { userLabel: formatUserLabel(user) })
  );
});
bot.action('admin:back', async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery();
    return;
  }

  await ctx.answerCbQuery();
  await ctx.editMessageText(t('ru', 'adminPanel'), adminMenuKeyboard());
});

bot.action('admin:applications:list', async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery();
    return;
  }

  const pending = await repository.getPendingApplications();
  if (!pending.length) {
    await ctx.answerCbQuery(t('ru', 'pendingApplicationsEmpty'));
    return;
  }

  const applicationsWithUsers = await Promise.all(
    pending.map(async (application) => {
      const user = await repository.getUser(application.userId);
      return { application, user };
    })
  );

  const items = applicationsWithUsers.map(({ application, user }) =>
    `${application.id}: ${formatUserLabel(user || { id: application.userId })}`
  );

  const keyboard = Markup.inlineKeyboard(
    applicationsWithUsers.map(({ application, user }) => [
      Markup.callbackButton(
        formatApplicationButtonLabel(application, user),
        `admin:applications:open:${application.id}`
      ),
    ])
  ).extra();

  await ctx.answerCbQuery();
  await editOrReply(ctx, t('ru', 'pendingApplicationsList', { items }), keyboard);
});

bot.action(/^admin:applications:open:(.+)$/, async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery();
    return;
  }

  const applicationId = ctx.match[1];
  const application = await repository.getApplicationById(applicationId);

  if (!application) {
    await ctx.answerCbQuery(t('ru', 'applicationNotFound'), { show_alert: true });
    return;
  }

  const user = await repository.getUser(application.userId);

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.callbackButton('✅ Подтвердить', `application:confirm:${application.id}`),
      Markup.callbackButton('❌ Отклонить', `application:decline:${application.id}`),
    ],
    [Markup.callbackButton('⬅️ Назад', 'admin:applications:list')],
  ]).extra();

  await ctx.answerCbQuery();
  await editOrReply(ctx, formatApplicationCard(application, user), keyboard);
});

bot.action('admin:lines:menu', async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery();
    return;
  }
  await ctx.answerCbQuery();
  await ctx.editMessageText('🧭 Управление линиями:', adminLinesKeyboard());
});

bot.action('admin:lines:list', async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery();
    return;
  }

  const lines = await repository.getLines();
  if (!lines.length) {
    await ctx.answerCbQuery();
    await ctx.reply(t('ru', 'linesListEmpty'));
    return;
  }

  const text = lines
    .map(
      (line) =>
        `⭐ ${line.title} (${line.id})\n👥 Пользователей: ${line.userIds.length}\n💬 Группа: ${line.groupId || 'не назначена'}`
    )
    .join('\n\n');

  await ctx.answerCbQuery();
  await ctx.reply(text);
});

bot.action('admin:lines:create', async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery();
    return;
  }

  setAdminState(ctx.from.id, { type: 'awaitingLineCreation' });
  await ctx.answerCbQuery();
  await ctx.reply(t('ru', 'waitingForLineIdFormat'));
});

bot.action('admin:lines:attachUser', async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery();
    return;
  }
  setAdminState(ctx.from.id, { type: 'awaitingUserLineAttach' });
  await ctx.answerCbQuery();
  await ctx.reply(t('ru', 'attachUserFormat'));
});

bot.action('admin:lines:detachUser', async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery();
    return;
  }
  setAdminState(ctx.from.id, { type: 'awaitingUserLineDetach' });
  await ctx.answerCbQuery();
  await ctx.reply(t('ru', 'attachUserFormat'));
});

bot.action('admin:lines:setGroup', async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery();
    return;
  }
  setAdminState(ctx.from.id, { type: 'awaitingLineGroup' });
  await ctx.answerCbQuery();
  await ctx.reply(t('ru', 'setGroupFormat'));
});

bot.action('admin:users:menu', async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery();
    return;
  }
  await ctx.answerCbQuery();
  await ctx.editMessageText('👥 Управление пользователями:', adminUsersKeyboard());
});

bot.action('admin:users:list', async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery();
    return;
  }
  await ctx.answerCbQuery();

  const rendered = await renderAdminUsersPage(ctx, 0);
  if (!rendered) {
    await ctx.reply(t('ru', 'usersListEmpty'));
  }
});

bot.action(/^admin:users:page:(\d+)$/i, async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery();
    return;
  }

  const page = Number(ctx.match[1] || 0);
  await ctx.answerCbQuery();

  const rendered = await renderAdminUsersPage(ctx, page);
  if (!rendered) {
    await ctx.reply(t('ru', 'usersListEmpty'));
  }
});

bot.action(/^admin:users:view:(\d+):(\d+)$/i, async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery();
    return;
  }

  const userId = Number(ctx.match[1]);
  const page = Number(ctx.match[2] || 0);
  const rendered = await renderAdminUserDetails(ctx, userId, page);
  if (!rendered) {
    await ctx.answerCbQuery(t('ru', 'adminUsersNotFound'), { show_alert: true });
    await renderAdminUsersPage(ctx, page);
    return;
  }
  await ctx.answerCbQuery();
});

bot.action(/^admin:users:cold:menu:(\d+):(\d+)$/i, async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery();
    return;
  }

  const userId = Number(ctx.match[1]);
  const page = Number(ctx.match[2] || 0);
  const user = await repository.getUser(userId);

  if (!user) {
    await ctx.answerCbQuery(t('ru', 'adminUsersNotFound'), { show_alert: true });
    return;
  }

  const lines = await repository.getLines();
  const userLines = lines.filter((line) => user.lineIds.includes(line.id));

  if (!userLines.length) {
    await ctx.answerCbQuery(t('ru', 'coldAdminNoLines'), { show_alert: true });
    return;
  }

  const buttons = userLines.map((line) => [
    Markup.callbackButton(
      formatLineButtonLabel(line),
      `admin:users:cold:line:${userId}:${encodeCallbackComponent(line.id)}:${page}`
    ),
  ]);

  buttons.push([
    Markup.callbackButton('⬅️ Назад', `admin:users:view:${userId}:${page}`),
  ]);

  await ctx.answerCbQuery();
  await ctx.editMessageText(
    t('ru', 'coldAdminChooseLine'),
    Markup.inlineKeyboard(buttons).extra()
  );
});

bot.action(/^admin:users:cold:line:(\d+):([^:]+):(\d+)$/i, async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery();
    return;
  }

  const userId = Number(ctx.match[1]);
  const lineId = decodeCallbackComponent(ctx.match[2]);
  const page = Number(ctx.match[3] || 0);

  const [user, line] = await Promise.all([
    repository.getUser(userId),
    repository.getLine(lineId),
  ]);

  if (!user || !line) {
    await ctx.answerCbQuery(t('ru', 'genericError'), { show_alert: true });
    return;
  }

  setAdminState(ctx.from.id, {
    type: 'awaitingColdUpload',
    payload: { userId, lineId, page },
  });

  await ctx.answerCbQuery();
  await ctx.reply(
    [
      `🧊 ${formatUserLabel(user)}`,
      `📞 ${formatLineButtonLabel(line)}`,
      '',
      t('ru', 'coldAdminUploadPrompt'),
    ].join('\n')
  );
});

bot.action(/^admin:users:status:(active|banned):(\d+):(\d+)$/i, async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery();
    return;
  }

  const status = ctx.match[1];
  const userId = Number(ctx.match[2]);
  const page = Number(ctx.match[3] || 0);

  const user = await repository.getUser(userId);
  if (!user) {
    await ctx.answerCbQuery(t('ru', 'adminUsersNotFound'), { show_alert: true });
    await renderAdminUsersPage(ctx, page);
    return;
  }

  if (user.status === status) {
    await ctx.answerCbQuery(t('ru', 'adminUsersStatusUnchanged'));
    await renderAdminUserDetails(ctx, userId, page);
    return;
  }

  await repository.setUserStatus(userId, status);
  await ctx.answerCbQuery(t('ru', 'adminUsersStatusUpdated'));
  await renderAdminUserDetails(ctx, userId, page);
});

bot.action(/^admin:users:mute:(\d+):(\d+):(\d+)$/i, async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery();
    return;
  }

  const hours = Number(ctx.match[1]);
  const userId = Number(ctx.match[2]);
  const page = Number(ctx.match[3] || 0);

  const user = await repository.getUser(userId);
  if (!user) {
    await ctx.answerCbQuery(t('ru', 'adminUsersNotFound'), { show_alert: true });
    await renderAdminUsersPage(ctx, page);
    return;
  }

  const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  await repository.setUserMute(userId, until);

  await ctx.answerCbQuery(t('ru', 'adminUsersMuteUpdated', { hours }));
  await renderAdminUserDetails(ctx, userId, page);
});

bot.action(/^admin:users:unmute:(\d+):(\d+)$/i, async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery();
    return;
  }

  const userId = Number(ctx.match[1]);
  const page = Number(ctx.match[2] || 0);

  const user = await repository.getUser(userId);
  if (!user) {
    await ctx.answerCbQuery(t('ru', 'adminUsersNotFound'), { show_alert: true });
    await renderAdminUsersPage(ctx, page);
    return;
  }

  const muteState = await ensureMuteState(user);
  if (!muteState.muted) {
    await ctx.answerCbQuery(t('ru', 'adminUsersMuteAlreadyCleared'));
    await renderAdminUserDetails(ctx, userId, page);
    return;
  }

  await repository.setUserMute(userId, null);
  await ctx.answerCbQuery(t('ru', 'adminUsersMuteCleared'));
  await renderAdminUserDetails(ctx, userId, page);
});

bot.action('admin:users:ban', async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery();
    return;
  }
  setAdminState(ctx.from.id, { type: 'awaitingBanUser' });
  await ctx.answerCbQuery();
  await ctx.reply(t('ru', 'banPrompt'));
});

bot.action('admin:users:mute', async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery();
    return;
  }
  setAdminState(ctx.from.id, { type: 'awaitingMuteUser' });
  await ctx.answerCbQuery();
  await ctx.reply(t('ru', 'mutePrompt'));
});

bot.action('admin:users:unmute', async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery();
    return;
  }
  setAdminState(ctx.from.id, { type: 'awaitingMuteUser' });
  await ctx.answerCbQuery();
  await ctx.reply(t('ru', 'unmutePrompt'));
});

bot.action('admin:stats', async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery();
    return;
  }

  const users = await repository.getUsers();
  const lines = await repository.getLines();
  const pending = await repository.getPendingApplications();
  const sipStats = await repository.getSipStatistics();

  const banned = users.filter((user) => user.status === 'banned').length;
  const active = users.filter((user) => user.status === 'active').length;

  await ctx.answerCbQuery();
  const summary = t('ru', 'stats', {
    totalUsers: users.length,
    activeUsers: active,
    bannedUsers: banned,
    totalLines: lines.length,
    pending: pending.length,
  });

  const lineMap = new Map(lines.map((line) => [line.id, line]));
  const statsLines = sipStats.length
    ? [
        t('ru', 'sipStatsTitle'),
        ...sipStats.map((item) =>
          t('ru', 'sipStatsRow', {
            lineTitle: (lineMap.get(item.lineId) || {}).title,
            lineId: item.lineId,
            sip: item.sip,
            total: item.total,
            resolved: item.resolved,
            cancelled: item.cancelled,
          })
        ),
      ].join('\n')
    : t('ru', 'sipStatsEmpty');

  await ctx.reply([summary, '', statsLines].join('\n'));
});

bot.action('admin:stopwork:menu', async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery();
    return;
  }

  const settings = await repository.getSettings();
  const active = getNestedValue(settings, ['stopWork', 'active']);
  const until = formatDateForLanguage(
    getNestedValue(settings, ['stopWork', 'until']),
    'ru'
  );
  const message =
    getNestedValue(settings, ['stopWork', 'message']) ||
    config.defaultStopWorkMessage;

  await ctx.answerCbQuery();
  await ctx.editMessageText(
    t('ru', 'stopWorkStatus', { active, until, message }),
    adminStopWorkKeyboard(active)
  );
});

bot.action('admin:stopwork:enable', async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery();
    return;
  }
  setAdminState(ctx.from.id, { type: 'awaitingStopWorkEnable' });
  await ctx.answerCbQuery();
  await ctx.reply(t('ru', 'stopWorkPrompt'));
});

bot.action('admin:stopwork:disable', async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery();
    return;
  }

  await repository.setStopWork({ active: false, until: null, message: null });
  await ctx.answerCbQuery(t('ru', 'stopWorkDisabled'));
});

bot.action('admin:settings', async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery();
    return;
  }
  const user = await repository.getUser(ctx.from.id);
  const language = getUserLanguage(user);

  await ctx.answerCbQuery();

  try {
    await ctx.editMessageText(
      t(language, 'adminSettingsTitle'),
      adminSettingsKeyboard(language)
    );
  } catch (error) {
    await ctx.reply(
      t(language, 'adminSettingsTitle'),
      adminSettingsKeyboard(language)
    );
  }
});

bot.action('admin:settings:stopworkMessage', async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery();
    return;
  }

  const user = await repository.getUser(ctx.from.id);
  const language = getUserLanguage(user);
  const settings = await repository.getSettings();
  const defaultMessage =
    settings.defaultStopWorkMessage || config.defaultStopWorkMessage;

  setAdminState(ctx.from.id, { type: 'awaitingDefaultStopWorkMessage', language });

  await ctx.answerCbQuery();
  const message = [
    t(language, 'adminSettingsStopWorkMessagePrompt'),
    t(language, 'adminSettingsStopWorkMessageCurrent', { message: defaultMessage }),
  ].join('\n');

  await ctx.reply(message);
});

bot.action('admin:settings:show', async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery();
    return;
  }

  const user = await repository.getUser(ctx.from.id);
  const language = getUserLanguage(user);
  const settings = await repository.getSettings();
  const stopWork = settings.stopWork || {};
  const stopWorkUntil = formatDateForLanguage(stopWork.until, language);
  const defaultMessage =
    settings.defaultStopWorkMessage || config.defaultStopWorkMessage;

  await ctx.answerCbQuery();

  await ctx.reply(
    t(language, 'adminSettingsConfig', {
      stopWorkActive: Boolean(stopWork.active),
      stopWorkUntil,
      stopWorkMessage: stopWork.message || '',
      defaultMessage,
    })
  );
});

bot.action(/^complaintLog:(resolve|cancel):(.+)$/i, async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery(t('ru', 'complaintLogNoAccess'), {
      show_alert: true,
    });
    return;
  }

  const action = ctx.match[1];
  const identifier = ctx.match[2];
  const message = getNestedValue(ctx, ['callbackQuery', 'message']);
  if (!message) {
    await ctx.answerCbQuery();
    return;
  }

  const originalText = message.text || message.caption || '';
  const alreadyHandled = [
    ...COMPLAINT_STATUS_MARKERS.resolved,
    ...COMPLAINT_STATUS_MARKERS.cancelled,
  ].some((marker) => originalText.includes(marker));

  if (alreadyHandled) {
    await ctx.answerCbQuery(t('ru', 'complaintLogStatusAlreadySet'));
    return;
  }

  if (identifier && identifier.startsWith('id:')) {
    const complaintId = identifier.slice(3);
    if (complaintId) {
      const complaint = await repository.getComplaintById(complaintId);
      if (!complaint) {
        await ctx.answerCbQuery(t('ru', 'genericError'), { show_alert: true });
        return;
      }

      if (complaint.status !== 'new') {
        await ctx.answerCbQuery(t('ru', 'complaintLogStatusAlreadySet'));
        return;
      }

      const newStatus = action === 'resolve' ? 'resolved' : 'cancelled';
      try {
        await repository.updateComplaintStatus(complaintId, newStatus, ctx.from.id);
      } catch (error) {
        console.error('Failed to update complaint status', error);
        await ctx.answerCbQuery(t('ru', 'genericError'), { show_alert: true });
        return;
      }
    }
  }

  const actorLabel = formatUserLabelFromContext(ctx.from);
  const noteKey =
    action === 'resolve' ? 'complaintLogResolvedNote' : 'complaintLogCancelledNote';
  const note = t('ru', noteKey, { userLabel: actorLabel });
  const newText = [originalText, note].filter(Boolean).join('\n\n');

  try {
    await ctx.editMessageText(newText, Markup.inlineKeyboard([]).extra());
    await ctx.answerCbQuery(t('ru', 'complaintLogStatusUpdated'));
  } catch (error) {
    console.error('Failed to update complaint status', error);
    await ctx.answerCbQuery(t('ru', 'genericError'), { show_alert: true });
  }

});

bot.action(/^language:(ru|en)$/i, async (ctx) => {
  const language = ctx.match[1].toLowerCase();
  const userId = ctx.from.id;

  try {
    const user = await repository.getUser(userId);
    if (!user) {
      await ctx.answerCbQuery('🚫', { show_alert: true });
      return;
    }

    await repository.setUserLanguage(userId, language);
    clearUserState(userId);

    const languageName = LANGUAGE_NAMES[language];
    const confirmation = t(language, 'languageConfirmed', { languageName });

    await ctx.answerCbQuery('✅');
    try {
      await ctx.editMessageText(confirmation);
    } catch (error) {
      await ctx.reply(confirmation);
    }

    await sendMainMenu(ctx, { ...user, language });
  } catch (error) {
    console.error('Failed to set language', error);
    await ctx.answerCbQuery('⚠️', { show_alert: true });
  }
});

bot.on('text', async (ctx, next) => {
  if (isAdmin(ctx.from.id)) {
    const handled = await processAdminState(ctx);
    if (handled) {
      return;
    }
    await ctx.reply(t('ru', 'adminUseMenu'));
    return;
  }

  const user = await repository.getUser(ctx.from.id);
  const language = getUserLanguage(user);

  if (await isStopWork(ctx)) {
    clearUserState(ctx.from.id);
    return;
  }

  if (!user) {
    await ctx.reply(t('ru', 'userNotFound'));
    return;
  }

  const handled = await processUserState(ctx, user);
  if (handled) {
    return;
  }

  const coldProfile = user.id
    ? await repository.getColdProfileByUserId(user.id)
    : null;
  const showColdButton = user.status === 'active' && !coldProfile;

  await ctx.reply(
    t(language, 'menuReminder'),
    userKeyboard(language, { showColdButton })
  );
  if (typeof next === 'function') {
    await next();
  }
});

bot.catch(async (error, ctx) => {
  console.error('Bot error', error);
  if (!ctx || typeof ctx.reply !== 'function') {
    return;
  }

  try {
    const fromId = getNestedValue(ctx, ['from', 'id']);
    const user = fromId ? await repository.getUser(fromId) : null;
    const language = getUserLanguage(user);
    await ctx.reply(t(language, 'genericError'));
  } catch (innerError) {
    console.error('Failed to send error message', innerError);
  }
});

bot
  .launch()
  .then(() => {
    console.log('🤖 Bot started');
  })
  .catch((error) => {
    console.error('Failed to launch bot', error);
    process.exit(1);
  });

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

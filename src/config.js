const dotenv = require('dotenv');

dotenv.config();

function parseAdminIds(value) {
  if (!value) return [];
  return value
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => Number(id))
    .filter((id) => !Number.isNaN(id));
}

function getConfig() {
  const botToken = process.env.BOT_TOKEN;

  if (!botToken) {
    throw new Error('Missing BOT_TOKEN environment variable');
  }

  return {
    botToken,
    admins: parseAdminIds(process.env.ADMIN_IDS),
    defaultStopWorkMessage:
      process.env.STOP_WORK_MESSAGE ||
      'Бот временно не принимает команды. Попробуйте позже.',
  };
}

module.exports = {
  getConfig,
};

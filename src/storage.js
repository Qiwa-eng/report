const path = require('path');
const fs = require('fs');

const defaultData = {
  settings: {
    stopWork: {
      active: false,
      until: null,
      message: null,
    },
    defaultStopWorkMessage: null,
  },
  lines: [],
  users: [],
  applications: [],
  admins: [],
  coldProfiles: [],
  complaints: [],
};

const clone = (value) =>
  typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));

let dbPromise;

async function ensureDb() {
  const [{ Low }, { JSONFile }] = await Promise.all([
    import('lowdb'),
    import('lowdb/node'),
  ]);

  const file = path.join(__dirname, '..', 'data', 'db.json');
  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  const adapter = new JSONFile(file);
  const db = new Low(adapter, clone(defaultData));
  await db.read();
  if (!db.data) {
    db.data = clone(defaultData);
    await db.write();
  }
  return db;
}

async function getDb() {
  if (!dbPromise) {
    dbPromise = ensureDb();
  }
  return dbPromise;
}

module.exports = {
  getDb,
  defaultData,
};

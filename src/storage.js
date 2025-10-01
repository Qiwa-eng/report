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

class JsonFileDb {
  constructor(file, data) {
    this.file = file;
    this.data = data;
  }

  async read() {
    try {
      const content = await fs.promises.readFile(this.file, 'utf8');
      if (!content.trim()) {
        this.data = clone(defaultData);
        await this.write();
        return;
      }

      this.data = JSON.parse(content);
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        this.data = clone(defaultData);
        await this.write();
        return;
      }

      if (error instanceof SyntaxError) {
        this.data = clone(defaultData);
        await this.write();
        return;
      }

      throw error;
    }
  }

  async write() {
    const directory = path.dirname(this.file);
    await fs.promises.mkdir(directory, { recursive: true });
    const payload = JSON.stringify(this.data, null, 2);
    await fs.promises.writeFile(this.file, `${payload}\n`, 'utf8');
  }
}

let dbPromise;

async function ensureDb() {
  const file = path.join(__dirname, '..', 'data', 'db.json');
  await fs.promises.mkdir(path.dirname(file), { recursive: true });

  let data = clone(defaultData);
  let needsWrite = true;

  try {
    const content = await fs.promises.readFile(file, 'utf8');
    if (content.trim()) {
      data = JSON.parse(content);
      needsWrite = false;
    }
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      // File does not exist yet — will be created below.
    } else if (error instanceof SyntaxError) {
      // Corrupted JSON — reset to defaults and overwrite the file.
      needsWrite = true;
    } else {
      throw error;
    }
  }

  const db = new JsonFileDb(file, data);

  if (needsWrite) {
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

const { nanoid } = require('nanoid');
const { getDb } = require('./storage');

async function readDb() {
  const db = await getDb();
  await db.read();
  return db;
}

async function writeDb(db) {
  await db.write();
}

function now() {
  return new Date().toISOString();
}

async function upsertUser(userPayload) {
  const db = await readDb();
  const userId = Number(userPayload.id);
  let user = db.data.users.find((item) => Number(item.id) === userId);

  if (!user) {
    user = {
      id: userId,
      username: userPayload.username || null,
      firstName: userPayload.first_name || userPayload.firstName || null,
      lastName: userPayload.last_name || userPayload.lastName || null,
      status: userPayload.status || 'pending',
      lineIds: userPayload.lineIds || [],
      mutedUntil: null,
      language: userPayload.language ?? null,
      createdAt: now(),
      updatedAt: now(),
    };
    db.data.users.push(user);
  } else {
    Object.assign(user, {
      username: userPayload.username ?? user.username,
      firstName:
        userPayload.first_name || userPayload.firstName || user.firstName,
      lastName: userPayload.last_name || userPayload.lastName || user.lastName,
      updatedAt: now(),
    });

    if (userPayload.language !== undefined) {
      user.language = userPayload.language;
    }
  }

  await writeDb(db);
  return user;
}

async function assertUserExists(db, userId) {
  const user = db.data.users.find((item) => Number(item.id) === Number(userId));
  if (!user) {
    throw new Error(`User ${userId} not found`);
  }
  return user;
}

async function setUserStatus(userId, status) {
  const db = await readDb();
  const user = await assertUserExists(db, userId);

  user.status = status;
  user.updatedAt = now();
  await writeDb(db);
  return user;
}

async function setUserMute(userId, mutedUntil) {
  const db = await readDb();
  const user = await assertUserExists(db, userId);

  user.mutedUntil = mutedUntil;
  user.updatedAt = now();
  await writeDb(db);
  return user;
}

async function setUserLanguage(userId, language) {
  const db = await readDb();
  const user = await assertUserExists(db, userId);

  user.language = language;
  user.updatedAt = now();
  await writeDb(db);
  return user;
}

async function getUser(userId) {
  const db = await readDb();
  return (
    db.data.users.find((item) => Number(item.id) === Number(userId)) || null
  );
}

async function getUsers() {
  const db = await readDb();
  return db.data.users;
}

async function createLine({ id, title }) {
  const db = await readDb();
  const existing = db.data.lines.find((line) => line.id === id);

  if (existing) {
    throw new Error(`Line with id ${id} already exists`);
  }

  const line = {
    id,
    title: title || `Линия ${id}`,
    groupId: null,
    userIds: [],
    createdAt: now(),
    updatedAt: now(),
  };

  db.data.lines.push(line);
  await writeDb(db);
  return line;
}

async function getLine(lineId) {
  const db = await readDb();
  return db.data.lines.find((line) => line.id === lineId) || null;
}

async function getLines() {
  const db = await readDb();
  return db.data.lines;
}

async function updateLine(lineId, patch) {
  const db = await readDb();
  const line = db.data.lines.find((item) => item.id === lineId);

  if (!line) {
    throw new Error(`Line ${lineId} not found`);
  }

  Object.assign(line, patch, { updatedAt: now() });
  await writeDb(db);
  return line;
}

async function attachUserToLine(userId, lineId) {
  const db = await readDb();
  const user = await assertUserExists(db, userId);
  const line = db.data.lines.find((item) => item.id === lineId);

  if (!line) {
    throw new Error(`Line ${lineId} not found`);
  }

  if (!user.lineIds.includes(lineId)) {
    user.lineIds.push(lineId);
  }

  if (!line.userIds.includes(user.id)) {
    line.userIds.push(user.id);
  }

  user.updatedAt = now();
  line.updatedAt = now();
  await writeDb(db);

  return { user, line };
}

async function detachUserFromLine(userId, lineId) {
  const db = await readDb();
  const user = await assertUserExists(db, userId);
  const line = db.data.lines.find((item) => item.id === lineId);

  if (!line) {
    throw new Error(`Line ${lineId} not found`);
  }

  user.lineIds = user.lineIds.filter((id) => id !== lineId);
  line.userIds = line.userIds.filter((id) => Number(id) !== user.id);

  user.updatedAt = now();
  line.updatedAt = now();
  await writeDb(db);

  return { user, line };
}

async function setLineGroup(lineId, groupId) {
  return updateLine(lineId, { groupId: groupId ? Number(groupId) : null });
}

async function createApplication(userId) {
  const db = await readDb();
  const existing = db.data.applications.find(
    (item) => item.userId === Number(userId) && item.status === 'pending'
  );

  if (existing) {
    return { application: existing, created: false };
  }

  const application = {
    id: nanoid(10),
    userId: Number(userId),
    status: 'pending',
    createdAt: now(),
    updatedAt: now(),
    lineId: null,
    comment: null,
  };

  db.data.applications.push(application);
  await writeDb(db);
  return { application, created: true };
}

async function updateApplication(applicationId, patch) {
  const db = await readDb();
  const application = db.data.applications.find((item) => item.id === applicationId);

  if (!application) {
    throw new Error(`Application ${applicationId} not found`);
  }

  Object.assign(application, patch, { updatedAt: now() });
  await writeDb(db);
  return application;
}

async function getApplicationById(applicationId) {
  const db = await readDb();
  return db.data.applications.find((item) => item.id === applicationId) || null;
}

async function getPendingApplications() {
  const db = await readDb();
  return db.data.applications.filter((item) => item.status === 'pending');
}

async function setStopWork({ active, until, message }) {
  const db = await readDb();
  db.data.settings.stopWork = {
    active: Boolean(active),
    until: until || null,
    message: message || null,
  };
  await writeDb(db);
  return db.data.settings.stopWork;
}

async function getSettings() {
  const db = await readDb();
  return db.data.settings;
}

module.exports = {
  upsertUser,
  setUserStatus,
  setUserMute,
  setUserLanguage,
  getUser,
  getUsers,
  createLine,
  getLine,
  getLines,
  updateLine,
  attachUserToLine,
  detachUserFromLine,
  setLineGroup,
  createApplication,
  updateApplication,
  getApplicationById,
  getPendingApplications,
  setStopWork,
  getSettings,
};

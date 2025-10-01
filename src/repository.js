const { nanoid } = require('nanoid');
const { getDb, defaultData } = require('./storage');

function clone(value) {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function applyDefaults(target, defaults) {
  let changed = false;

  for (const [key, defaultValue] of Object.entries(defaults)) {
    const currentValue = target[key];

    if (currentValue === undefined) {
      let nextValue;

      if (Array.isArray(defaultValue)) {
        nextValue = [];
      } else if (
        defaultValue &&
        typeof defaultValue === 'object'
      ) {
        nextValue = clone(defaultValue);
      } else {
        nextValue = defaultValue;
      }

      target[key] = nextValue;
      changed = true;
      continue;
    }

    if (
      currentValue &&
      typeof currentValue === 'object' &&
      !Array.isArray(currentValue) &&
      defaultValue &&
      typeof defaultValue === 'object' &&
      !Array.isArray(defaultValue)
    ) {
      if (applyDefaults(currentValue, defaultValue)) {
        changed = true;
      }
    }
  }

  return changed;
}

async function readDb() {
  const db = await getDb();
  await db.read();

  if (!db.data) {
    db.data = clone(defaultData);
    await db.write();
    return db;
  }

  if (applyDefaults(db.data, defaultData)) {
    await db.write();
  }

  return db;
}

async function writeDb(db) {
  await db.write();
}

function now() {
  return new Date().toISOString();
}

function normalizeUsername(username) {
  if (!username) {
    return '';
  }

  return String(username).trim().replace(/^@+/, '').toLowerCase();
}

function formatDisplayUsername(username) {
  const normalized = normalizeUsername(username);
  if (!normalized) {
    return '';
  }

  return `@${normalized}`;
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

async function setDefaultStopWorkMessage(message) {
  const db = await readDb();
  const value = typeof message === 'string' ? message.trim() : '';
  db.data.settings.defaultStopWorkMessage = value ? value : null;
  await writeDb(db);
  return db.data.settings.defaultStopWorkMessage;
}

async function getDefaultStopWorkMessage() {
  const db = await readDb();
  return db.data.settings.defaultStopWorkMessage || null;
}

async function upsertColdProfiles(ownerId, lineId, items) {
  const db = await readDb();
  const owner = await assertUserExists(db, ownerId);
  const line = db.data.lines.find((entry) => entry.id === lineId);

  if (!line) {
    throw new Error(`Line ${lineId} not found`);
  }

  const processedProfiles = [];
  let created = 0;
  let updated = 0;

  const normalizedItems = items
    .map((item) => ({
      username: formatDisplayUsername(item.username),
      normalizedUsername: normalizeUsername(item.username),
      sip: String(item.sip || '').trim(),
    }))
    .filter((item) => item.normalizedUsername && item.sip);

  for (const entry of normalizedItems) {
    let profile = db.data.coldProfiles.find(
      (item) => item.normalizedUsername === entry.normalizedUsername
    );

    if (!profile) {
      profile = {
        id: nanoid(10),
        ownerId: owner.id,
        lineId,
        sip: entry.sip,
        username: entry.username,
        normalizedUsername: entry.normalizedUsername,
        userId: null,
        createdAt: now(),
        updatedAt: now(),
      };
      db.data.coldProfiles.push(profile);
      created += 1;
    } else {
      profile.ownerId = owner.id;
      profile.lineId = lineId;
      profile.sip = entry.sip;
      profile.username = entry.username;
      profile.updatedAt = now();
      updated += 1;
    }

    processedProfiles.push(profile);

    if (profile.userId) {
      const coldUser = db.data.users.find(
        (user) => Number(user.id) === Number(profile.userId)
      );

      if (coldUser) {
        coldUser.lineIds = [lineId];
        coldUser.status = 'active';
        coldUser.updatedAt = now();
      }

      for (const item of db.data.lines) {
        if (item.id === lineId) {
          if (!item.userIds.includes(profile.userId)) {
            item.userIds.push(profile.userId);
          }
          item.updatedAt = now();
        } else {
          const nextUserIds = item.userIds.filter(
            (id) => Number(id) !== Number(profile.userId)
          );
          if (nextUserIds.length !== item.userIds.length) {
            item.userIds = nextUserIds;
            item.updatedAt = now();
          }
        }
      }
    }
  }

  line.updatedAt = now();
  await writeDb(db);

  return { created, updated, processed: processedProfiles.length, profiles: processedProfiles };
}

async function getColdProfilesByOwner(ownerId) {
  const db = await readDb();
  return db.data.coldProfiles.filter((item) => Number(item.ownerId) === Number(ownerId));
}

async function getColdProfileByUsername(username) {
  const normalized = normalizeUsername(username);
  if (!normalized) {
    return null;
  }

  const db = await readDb();
  return (
    db.data.coldProfiles.find((item) => item.normalizedUsername === normalized) || null
  );
}

async function setColdProfileUser(profileId, userId) {
  const db = await readDb();
  const profile = db.data.coldProfiles.find((item) => item.id === profileId);

  if (!profile) {
    throw new Error(`Cold profile ${profileId} not found`);
  }

  profile.userId = userId ? Number(userId) : null;
  profile.updatedAt = now();
  await writeDb(db);
  return profile;
}

async function getColdProfileByUserId(userId) {
  const db = await readDb();
  return (
    db.data.coldProfiles.find((item) => Number(item.userId) === Number(userId)) || null
  );
}

async function createComplaint({ userId, lineId, sip, message, coldProfileId }) {
  const db = await readDb();

  const complaint = {
    id: nanoid(10),
    userId: Number(userId),
    lineId,
    sip: sip ? String(sip) : null,
    message: message || '',
    status: 'new',
    coldProfileId: coldProfileId || null,
    logChatId: null,
    logMessageId: null,
    createdAt: now(),
    updatedAt: now(),
  };

  db.data.complaints.push(complaint);
  await writeDb(db);
  return complaint;
}

async function setComplaintLogInfo(complaintId, { chatId, messageId }) {
  const db = await readDb();
  const complaint = db.data.complaints.find((item) => item.id === complaintId);

  if (!complaint) {
    throw new Error(`Complaint ${complaintId} not found`);
  }

  complaint.logChatId = chatId ? Number(chatId) : null;
  complaint.logMessageId = messageId ? Number(messageId) : null;
  complaint.updatedAt = now();
  await writeDb(db);
  return complaint;
}

async function getComplaintById(complaintId) {
  const db = await readDb();
  return db.data.complaints.find((item) => item.id === complaintId) || null;
}

async function updateComplaintStatus(complaintId, status, actorId) {
  const db = await readDb();
  const complaint = db.data.complaints.find((item) => item.id === complaintId);

  if (!complaint) {
    throw new Error(`Complaint ${complaintId} not found`);
  }

  complaint.status = status;
  complaint.resolvedBy = actorId ? Number(actorId) : null;
  complaint.resolvedAt = now();
  complaint.updatedAt = now();
  await writeDb(db);
  return complaint;
}

async function deleteComplaint(complaintId) {
  const db = await readDb();
  const index = db.data.complaints.findIndex((item) => item.id === complaintId);

  if (index === -1) {
    return false;
  }

  db.data.complaints.splice(index, 1);
  await writeDb(db);
  return true;
}

async function getSipStatistics() {
  const db = await readDb();
  const accumulator = new Map();

  for (const complaint of db.data.complaints) {
    if (!complaint.sip) {
      continue;
    }

    const key = `${complaint.lineId}:::${complaint.sip}`;
    if (!accumulator.has(key)) {
      accumulator.set(key, {
        lineId: complaint.lineId,
        sip: complaint.sip,
        total: 0,
        resolved: 0,
        cancelled: 0,
      });
    }

    const record = accumulator.get(key);
    record.total += 1;
    if (complaint.status === 'resolved') {
      record.resolved += 1;
    }
    if (complaint.status === 'cancelled') {
      record.cancelled += 1;
    }
  }

  return Array.from(accumulator.values()).sort((a, b) => {
    if (b.total !== a.total) {
      return b.total - a.total;
    }

    if (a.lineId !== b.lineId) {
      return String(a.lineId).localeCompare(String(b.lineId));
    }

    return String(a.sip).localeCompare(String(b.sip));
  });
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
  setDefaultStopWorkMessage,
  getDefaultStopWorkMessage,
  upsertColdProfiles,
  getColdProfilesByOwner,
  getColdProfileByUsername,
  setColdProfileUser,
  getColdProfileByUserId,
  createComplaint,
  setComplaintLogInfo,
  getComplaintById,
  updateComplaintStatus,
  deleteComplaint,
  getSipStatistics,
};

import { MongoClient } from 'mongodb';
import fs from 'node:fs';
import path from 'node:path';
import { BufferJSON, initAuthCreds, proto } from '@whiskeysockets/baileys';

let clientPromise;
let database;

export async function connectMongo() {
  const uri = String(process.env.MONGODB_URI || '').trim();
  if (!uri) return null;
  if (!clientPromise) {
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: Number(process.env.MONGODB_TIMEOUT_MS || 10000),
      maxPoolSize: 10,
      retryWrites: true,
    });
    clientPromise = client.connect().then(async () => {
      database = client.db(process.env.MONGODB_DB_NAME || 'flowtech');
      await database.collection('whatsapp_auth').createIndex({ userId: 1, type: 1, keyId: 1 }, { unique: true });
      await database.collection('app_users').createIndex({ id: 1 }, { unique: true });
      return database;
    }).catch((error) => {
      clientPromise = null;
      throw error;
    });
  }
  return clientPromise;
}

export function getMongoDb() {
  if (!database) throw new Error('MongoDB is not connected. Set MONGODB_URI in the hosting environment.');
  return database;
}

const serialize = (value) => JSON.stringify(value, BufferJSON.replacer);
const deserialize = (value) => JSON.parse(value, BufferJSON.reviver);

function legacySessionRecords(sessionDir, owner) {
  if (!sessionDir || !fs.existsSync(sessionDir)) return [];
  const knownTypes = [
    'app-state-sync-key-share', 'app-state-sync-key-request', 'app-state-sync-version',
    'app-state-sync-key', 'sender-key-memory', 'device-list', 'lid-mapping',
    'pn-mapping', 'sender-key', 'pre-key', 'session', 'tctoken',
  ].sort((a, b) => b.length - a.length);
  const records = [];
  for (const file of fs.readdirSync(sessionDir)) {
    if (!file.endsWith('.json')) continue;
    const stem = file.slice(0, -5);
    let type, keyId;
    if (stem === 'creds') { type = 'creds'; keyId = 'main'; }
    else {
      const prefix = knownTypes.find((candidate) => stem.startsWith(`${candidate}-`));
      if (!prefix) continue;
      type = prefix;
      keyId = stem.slice(prefix.length + 1);
    }
    try {
      const value = JSON.parse(fs.readFileSync(path.join(sessionDir, file), 'utf8'), BufferJSON.reviver);
      records.push({ userId: owner, type, keyId, value: serialize(value), updatedAt: new Date() });
    } catch { /* skip unreadable legacy files */ }
  }
  return records;
}

export async function useMongoAuthState(userId, legacySessionDir = null) {
  await connectMongo();
  const collection = getMongoDb().collection('whatsapp_auth');
  const owner = String(userId);
  const readOne = async (type, keyId = 'main') => collection.findOne({ userId: owner, type, keyId });
  let credsDoc = await readOne('creds');
  if (!credsDoc && legacySessionDir) {
    const legacy = legacySessionRecords(legacySessionDir, owner);
    if (legacy.length) {
      for (const record of legacy) {
        await collection.updateOne(
          { userId: owner, type: record.type, keyId: record.keyId },
          { $setOnInsert: { value: record.value, updatedAt: record.updatedAt } },
          { upsert: true },
        );
      }
      credsDoc = await readOne('creds');
    }
  }
  const creds = credsDoc?.value ? deserialize(credsDoc.value) : initAuthCreds();

  const keys = {
    async get(type, ids) {
      const wanted = ids.map((keyId) => ({ userId: owner, type, keyId: String(keyId) }));
      if (!wanted.length) return {};
      const docs = await collection.find({ $or: wanted }).toArray();
      const result = {};
      for (const id of ids) {
        const doc = docs.find((item) => item.keyId === String(id));
        if (!doc) continue;
        try {
          const value = deserialize(doc.value);
          result[id] = type === 'app-state-sync-key' ? proto.Message.AppStateSyncKeyData.fromObject(value) : value;
        } catch { /* ignore a malformed legacy record */ }
      }
      return result;
    },
    async set(data) {
      const operations = [];
      for (const [type, entries] of Object.entries(data || {})) {
        for (const [keyId, value] of Object.entries(entries || {})) {
          const filter = { userId: owner, type, keyId: String(keyId) };
          if (value == null) operations.push({ deleteOne: { filter } });
          else operations.push({ updateOne: { filter, update: { $set: { value: serialize(value), updatedAt: new Date() } }, upsert: true } });
        }
      }
      if (operations.length) await collection.bulkWrite(operations, { ordered: false });
    },
  };

  return {
    state: { creds, keys },
    async saveCreds() {
      await collection.updateOne(
        { userId: owner, type: 'creds', keyId: 'main' },
        { $set: { value: serialize(creds), updatedAt: new Date() } },
        { upsert: true },
      );
    },
  };
}

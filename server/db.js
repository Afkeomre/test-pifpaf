const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// Путь к базе можно переопределить переменной DB_PATH (абсолютный путь).
// На Amvera база живёт в постоянном хранилище: DB_PATH=/data/pifpaf.db.
const DB_FILE = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'pifpaf.db');
const DATA_DIR = path.dirname(DB_FILE);
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

module.exports = db;
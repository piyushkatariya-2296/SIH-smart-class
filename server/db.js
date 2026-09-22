const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
require('dotenv').config();

let pgPool = null;
let sqliteDb = null;
let useSQLite = false;

// Connection Configuration
const pgConnectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/smartclass';

async function initDatabase() {
  // First, try PostgreSQL
  try {
    console.log('Attempting to connect to PostgreSQL...');
    pgPool = new Pool({
      connectionString: pgConnectionString,
      connectionTimeoutMillis: 5000
    });
    
    // Test connection
    const client = await pgPool.connect();
    client.release();
    console.log('Successfully connected to PostgreSQL.');
    useSQLite = false;
  } catch (err) {
    console.warn('PostgreSQL connection failed or database not found:', err.message);
    console.log('Falling back to SQLite database (smartclass.db)...');
    
    const dbPath = path.resolve(__dirname, 'smartclass.db');
    sqliteDb = new sqlite3.Database(dbPath);
    useSQLite = true;
  }

  // Create tables and seed data
  await runMigrations();
}

async function query(text, params = []) {
  if (!useSQLite) {
    // Postgres direct query
    try {
      const res = await pgPool.query(text, params);
      return res;
    } catch (err) {
      console.error('Postgres Query Error:', err, 'SQL:', text);
      throw err;
    }
  } else {
    // SQLite query translation wrapper
    return new Promise((resolve, reject) => {
      // 1. Translate Postgres parameter style ($1, $2, etc.) to SQLite style (?, ?)
      let sqliteText = text.replace(/\$\d+/g, '?');
      
      // 2. Translate RETURNING clauses. SQLite 3.35.0+ supports RETURNING,
      // but to be extremely safe, if it fails or if we want to handle lastID:
      const isInsert = sqliteText.trim().toUpperCase().startsWith('INSERT');
      let hasReturning = false;
      let returningCol = 'id';
      
      if (sqliteText.toUpperCase().includes('RETURNING')) {
        hasReturning = true;
        const match = sqliteText.match(/RETURNING\s+(\w+)/i);
        if (match) returningCol = match[1];
        // Strip the RETURNING clause for SQLite if needed (but SQLite 3.35+ supports it, so let's try it first)
      }

      // Execute query
      sqliteDb.all(sqliteText, params, function(err, rows) {
        if (err) {
          // If SQLite doesn't support RETURNING, let's strip it and run as statement
          if (err.message.includes('returning') || err.message.includes('syntax error')) {
            const strippedText = sqliteText.replace(/RETURNING\s+.+$/i, '');
            sqliteDb.run(strippedText, params, function(err2) {
              if (err2) {
                console.error('SQLite Fallback Error:', err2, 'SQL:', strippedText);
                return reject(err2);
              }
              // Return the inserted ID in Postgres format
              resolve({ rows: [{ [returningCol]: this.lastID }], rowCount: 1 });
            });
          } else {
            console.error('SQLite Query Error:', err, 'SQL:', sqliteText);
            reject(err);
          }
        } else {
          resolve({ rows: rows || [], rowCount: rows ? rows.length : 0 });
        }
      });
    });
  }
}

async function runMigrations() {
  console.log('Running database migrations...');
  
  // Define SQL tables creation
  // Note: We use SERIAL for PG and INTEGER PRIMARY KEY AUTOINCREMENT for SQLite.
  // We'll write the script using dialect-agnostic syntax or execute conditionally.
  
  const tables = [
    // 1. Users
    useSQLite 
      ? `CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL
        )`
      : `CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(100) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(20) NOT NULL
        )`,

    // 2. Lectures
    useSQLite
      ? `CREATE TABLE IF NOT EXISTS lectures (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT,
          teacher_id INTEGER,
          audio_path TEXT,
          status TEXT DEFAULT 'recording',
          duration INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(teacher_id) REFERENCES users(id)
        )`
      : `CREATE TABLE IF NOT EXISTS lectures (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          teacher_id INT REFERENCES users(id),
          audio_path VARCHAR(255),
          status VARCHAR(20) DEFAULT 'recording',
          duration INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

    // 3. Transcripts
    useSQLite
      ? `CREATE TABLE IF NOT EXISTS transcripts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lecture_id INTEGER NOT NULL,
          raw_text TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(lecture_id) REFERENCES lectures(id) ON DELETE CASCADE
        )`
      : `CREATE TABLE IF NOT EXISTS transcripts (
          id SERIAL PRIMARY KEY,
          lecture_id INT REFERENCES lectures(id) ON DELETE CASCADE,
          raw_text TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

    // 4. Notes
    useSQLite
      ? `CREATE TABLE IF NOT EXISTS notes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lecture_id INTEGER NOT NULL,
          summary TEXT NOT NULL,
          structured_notes TEXT NOT NULL,
          key_points TEXT NOT NULL, -- Keep as text string representing JSON array in SQLite
          practice_questions TEXT NOT NULL, -- Keep as text JSON in SQLite
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(lecture_id) REFERENCES lectures(id) ON DELETE CASCADE
        )`
      : `CREATE TABLE IF NOT EXISTS notes (
          id SERIAL PRIMARY KEY,
          lecture_id INT REFERENCES lectures(id) ON DELETE CASCADE,
          summary TEXT NOT NULL,
          structured_notes TEXT NOT NULL,
          key_points JSONB NOT NULL,
          practice_questions JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

    // 5. Students
    useSQLite
      ? `CREATE TABLE IF NOT EXISTS students (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
        )`
      : `CREATE TABLE IF NOT EXISTS students (
          id SERIAL PRIMARY KEY,
          user_id INT REFERENCES users(id) ON DELETE SET NULL,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

    // 6. Scores
    useSQLite
      ? `CREATE TABLE IF NOT EXISTS scores (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          student_id INTEGER NOT NULL,
          topic TEXT NOT NULL,
          score_type TEXT NOT NULL,
          score REAL NOT NULL,
          max_score REAL NOT NULL,
          date TEXT DEFAULT (date('now')),
          FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
        )`
      : `CREATE TABLE IF NOT EXISTS scores (
          id SERIAL PRIMARY KEY,
          student_id INT REFERENCES students(id) ON DELETE CASCADE,
          topic VARCHAR(100) NOT NULL,
          score_type VARCHAR(20) NOT NULL,
          score DECIMAL(5,2) NOT NULL,
          max_score DECIMAL(5,2) NOT NULL,
          date DATE DEFAULT CURRENT_DATE
        )`,

    // 7. Remedial Content
    useSQLite
      ? `CREATE TABLE IF NOT EXISTS remedial_content (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          student_id INTEGER NOT NULL,
          topic TEXT NOT NULL,
          title TEXT NOT NULL,
          slides TEXT NOT NULL, -- JSON string
          worked_example TEXT, -- JSON string representing worked example
          practice_questions TEXT NOT NULL, -- JSON string
          status TEXT DEFAULT 'assigned',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
        )`
      : `CREATE TABLE IF NOT EXISTS remedial_content (
          id SERIAL PRIMARY KEY,
          student_id INT REFERENCES students(id) ON DELETE CASCADE,
          topic VARCHAR(100) NOT NULL,
          title VARCHAR(255) NOT NULL,
          slides JSONB NOT NULL,
          worked_example JSONB,
          practice_questions JSONB NOT NULL,
          status VARCHAR(20) DEFAULT 'assigned',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
  ];

  try {
    for (const sql of tables) {
      await query(sql);
    }
    console.log('Database tables verified/created successfully.');
    await seedDefaultData();
  } catch (err) {
    console.error('Failed to run database migrations:', err);
  }
}

async function seedDefaultData() {
  try {
    // 1. Seed Users (Teacher, Student, Admin)
    const usersCount = await query('SELECT COUNT(*) as count FROM users');
    const count = parseInt(usersCount.rows[0].count || usersCount.rows[0].COUNT || 0);
    
    if (count === 0) {
      console.log('Seeding default users...');
      // Insert users
      await query("INSERT INTO users (username, password_hash, role) VALUES ('teacher1', 'pbkdf2_sha256$mockhash$teacher', 'teacher')");
      await query("INSERT INTO users (username, password_hash, role) VALUES ('student1', 'pbkdf2_sha256$mockhash$student', 'student')");
      await query("INSERT INTO users (username, password_hash, role) VALUES ('admin1', 'pbkdf2_sha256$mockhash$admin', 'admin')");
      
      const teacherIdRes = await query("SELECT id FROM users WHERE username = 'teacher1'");
      const studentIdRes = await query("SELECT id FROM users WHERE username = 'student1'");
      
      // 2. Seed Students
      console.log('Seeding student directory...');
      await query("INSERT INTO students (name, email, user_id) VALUES ('Alex Rivera', 'alex@class.com', $1)", [studentIdRes.rows[0].id]);
      await query("INSERT INTO students (name, email) VALUES ('Jordan Lee', 'jordan@class.com')");
      await query("INSERT INTO students (name, email) VALUES ('Taylor Smith', 'taylor@class.com')");
      await query("INSERT INTO students (name, email) VALUES ('Morgan Jones', 'morgan@class.com')");
      await query("INSERT INTO students (name, email) VALUES ('Casey Patel', 'casey@class.com')");

      // 3. Seed Scores to trigger remedial flag on some students
      // We will flag Jordan Lee and Taylor Smith in specific topics.
      console.log('Seeding quiz and assignment scores...');
      const studentsList = await query("SELECT id, name FROM students");
      const students = studentsList.rows;
      
      const findStudentId = (name) => students.find(s => s.name === name).id;
      
      const alexId = findStudentId('Alex Rivera');
      const jordanId = findStudentId('Jordan Lee');
      const taylorId = findStudentId('Taylor Smith');
      const morganId = findStudentId('Morgan Jones');
      const caseyId = findStudentId('Casey Patel');

      // Topic: Algebra
      // Alex Rivera: Quiz=9/10, Assignment=8.5/10 (Mastery = 87.5%)
      await query("INSERT INTO scores (student_id, topic, score_type, score, max_score) VALUES ($1, 'Algebra', 'Quiz', 9, 10)", [alexId]);
      await query("INSERT INTO scores (student_id, topic, score_type, score, max_score) VALUES ($1, 'Algebra', 'Assignment', 8.5, 10)", [alexId]);
      
      // Jordan Lee: Quiz=5/10, Assignment=4.5/10 (Mastery = 47.5% - Flagged!)
      await query("INSERT INTO scores (student_id, topic, score_type, score, max_score) VALUES ($1, 'Algebra', 'Quiz', 5, 10)", [jordanId]);
      await query("INSERT INTO scores (student_id, topic, score_type, score, max_score) VALUES ($1, 'Algebra', 'Assignment', 4.5, 10)", [jordanId]);
      
      // Morgan Jones: Quiz=8/10, Assignment=7/10 (Mastery = 75%)
      await query("INSERT INTO scores (student_id, topic, score_type, score, max_score) VALUES ($1, 'Algebra', 'Quiz', 8, 10)", [morganId]);
      await query("INSERT INTO scores (student_id, topic, score_type, score, max_score) VALUES ($1, 'Algebra', 'Assignment', 7, 10)", [morganId]);

      // Topic: Photosynthesis
      // Jordan Lee: Quiz=9.5/10, Assignment=9/10 (Mastery = 92.5%)
      await query("INSERT INTO scores (student_id, topic, score_type, score, max_score) VALUES ($1, 'Photosynthesis', 'Quiz', 9.5, 10)", [jordanId]);
      await query("INSERT INTO scores (student_id, topic, score_type, score, max_score) VALUES ($1, 'Photosynthesis', 'Assignment', 9, 10)", [jordanId]);

      // Taylor Smith: Quiz=4/10, Assignment=6/10 (Mastery = 50% - Flagged!)
      await query("INSERT INTO scores (student_id, topic, score_type, score, max_score) VALUES ($1, 'Photosynthesis', 'Quiz', 4, 10)", [taylorId]);
      await query("INSERT INTO scores (student_id, topic, score_type, score, max_score) VALUES ($1, 'Photosynthesis', 'Assignment', 6, 10)", [taylorId]);

      // Casey Patel: Quiz=9/10, Assignment=9.5/10 (Mastery = 92.5%)
      await query("INSERT INTO scores (student_id, topic, score_type, score, max_score) VALUES ($1, 'Photosynthesis', 'Quiz', 9, 10)", [caseyId]);
      await query("INSERT INTO scores (student_id, topic, score_type, score, max_score) VALUES ($1, 'Photosynthesis', 'Assignment', 9.5, 10)", [caseyId]);
      
      console.log('Seeding completed successfully.');
    }
  } catch (err) {
    console.error('Failed to seed default data:', err);
  }
}

module.exports = {
  initDatabase,
  query,
  getUseSQLite: () => useSQLite
};

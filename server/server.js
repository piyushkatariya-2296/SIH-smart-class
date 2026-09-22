const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const db = require('./db');
const ai = require('./services/ai');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Multer storage setup for recorded lecture audio files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `lecture-${uniqueSuffix}${ext}`);
  }
});
const upload = multer({ storage });

// Initialize database connection
db.initDatabase().then(() => {
  console.log('Database initialized.');
});

/* =========================================================================
   ROUTES
   ========================================================================= */

// 1. Status Check
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    database: db.getUseSQLite() ? 'SQLite (Local Fallback)' : 'PostgreSQL',
    ai_mode: ai.isMockMode() ? 'Mock Engine (No Keys)' : 'Live AI APIs'
  });
});

// 2. Simple Mock Auth
app.post('/api/auth/login', async (req, res) => {
  const { username } = req.body;
  
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    const userRes = await db.query('SELECT * FROM users WHERE username = $1', [username.trim()]);
    if (userRes.rowCount === 0) {
      return res.status(401).json({ error: 'User not found. Try teacher1, student1, or admin1.' });
    }

    const user = userRes.rows[0];
    
    // If user is a student, fetch their student profile info too
    let studentInfo = null;
    if (user.role === 'student') {
      const studentRes = await db.query('SELECT * FROM students WHERE user_id = $1', [user.id]);
      if (studentRes.rowCount > 0) {
        studentInfo = studentRes.rows[0];
      }
    }

    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      student: studentInfo
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Get all students
app.get('/api/students', async (req, res) => {
  try {
    const studentsRes = await db.query('SELECT * FROM students ORDER BY name ASC');
    res.json(studentsRes.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Lecture Upload & Background Processing Pipeline
app.post('/api/lectures/upload', upload.single('audio'), async (req, res) => {
  const { title, description, teacher_id } = req.body;
  const audioFile = req.file;

  if (!title) {
    return res.status(400).json({ error: 'Lecture title is required' });
  }

  try {
    const audioPath = audioFile ? `/uploads/${audioFile.filename}` : null;
    const teacherIdInt = teacher_id ? parseInt(teacher_id) : null;
    
    // 1. Insert lecture record with 'transcribing' status
    const lectureInsert = await db.query(
      'INSERT INTO lectures (title, description, teacher_id, audio_path, status) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [title, description || '', teacherIdInt, audioPath, 'transcribing']
    );
    const lectureId = lectureInsert.rows[0].id;

    // Send immediate response back to client so they don't timeout while AI is running
    res.status(202).json({
      id: lectureId,
      title,
      status: 'transcribing',
      message: 'Lecture uploaded. Audio processing started in the background.'
    });

    // 2. Perform background processing asynchronously
    processLectureAudioInBackground(lectureId, audioFile, title, description);

  } catch (err) {
    console.error('Upload Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Background Worker Function
async function processLectureAudioInBackground(lectureId, audioFile, title, description) {
  try {
    let transcriptText = '';
    
    if (audioFile) {
      const audioBuffer = fs.readFileSync(audioFile.path);
      const mimeType = audioFile.mimetype || 'audio/webm';
      
      // Perform Speech-to-Text
      transcriptText = await ai.transcribeAudio(audioBuffer, mimeType, title, description);
    } else {
      // If no file uploaded, generate mock transcription contextually
      console.log('No audio file provided. Generating mock transcription from title/desc...');
      transcriptText = await ai.transcribeAudio(Buffer.alloc(0), 'audio/webm', title, description);
    }

    // Save transcript text
    await db.query(
      'INSERT INTO transcripts (lecture_id, raw_text) VALUES ($1, $2)',
      [lectureId, transcriptText]
    );

    // Perform Lecture Notes & Study Materials generation
    const notesContent = await ai.generateNotes(transcriptText);

    // SQLite uses strings for JSON, Postgres uses JSONB. Convert if SQLite
    const keyPoints = db.getUseSQLite() ? JSON.stringify(notesContent.key_points) : notesContent.key_points;
    const practiceQuestions = db.getUseSQLite() ? JSON.stringify(notesContent.practice_questions) : notesContent.practice_questions;

    // Save notes
    await db.query(
      'INSERT INTO notes (lecture_id, summary, structured_notes, key_points, practice_questions) VALUES ($1, $2, $3, $4, $5)',
      [
        lectureId,
        notesContent.summary,
        notesContent.structured_notes,
        keyPoints,
        practiceQuestions
      ]
    );

    // Update lecture status to completed
    await db.query(
      'UPDATE lectures SET status = $1 WHERE id = $2',
      ['completed', lectureId]
    );
    console.log(`Lecture ID ${lectureId} background processing finished successfully.`);

  } catch (err) {
    console.error(`Background processing failed for Lecture ID ${lectureId}:`, err);
    await db.query(
      'UPDATE lectures SET status = $1 WHERE id = $2',
      ['failed', lectureId]
    );
  }
}

// 5. Get all lectures
app.get('/api/lectures', async (req, res) => {
  try {
    const lecturesRes = await db.query(
      `SELECT l.*, n.summary, u.username as teacher_name 
       FROM lectures l
       LEFT JOIN notes n ON n.lecture_id = l.id
       LEFT JOIN users u ON u.id = l.teacher_id
       ORDER BY l.created_at DESC`
    );
    res.json(lecturesRes.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Get single lecture details (Notes, Quiz, Transcript)
app.get('/api/lectures/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const lectureRes = await db.query('SELECT * FROM lectures WHERE id = $1', [id]);
    if (lectureRes.rowCount === 0) {
      return res.status(404).json({ error: 'Lecture not found' });
    }

    const transcriptRes = await db.query('SELECT * FROM transcripts WHERE lecture_id = $1', [id]);
    const notesRes = await db.query('SELECT * FROM notes WHERE lecture_id = $1', [id]);

    const lecture = lectureRes.rows[0];
    const transcript = transcriptRes.rowCount > 0 ? transcriptRes.rows[0].raw_text : null;
    let notes = notesRes.rowCount > 0 ? notesRes.rows[0] : null;

    if (notes) {
      // Parse JSON columns if SQLite
      if (db.getUseSQLite()) {
        try {
          notes.key_points = JSON.parse(notes.key_points);
          notes.practice_questions = JSON.parse(notes.practice_questions);
        } catch (e) {
          console.error('Error parsing SQLite notes columns:', e);
        }
      }
    }

    res.json({
      ...lecture,
      transcript,
      notes
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Student Analytics & Topic Mastery Scores
app.get('/api/analytics/mastery', async (req, res) => {
  try {
    // 1. Fetch all scores linked to students
    const queryStr = `
      SELECT s.id as student_id, s.name as student_name, s.email, sc.topic, sc.score_type, sc.score, sc.max_score
      FROM students s
      LEFT JOIN scores sc ON sc.student_id = s.id
    `;
    const scoresRes = await db.query(queryStr);
    
    // 2. Aggregate scores per student per topic
    const studentMastery = {};
    const topicSummary = {};

    scoresRes.rows.forEach(row => {
      const { student_id, student_name, email, topic, score, max_score } = row;
      
      if (!studentMastery[student_id]) {
        studentMastery[student_id] = {
          id: student_id,
          name: student_name,
          email: email,
          topics: {}
        };
      }

      if (topic) {
        if (!studentMastery[student_id].topics[topic]) {
          studentMastery[student_id].topics[topic] = {
            total_earned: 0,
            total_max: 0,
            scores: []
          };
        }
        
        studentMastery[student_id].topics[topic].total_earned += parseFloat(score);
        studentMastery[student_id].topics[topic].total_max += parseFloat(max_score);
        studentMastery[student_id].topics[topic].scores.push({
          score_type: row.score_type,
          score: parseFloat(score),
          max_score: parseFloat(max_score)
        });

        // Track topic stats globally
        if (!topicSummary[topic]) {
          topicSummary[topic] = {
            total_earned: 0,
            total_max: 0,
            student_count: 0,
            flagged_count: 0
          };
        }
      }
    });

    // 3. Format result, compute percentage, flag students under 60%
    const studentList = Object.values(studentMastery).map(student => {
      const topicDetails = {};
      let totalEarnedOverall = 0;
      let totalMaxOverall = 0;

      Object.entries(student.topics).forEach(([topicName, details]) => {
        const percentage = details.total_max > 0 
          ? Math.round((details.total_earned / details.total_max) * 100) 
          : 0;
        
        const flagged = percentage < 60; // Flag below 60%
        
        topicDetails[topicName] = {
          mastery_score: percentage,
          flagged: flagged,
          scores: details.scores
        };

        totalEarnedOverall += details.total_earned;
        totalMaxOverall += details.total_max;

        // Global topic stats
        topicSummary[topicName].total_earned += details.total_earned;
        topicSummary[topicName].total_max += details.total_max;
        topicSummary[topicName].student_count += 1;
        if (flagged) {
          topicSummary[topicName].flagged_count += 1;
        }
      });

      const overallMastery = totalMaxOverall > 0 
        ? Math.round((totalEarnedOverall / totalMaxOverall) * 100) 
        : 0;

      return {
        id: student.id,
        name: student.name,
        email: student.email,
        overall_mastery: overallMastery,
        topics: topicDetails
      };
    });

    // Compute global topic averages
    const topicsList = Object.entries(topicSummary).map(([topicName, stats]) => {
      const averageMastery = stats.total_max > 0 
        ? Math.round((stats.total_earned / stats.total_max) * 100) 
        : 0;

      return {
        topic: topicName,
        average_mastery: averageMastery,
        students_assessed: stats.student_count,
        flagged_students: stats.flagged_count
      };
    });

    res.json({
      students: studentList,
      topics: topicsList
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Add Student Scores (Quiz/Assignment)
app.post('/api/analytics/scores', async (req, res) => {
  const { student_id, topic, score_type, score, max_score } = req.body;

  if (!student_id || !topic || !score_type || score === undefined || !max_score) {
    return res.status(400).json({ error: 'Missing required grading parameters' });
  }

  try {
    const result = await db.query(
      'INSERT INTO scores (student_id, topic, score_type, score, max_score) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [parseInt(student_id), topic, score_type, parseFloat(score), parseFloat(max_score)]
    );
    res.status(201).json({ message: 'Score logged successfully', id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Generate Personalized Remedial Slide Deck
app.post('/api/remedial/generate', async (req, res) => {
  const { student_id, topic } = req.body;

  if (!student_id || !topic) {
    return res.status(400).json({ error: 'Student ID and Topic are required' });
  }

  try {
    // 1. Fetch student name
    const studentRes = await db.query('SELECT name FROM students WHERE id = $1', [student_id]);
    if (studentRes.rowCount === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    const studentName = studentRes.rows[0].name;

    // 2. Trigger AI slide generator
    const slidesData = await ai.generateRemedialSlides(studentName, topic);

    // Save JSON data depending on database
    const slidesJson = db.getUseSQLite() ? JSON.stringify(slidesData.slides) : slidesData.slides;
    const workedExampleJson = db.getUseSQLite() ? JSON.stringify(slidesData.worked_example) : slidesData.worked_example;
    const practiceQuestionsJson = db.getUseSQLite() ? JSON.stringify(slidesData.extra_practice_questions) : slidesData.extra_practice_questions;

    // 3. Save to database
    // Delete existing remedial content for student/topic if it exists to overwrite
    await db.query('DELETE FROM remedial_content WHERE student_id = $1 AND topic = $2', [student_id, topic]);

    const saveRes = await db.query(
      `INSERT INTO remedial_content (student_id, topic, title, slides, worked_example, practice_questions, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        parseInt(student_id),
        topic,
        slidesData.title || `${topic} Simplified`,
        slidesJson,
        workedExampleJson,
        practiceQuestionsJson,
        'assigned'
      ]
    );

    res.status(201).json({
      message: 'Remedial content generated successfully',
      id: saveRes.rows[0].id,
      topic,
      student_id,
      title: slidesData.title,
      slides: slidesData.slides,
      worked_example: slidesData.worked_example,
      practice_questions: slidesData.extra_practice_questions
    });
  } catch (err) {
    console.error('Failed to generate remedial slides:', err);
    res.status(500).json({ error: err.message });
  }
});

// 10. Get Remedial Content
app.get('/api/remedial', async (req, res) => {
  const { student_id } = req.query;
  try {
    let remedialRes;
    if (student_id) {
      remedialRes = await db.query(
        `SELECT rc.*, s.name as student_name 
         FROM remedial_content rc
         JOIN students s ON s.id = rc.student_id
         WHERE rc.student_id = $1
         ORDER BY rc.created_at DESC`,
        [parseInt(student_id)]
      );
    } else {
      remedialRes = await db.query(
        `SELECT rc.*, s.name as student_name 
         FROM remedial_content rc
         JOIN students s ON s.id = rc.student_id
         ORDER BY rc.created_at DESC`
      );
    }

    const items = remedialRes.rows.map(item => {
      let slides = item.slides;
      let practiceQuestions = item.practice_questions;
      let workedExample = item.worked_example;
      
      if (db.getUseSQLite()) {
        try {
          slides = JSON.parse(slides);
          practiceQuestions = JSON.parse(practiceQuestions);
          if (workedExample) workedExample = JSON.parse(workedExample);
        } catch (e) {
          console.error('Error parsing SQLite remedial columns:', e);
        }
      }

      return {
        ...item,
        slides,
        worked_example: workedExample,
        practice_questions: practiceQuestions
      };
    });

    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 11. Update Remedial Status
app.put('/api/remedial/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'assigned', 'reviewed', 'completed'

  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  try {
    await db.query(
      'UPDATE remedial_content SET status = $1 WHERE id = $2',
      [status, parseInt(id)]
    );
    res.json({ message: 'Remedial status updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`SmartClass backend running at http://localhost:${PORT}`);
  console.log(`API Status endpoint: http://localhost:${PORT}/api/status`);
});

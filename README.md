# 🎓 SmartClass: AI Lecture-to-Notes & Remedial Learning Platform

**SmartClass** is a state-of-the-art, full-stack education platform designed to empower teachers and students through GenAI. It transcribes audio lectures, generates study resources, aggregates mastery metrics, and drafts personalized remedial materials (slide decks + PPTX downloads) for students who need additional assistance.

---

## 🚀 Key Features

1.  **🎙️ Classroom Lecture Capture**:
    *   Start recording lectures directly from the browser mic with interactive waveform animations.
    *   Manual upload backup for pre-recorded audio files.
    *   Asynchronous background processing prevents HTTP request timeouts.
2.  **🤖 GenAI Lecture-to-Notes**:
    *   **Speech-to-Text**: Converts raw lecture audio into clean transcripts using Gemini or Whisper APIs.
    *   **Study Guides**: Generates structured executive summaries, comprehensive study notes (markdown), and key takeaways.
    *   **Interactive Quizzes**: Formulates 3-5 multiple-choice questions with answer checks and explanations.
3.  **📊 Student Mastery Analytics**:
    *   Teachers input quiz/assignment grades.
    *   App calculates Mastery scores: $\text{Mastery } (\%) = \left( \frac{\sum \text{Score}}{\sum \text{Max Score}} \right) \times 100$.
    *   Automatically flags students below **60%** with a "Needs Remedial Support" alert.
4.  **💡 Automated Remedial Learning**:
    *   Triggers LLM content generation for weak concepts.
    *   Constructs simplified slide decks using analogies, step-by-step worked examples, and extra questions.
    *   Renders slides in-app for studying.
    *   Exports slides to a real **PowerPoint presentation (.pptx)** file client-side.
5.  **👥 Role-Based Portals**:
    *   **Teacher Suite**: Start recordings, grade students, view mastery sheets, and trigger remedial materials.
    *   **Student Workspace**: Study notes, take interactive lecture quizzes, read assigned slides, and download PPTX.
    *   **Admin Dashboard**: View institutional stats, subject mastery distributions (SVG graphs), and weak concept triggers.

---

## 🛠️ Architecture & Tech Stack

*   **Frontend**: React 19 + Tailwind CSS v4, Lucide React (Icons), `pptxgenjs` (PPTX compiler).
*   **Backend**: Node.js + Express.js, Multer (audio upload).
*   **Database**: PostgreSQL (Primary) + SQLite (automatic zero-config fallback if PG is offline).
*   **AI Engine**: Google Gemini API / OpenAI API. (If no keys are provided, it falls back to a contextual mockup engine).

---

## 💻 Local Setup & Run Instructions

### 1. Prerequisite Checklist
*   Node.js (v18+) and npm installed.
*   PostgreSQL running (Optional - system falls back to a local `smartclass.db` SQLite file if PostgreSQL is not available).

### 2. Environment Configuration
Create a `.env` file in the `server/` directory:

```env
PORT=5000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smartclass
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
```
> **Note:** If `GEMINI_API_KEY` and `OPENAI_API_KEY` are left blank, the app will run in **Mock AI Mode**. It will dynamically read your uploaded lecture title/description and generate contextual mock transcripts and notes, and generate detailed remedial math/science slides so you can fully test the application features immediately!

### 3. Installation
Open two terminal windows:

#### Terminal A: Start Backend Server
```bash
cd server
npm install
npm start
```
*The database and seed data (users: `teacher1`, `student1`, `admin1`, and sample scores) will initialize on startup.*

#### Terminal B: Start Frontend Development Server
```bash
# In the root project folder
npm install
npm run dev
```

### 4. Open in Browser
Visit the development URL (usually `http://localhost:5173`).
*   Log in as **Teacher** using username `teacher1`
*   Log in as **Student** using username `student1`
*   Log in as **Admin** using username `admin1`

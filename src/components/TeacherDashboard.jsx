import React, { useState, useEffect, useRef } from 'react';
import { Shield, Users, BookOpen, AlertTriangle, Play, Square, Upload, Award, FileText, CheckCircle2, ChevronRight, BarChart3, Plus, Mic, AlertCircle, Eye } from 'lucide-react';
import RemedialPresentation from './RemedialPresentation';

export default function TeacherDashboard({ user, onLogout }) {
  // Lecture List & Form State
  const [lectures, setLectures] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  
  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  
  // Grading & Student Mastery State
  const [students, setStudents] = useState([]);
  const [analytics, setAnalytics] = useState({ students: [], topics: [] });
  const [remedialDecks, setRemedialDecks] = useState([]);
  
  // Grading Form State
  const [selectedStudent, setSelectedStudent] = useState('');
  const [topic, setTopic] = useState('Algebra');
  const [scoreType, setScoreType] = useState('Quiz');
  const [score, setScore] = useState('');
  const [maxScore, setMaxScore] = useState('10');
  
  // UI Tabs / Loaders / Overlays
  const [activeTab, setActiveTab] = useState('lectures'); // 'lectures', 'mastery', 'remedial'
  const [submittingLecture, setSubmittingLecture] = useState(false);
  const [submittingScore, setSubmittingScore] = useState(false);
  const [generatingRemedial, setGeneratingRemedial] = useState(null); // studentId-topic
  const [activePreviewDeck, setActivePreviewDeck] = useState(null);

  // Refs for recording
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  const fetchDashboardData = async () => {
    try {
      // 1. Lectures
      const lecRes = await fetch('/api/lectures');
      const lecData = await lecRes.json();
      setLectures(lecData);

      // 2. Students Directory
      const stdRes = await fetch('/api/students');
      const stdData = await stdRes.json();
      setStudents(stdData);
      if (stdData.length > 0 && !selectedStudent) {
        setSelectedStudent(stdData[0].id);
      }

      // 3. Analytics & Mastery
      const masteryRes = await fetch('/api/analytics/mastery');
      const masteryData = await masteryRes.json();
      setAnalytics(masteryData);

      // 4. Remedial Decks
      const remRes = await fetch('/api/remedial');
      const remData = await remRes.json();
      setRemedialDecks(remData);

    } catch (e) {
      console.error('Error fetching teacher data:', e);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Poll lectures status if any are transcribing
    const interval = setInterval(() => {
      const transcribingExists = lectures.some(l => l.status === 'transcribing');
      if (transcribingExists) {
        fetchDashboardData();
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [lectures]);

  // Mic recording start
  const startRecording = async () => {
    audioChunksRef.current = [];
    setRecordedBlob(null);
    setRecordingSeconds(0);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordedBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start(1000); // chunk every second
      setIsRecording(true);
      setIsPaused(false);
      
      timerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to access microphone:', err);
      alert('Microphone access denied or unavailable. You can upload an audio file instead.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      clearInterval(timerRef.current);
      setIsRecording(false);
    }
  };

  const clearRecording = () => {
    setRecordedBlob(null);
    setRecordingSeconds(0);
  };

  // Submit new Lecture (upload file/blob)
  const handleUploadLecture = async (e) => {
    e.preventDefault();
    if (!title) return;
    
    setSubmittingLecture(true);
    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('teacher_id', user.id);

    if (recordedBlob) {
      formData.append('audio', recordedBlob, 'lecture.webm');
    } else if (file) {
      formData.append('audio', file);
    }

    try {
      const res = await fetch('/api/lectures/upload', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) throw new Error('Upload failed');
      
      setTitle('');
      setDescription('');
      setFile(null);
      setRecordedBlob(null);
      setRecordingSeconds(0);
      
      await fetchDashboardData();
      setActiveTab('lectures');
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmittingLecture(false);
    }
  };

  // Log student marks
  const handleAddGrade = async (e) => {
    e.preventDefault();
    if (!selectedStudent || !topic || !score || !maxScore) return;

    setSubmittingScore(true);
    try {
      const res = await fetch('/api/analytics/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: selectedStudent,
          topic,
          score_type: scoreType,
          score: parseFloat(score),
          max_score: parseFloat(maxScore)
        })
      });

      if (!res.ok) throw new Error('Failed to log score');
      
      setScore('');
      await fetchDashboardData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmittingScore(false);
    }
  };

  // Trigger Remedial Generation
  const handleGenerateRemedial = async (studentId, topicName) => {
    const key = `${studentId}-${topicName}`;
    setGeneratingRemedial(key);

    try {
      const res = await fetch('/api/remedial/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          topic: topicName
        })
      });

      if (!res.ok) throw new Error('Failed to generate remedial deck');
      await fetchDashboardData();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setGeneratingRemedial(null);
    }
  };

  // Find if a remedial deck exists for student & topic
  const getRemedialDeck = (studentId, topicName) => {
    return remedialDecks.find(d => d.student_id === studentId && d.topic === topicName);
  };

  // Helper for format time
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 pb-12">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/40 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
              <Mic className="h-6 w-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="font-extrabold text-xl tracking-tight text-white flex items-center gap-1.5">
                SmartClass <span className="text-xs bg-indigo-500/20 text-indigo-300 font-semibold px-2 py-0.5 rounded-full border border-indigo-500/10">Teacher Suite</span>
              </h1>
              <p className="text-xs text-slate-400 font-medium">Capture Lectures & Remedial Learning Operations</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-xs font-semibold text-white">Classroom Instructor ({user.username})</p>
              <p className="text-[10px] text-indigo-400 uppercase tracking-widest font-bold">Standard Role</p>
            </div>
            <button
              onClick={onLogout}
              className="px-4 py-2 border border-slate-800 hover:bg-slate-800 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800/80 mb-6">
          <button
            onClick={() => setActiveTab('lectures')}
            className={`py-3 px-6 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === 'lectures'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Lectures & Uploads
          </button>
          <button
            onClick={() => setActiveTab('mastery')}
            className={`py-3 px-6 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === 'mastery'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Student Mastery Analytics
          </button>
          <button
            onClick={() => setActiveTab('remedial')}
            className={`py-3 px-6 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === 'remedial'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Remedial Hub
          </button>
        </div>

        {/* TAB 1: Lectures & Recording */}
        {activeTab === 'lectures' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Capture Panel */}
            <div className="lg:col-span-1 space-y-6">
              <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-5">
                <h3 className="font-extrabold text-white text-base">New Lecture Capture</h3>

                {/* Microphone Recording Module */}
                <div className="p-5 bg-slate-950/60 border border-slate-900 rounded-2xl flex flex-col items-center justify-center space-y-4 shadow-inner">
                  {isRecording ? (
                    <>
                      <div className="relative flex items-center justify-center">
                        <span className="animate-ping absolute inline-flex h-12 w-12 rounded-full bg-rose-500/30 opacity-75"></span>
                        <div className="relative h-14 w-14 rounded-full bg-rose-600 hover:bg-rose-500 flex items-center justify-center border-2 border-rose-400 shadow-lg">
                          <Mic className="h-6 w-6 text-white" />
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-extrabold text-rose-400 animate-pulse">RECORDING LECTURE</p>
                        <p className="text-2xl font-black text-white mt-1 font-mono">{formatTime(recordingSeconds)}</p>
                      </div>

                      {/* Micro-waveform simulation */}
                      <div className="flex items-center gap-1 h-6">
                        {Array.from({ length: 9 }).map((_, idx) => (
                          <div
                            key={idx}
                            className="w-1 bg-indigo-500 rounded-full animate-bounce"
                            style={{
                              height: `${10 + Math.random() * 90}%`,
                              animationDelay: `${idx * 0.1}s`,
                              animationDuration: '0.6s'
                            }}
                          />
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={stopRecording}
                        className="py-2 px-5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-xs active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Square className="h-3.5 w-3.5 fill-white" />
                        Stop & Finish
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={startRecording}
                        className="h-14 w-14 rounded-full bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center text-white cursor-pointer active:scale-95 transition-all shadow-lg shadow-indigo-600/10 border-2 border-indigo-400"
                      >
                        <Mic className="h-6 w-6" />
                      </button>
                      <div className="text-center">
                        <p className="text-xs font-semibold text-slate-300">Start Recording via Mic</p>
                        <p className="text-[10px] text-slate-500 mt-1 max-w-[200px] leading-relaxed">Ensure browser audio permissions are granted</p>
                      </div>
                    </>
                  )}

                  {/* Recorded Blob Alert */}
                  {recordedBlob && (
                    <div className="w-full p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-xl text-xs flex justify-between items-center">
                      <span className="font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400 shrink-0" />
                        Audio ready ({(recordedBlob.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                      <button
                        type="button"
                        onClick={clearRecording}
                        className="text-[10px] uppercase font-bold text-slate-400 hover:text-slate-200 border-l border-slate-800 pl-2 ml-2"
                      >
                        Discard
                      </button>
                    </div>
                  )}
                </div>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-slate-800/80"></div>
                  <span className="flex-shrink mx-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">or upload audio</span>
                  <div className="flex-grow border-t border-slate-800/80"></div>
                </div>

                {/* Upload File/Form Module */}
                <form onSubmit={handleUploadLecture} className="space-y-4">
                  {!recordedBlob && (
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Audio File</label>
                      <div className="relative border border-dashed border-slate-700/80 hover:border-slate-600 rounded-xl bg-slate-950/40 p-4 transition-colors">
                        <input
                          type="file"
                          accept="audio/*"
                          onChange={(e) => setFile(e.target.files[0])}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="text-center space-y-1">
                          <Upload className="h-6 w-6 text-slate-500 mx-auto" />
                          <p className="text-xs font-semibold text-slate-300">
                            {file ? file.name : 'Select audio file'}
                          </p>
                          <p className="text-[10px] text-slate-500">WAV, MP3, M4A or WEBM up to 25MB</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Lecture Title</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Introduction to Mitosis"
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Short Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Enter brief description to guide notes generation..."
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[80px]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingLecture || (!recordedBlob && !file) || !title}
                    className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:bg-indigo-800 text-white text-xs font-bold rounded-xl active:scale-95 transition-all shadow-md shadow-indigo-600/10 cursor-pointer text-center"
                  >
                    {submittingLecture ? 'Uploading and Transcribing...' : 'Upload & Generate Notes'}
                  </button>
                </form>
              </div>
            </div>

            {/* Right side: Lectures history list */}
            <div className="lg:col-span-2 glass-panel p-6 rounded-3xl border border-slate-800 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <h3 className="font-extrabold text-white text-base">Classroom Lectures History</h3>
                <span className="bg-indigo-500/10 text-indigo-300 text-xs font-bold px-2 py-0.5 rounded-md">
                  {lectures.length} Total
                </span>
              </div>

              <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1">
                {lectures.map((lec) => (
                  <div key={lec.id} className="p-4 bg-slate-900/40 border border-slate-850 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-slate-200 truncate">{lec.title}</h4>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          lec.status === 'completed' 
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : lec.status === 'transcribing'
                            ? 'bg-amber-500/10 text-amber-400 animate-pulse'
                            : 'bg-rose-500/10 text-rose-400'
                        }`}>
                          {lec.status}
                        </span>
                      </div>
                      
                      {lec.description && (
                        <p className="text-slate-400 text-xs line-clamp-1">{lec.description}</p>
                      )}

                      <div className="text-[10px] text-slate-500 flex gap-4">
                        <span>Teacher: {lec.teacher_name || user.username}</span>
                        <span>Date: {new Date(lec.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      {lec.status === 'completed' && (
                        <a
                          href={`#lecture-${lec.id}`}
                          onClick={() => {
                            // Quick study trigger - switch tabs and view lecture details
                            alert('To view full notes, transcription, and quizzes, log in as a student or select the lecture.');
                          }}
                          className="px-3.5 py-2 border border-slate-850 hover:bg-slate-850 hover:text-white text-slate-400 font-semibold rounded-xl text-xs cursor-pointer transition-colors"
                        >
                          Details Check
                        </a>
                      )}
                    </div>
                  </div>
                ))}

                {lectures.length === 0 && (
                  <div className="text-center py-20 text-slate-500 text-sm italic">
                    No lectures recorded yet. Start capture or upload a file on the left!
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: Student Mastery Analytics */}
        {activeTab === 'mastery' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left side: Log Student Grade Form */}
            <div className="lg:col-span-1 space-y-6">
              <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-5">
                <h3 className="font-extrabold text-white text-base">Grade Student Assessment</h3>

                <form onSubmit={handleAddGrade} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Student</label>
                    <select
                      value={selectedStudent}
                      onChange={(e) => setSelectedStudent(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      {students.map((st) => (
                        <option key={st.id} value={st.id}>{st.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Curricular Topic</label>
                    <select
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="Algebra">Algebra</option>
                      <option value="Photosynthesis">Photosynthesis</option>
                      <option value="Gravity">Gravity</option>
                      <option value="Cell Division">Cell Division</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Score Type</label>
                    <select
                      value={scoreType}
                      onChange={(e) => setScoreType(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="Quiz">Quiz</option>
                      <option value="Assignment">Assignment</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Score</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={score}
                        onChange={(e) => setScore(e.target.value)}
                        placeholder="e.g. 8.5"
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Max Score</label>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        value={maxScore}
                        onChange={(e) => setMaxScore(e.target.value)}
                        placeholder="e.g. 10"
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingScore || !score || !maxScore}
                    className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl active:scale-95 transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
                  >
                    {submittingScore ? 'Logging Score...' : 'Submit Score'}
                  </button>
                </form>
              </div>
            </div>

            {/* Right side: Mastery Table */}
            <div className="lg:col-span-2 glass-panel p-6 rounded-3xl border border-slate-800 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <h3 className="font-extrabold text-white text-base">Classroom Topic Mastery Tracker</h3>
                <span className="text-slate-400 text-xs font-medium">Mastery threshold: <strong className="text-rose-400 font-bold">60%</strong></span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-bold">
                      <th className="py-3 px-2">Student</th>
                      <th className="py-3 px-2">Topic</th>
                      <th className="py-3 px-2 text-center">Mastery Score</th>
                      <th className="py-3 px-2">Status</th>
                      <th className="py-3 px-2 text-right">Action Needed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {analytics.students.map((student) => {
                      const topics = Object.entries(student.topics);
                      
                      if (topics.length === 0) {
                        return (
                          <tr key={student.id} className="hover:bg-slate-900/20">
                            <td className="py-3.5 px-2 font-bold text-white">{student.name}</td>
                            <td colSpan="4" className="py-3.5 px-2 text-slate-500 italic text-[11px]">No assessments graded yet.</td>
                          </tr>
                        );
                      }

                      return topics.map(([topicName, details], tIdx) => {
                        const isFlagged = details.flagged;
                        const hasDeck = getRemedialDeck(student.id, topicName);
                        const isGenerating = generatingRemedial === `${student.id}-${topicName}`;

                        return (
                          <tr key={`${student.id}-${topicName}`} className="hover:bg-slate-900/20 transition-colors">
                            {tIdx === 0 && (
                              <td className="py-3.5 px-2 font-bold text-white" rowSpan={topics.length}>
                                {student.name}
                              </td>
                            )}
                            <td className="py-3.5 px-2 text-slate-300 font-semibold">{topicName}</td>
                            <td className="py-3.5 px-2 text-center font-bold">
                              <span className={isFlagged ? 'text-rose-400' : 'text-emerald-400'}>
                                {details.mastery_score}%
                              </span>
                            </td>
                            <td className="py-3.5 px-2">
                              {isFlagged ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold text-[9px]">
                                  <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                                  Flagged
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-[9px]">
                                  <Award className="h-2.5 w-2.5 shrink-0" />
                                  Mastered
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-2 text-right">
                              {isFlagged ? (
                                hasDeck ? (
                                  <div className="flex justify-end gap-2">
                                    <span className="text-[10px] font-bold text-slate-400 italic mt-1.5 block">Shared</span>
                                    <button
                                      onClick={() => setActivePreviewDeck(hasDeck)}
                                      className="p-1 border border-slate-800 text-slate-400 hover:text-white rounded hover:bg-slate-900 transition-colors cursor-pointer"
                                      title="Preview Slide Deck"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleGenerateRemedial(student.id, topicName)}
                                    disabled={isGenerating}
                                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-[10px] cursor-pointer shadow active:scale-95 disabled:opacity-40 transition-all"
                                  >
                                    {isGenerating ? 'Drafting...' : 'Gen Remedial Deck'}
                                  </button>
                                )
                              ) : (
                                <span className="text-slate-600 italic text-[10px]">None</span>
                              )}
                            </td>
                          </tr>
                        );
                      });
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* TAB 3: Remedial Hub */}
        {activeTab === 'remedial' && (
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="font-extrabold text-white text-base">Active Remedial Learning Materials</h3>
              <span className="bg-indigo-500/10 text-indigo-300 text-xs font-bold px-2 py-0.5 rounded-md">
                {remedialDecks.length} Assigned Decks
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {remedialDecks.map((deck) => (
                <div key={deck.id} className="p-5 bg-slate-900/40 border border-slate-850 rounded-2xl flex flex-col justify-between hover:border-slate-800 transition-all">
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <span className="text-[9px] font-bold text-violet-400 bg-violet-500/10 border border-violet-500/15 px-2 py-0.5 rounded">
                        {deck.topic}
                      </span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        deck.status === 'assigned'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/15'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
                      }`}>
                        {deck.status === 'assigned' ? 'Assigned' : 'Reviewed'}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-sm text-slate-200">{deck.title}</h4>
                      <p className="text-[11px] text-slate-400 mt-1">Student: <strong className="text-slate-300">{deck.student_name}</strong></p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Created: {new Date(deck.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="mt-5 flex gap-2">
                    <button
                      onClick={() => setActivePreviewDeck(deck)}
                      className="flex-1 py-2 px-3 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer text-center"
                    >
                      Preview Deck
                    </button>
                  </div>
                </div>
              ))}

              {remedialDecks.length === 0 && (
                <div className="col-span-full py-20 text-center text-slate-500 italic text-sm">
                  No remedial decks generated yet. Head over to the 'Student Mastery Analytics' tab to generate slides for flagged students!
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      {/* Render Slide Presentation Overlay Preview */}
      {activePreviewDeck && (
        <RemedialPresentation
          content={activePreviewDeck}
          onClose={() => setActivePreviewDeck(null)}
        />
      )}
    </div>
  );
}

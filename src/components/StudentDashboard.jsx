import React, { useState, useEffect } from 'react';
import { GraduationCap, BookOpen, AlertCircle, FileText, CheckCircle2, ChevronRight, Award, Trophy } from 'lucide-react';
import RemedialPresentation from './RemedialPresentation';

export default function StudentDashboard({ user, onLogout }) {
  const [lectures, setLectures] = useState([]);
  const [remedialDecks, setRemedialDecks] = useState([]);
  const [selectedLecture, setSelectedLecture] = useState(null);
  const [activeTab, setActiveTab] = useState('lectures'); // 'lectures' or 'remedial'
  
  // Interactive Quiz State
  const [selectedAnswers, setSelectedAnswers] = useState({}); // { questionIndex: optionIndex }
  const [quizSubmitted, setQuizSubmitted] = useState({}); // { questionIndex: true }
  
  // Slide Viewer State
  const [activeRemedialDeck, setActiveRemedialDeck] = useState(null);

  const fetchStudentData = async () => {
    try {
      // 1. Fetch lectures list
      const lecRes = await fetch('/api/lectures');
      const lecData = await lecRes.json();
      setLectures(lecData);
      
      // Auto-select first lecture if available
      if (lecData.length > 0 && !selectedLecture) {
        handleSelectLecture(lecData[0].id);
      }

      // 2. Fetch student's assigned remedial decks if profile exists
      if (user.student && user.student.id) {
        const remRes = await fetch(`/api/remedial?student_id=${user.student.id}`);
        const remData = await remRes.json();
        setRemedialDecks(remData);
      }
    } catch (e) {
      console.error('Error fetching student dashboard data:', e);
    }
  };

  useEffect(() => {
    fetchStudentData();
  }, [user]);

  const handleSelectLecture = async (id) => {
    try {
      const res = await fetch(`/api/lectures/${id}`);
      const data = await res.json();
      setSelectedLecture(data);
      // Reset quiz state when switching lectures
      setSelectedAnswers({});
      setQuizSubmitted({});
    } catch (e) {
      console.error('Error loading lecture details:', e);
    }
  };

  const handleSelectOption = (qIdx, oIdx) => {
    if (quizSubmitted[qIdx]) return;
    setSelectedAnswers({ ...selectedAnswers, [qIdx]: oIdx });
  };

  const handleSubmitQuestion = (qIdx) => {
    if (selectedAnswers[qIdx] === undefined) return;
    setQuizSubmitted({ ...quizSubmitted, [qIdx]: true });
  };

  const handleQuizReset = () => {
    setSelectedAnswers({});
    setQuizSubmitted({});
  };

  // Convert letter answers to array index
  const getCorrectOptionIndex = (letter) => {
    if (!letter) return 0;
    return letter.charCodeAt(0) - 65; // 'A'->0, 'B'->1, etc.
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 pb-12">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/40 backdrop-blur-md sticky top-0 z-45">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
              <GraduationCap className="h-6 w-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="font-extrabold text-xl tracking-tight text-white">SmartClass</h1>
              <p className="text-xs text-slate-400">Student Study Workspace</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-xs font-semibold text-white">{user.student?.name || user.username}</p>
              <p className="text-[10px] text-indigo-400 uppercase tracking-widest font-bold">Student Account</p>
            </div>
            <button
              onClick={onLogout}
              className="px-4 py-2 border border-slate-800 hover:bg-slate-800 rounded-xl text-xs font-semibold cursor-pointer transition-colors text-slate-300"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
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
            Study Notes ({lectures.length})
          </button>
          <button
            onClick={() => setActiveTab('remedial')}
            className={`py-3 px-6 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
              activeTab === 'remedial'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Remedial Center
            {remedialDecks.length > 0 && (
              <span className="bg-rose-500 text-white font-extrabold text-[9px] px-1.5 py-0.5 rounded-full animate-pulse">
                {remedialDecks.filter(d => d.status === 'assigned').length}
              </span>
            )}
          </button>
        </div>

        {/* Tab: Study Notes */}
        {activeTab === 'lectures' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* Left sidebar: Lecture list */}
            <div className="glass-panel p-5 rounded-2xl h-fit space-y-4 border border-slate-800">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Lectures Library</h3>
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {lectures.map((lec) => (
                  <button
                    key={lec.id}
                    onClick={() => handleSelectLecture(lec.id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                      selectedLecture?.id === lec.id
                        ? 'border-indigo-500/50 bg-indigo-950/20 text-indigo-200'
                        : 'border-slate-800/80 bg-slate-900/40 hover:bg-slate-900 text-slate-400'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-1">
                      <span className="text-xs font-bold text-slate-200 truncate">{lec.title}</span>
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
                      <p className="text-[10px] text-slate-500 line-clamp-1">{lec.description}</p>
                    )}
                    <span className="text-[9px] text-slate-500 font-medium">
                      Date: {new Date(lec.created_at).toLocaleDateString()}
                    </span>
                  </button>
                ))}

                {lectures.length === 0 && (
                  <div className="text-center py-10 text-slate-500 text-xs italic">
                    No lectures uploaded yet.
                  </div>
                )}
              </div>
            </div>

            {/* Right container: Lecture detail view */}
            <div className="lg:col-span-3 space-y-6">
              {selectedLecture ? (
                <>
                  {/* Summary & Note Header */}
                  <div className="glass-panel p-6 rounded-3xl space-y-4 border border-slate-800">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-800 pb-4">
                      <div>
                        <h2 className="text-2xl font-extrabold text-white">{selectedLecture.title}</h2>
                        <p className="text-xs text-slate-400 mt-1">Instructor: <span className="text-indigo-400 font-semibold">{selectedLecture.teacher_name || 'Class Teacher'}</span> • Published: {new Date(selectedLecture.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>

                    {selectedLecture.status === 'transcribing' ? (
                      <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-amber-400 text-sm font-semibold animate-pulse">AI is currently transcribing and generating notes...</p>
                        <p className="text-xs text-slate-500 max-w-xs text-center leading-relaxed">This process takes about 10-15 seconds. This page will update automatically upon completion.</p>
                      </div>
                    ) : selectedLecture.status === 'failed' ? (
                      <div className="p-6 text-center border border-rose-500/20 bg-rose-500/5 rounded-2xl space-y-3">
                        <AlertCircle className="h-10 w-10 text-rose-400 mx-auto" />
                        <h3 className="font-bold text-rose-300">Processing Failed</h3>
                        <p className="text-slate-400 text-xs max-w-sm mx-auto">There was an issue processing the audio recording. Please contact your instructor to re-upload.</p>
                      </div>
                    ) : (
                      <>
                        {/* Executive Summary */}
                        <div className="space-y-2.5">
                          <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Executive Summary</h3>
                          <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{selectedLecture.notes?.summary}</p>
                        </div>

                        {/* Key points bullet highlights */}
                        {selectedLecture.notes?.key_points && selectedLecture.notes.key_points.length > 0 && (
                          <div className="pt-4 border-t border-slate-800/80 space-y-2.5">
                            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Key Takeaways</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                              {selectedLecture.notes.key_points.map((pt, idx) => (
                                <div key={idx} className="p-3 bg-slate-900/50 border border-slate-800 rounded-xl flex gap-2.5 items-start text-xs text-slate-300 leading-relaxed">
                                  <Trophy className="h-4.5 w-4.5 text-amber-500 shrink-0 mt-0.5" />
                                  <span>{pt}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Markdown Notes Detail */}
                  {selectedLecture.status === 'completed' && selectedLecture.notes?.structured_notes && (
                    <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
                      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                        <FileText className="h-5 w-5 text-indigo-400" />
                        <h3 className="font-bold text-white text-lg">Detailed Lecture Notes</h3>
                      </div>
                      
                      {/* Render formatted Notes */}
                      <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap space-y-3 font-sans">
                        {/* A helper to render raw markdown lines cleanly */}
                        {selectedLecture.notes.structured_notes.split('\n').map((line, lIdx) => {
                          if (line.startsWith('###')) {
                            return <h4 key={lIdx} className="text-base font-extrabold text-white mt-5 mb-2.5 border-b border-slate-800/40 pb-1">{line.replace('###', '')}</h4>;
                          }
                          if (line.startsWith('####')) {
                            return <h5 key={lIdx} className="text-sm font-bold text-indigo-300 mt-4 mb-2">{line.replace('####', '')}</h5>;
                          }
                          if (line.startsWith('*')) {
                            return (
                              <div key={lIdx} className="flex gap-2.5 items-start my-1 text-slate-300 text-xs">
                                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 mt-2 shrink-0" />
                                <span>{line.replace('*', '').trim()}</span>
                              </div>
                            );
                          }
                          return <p key={lIdx} className="my-1.5 text-xs text-slate-400">{line}</p>;
                        })}
                      </div>
                    </div>
                  )}

                  {/* Interactive Practice Quiz */}
                  {selectedLecture.status === 'completed' && selectedLecture.notes?.practice_questions && selectedLecture.notes.practice_questions.length > 0 && (
                    <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-5">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                        <h3 className="font-bold text-white text-lg flex items-center gap-2">
                          <Award className="h-5 w-5 text-indigo-400" />
                          Interactive Study Quiz
                        </h3>
                        <button
                          onClick={handleQuizReset}
                          className="text-[10px] text-slate-400 hover:text-slate-200 border border-slate-800 px-2.5 py-1 rounded hover:bg-slate-900 transition-all cursor-pointer"
                        >
                          Reset Quiz
                        </button>
                      </div>

                      <div className="space-y-6">
                        {selectedLecture.notes.practice_questions.map((q, qIdx) => {
                          const selectedOptIdx = selectedAnswers[qIdx];
                          const isSubmitted = quizSubmitted[qIdx];
                          const correctOptLetter = q.answer;
                          const correctOptIdx = getCorrectOptionIndex(correctOptLetter);

                          return (
                            <div key={qIdx} className="p-4 bg-slate-900/30 border border-slate-800 rounded-2xl space-y-4">
                              <div className="flex gap-2">
                                <span className="bg-indigo-500/10 text-indigo-300 font-bold px-2 py-0.5 rounded text-xs">Q{qIdx + 1}</span>
                                <h4 className="text-xs font-semibold text-white leading-relaxed">{q.question}</h4>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                {q.options.map((opt, oIdx) => {
                                  const letter = String.fromCharCode(65 + oIdx);
                                  const isSelected = selectedOptIdx === oIdx;
                                  const isCorrect = oIdx === correctOptIdx;

                                  let btnStyle = "border-slate-800 bg-slate-950/40 text-slate-400 hover:bg-slate-900";
                                  if (isSelected) {
                                    btnStyle = "border-indigo-500 bg-indigo-500/10 text-indigo-300 font-medium";
                                  }
                                  if (isSubmitted) {
                                    if (isCorrect) {
                                      btnStyle = "border-emerald-500 bg-emerald-500/15 text-emerald-300 font-bold shadow-inner";
                                    } else if (isSelected) {
                                      btnStyle = "border-rose-500 bg-rose-500/15 text-rose-300 font-medium";
                                    } else {
                                      btnStyle = "border-slate-850 bg-slate-950/20 text-slate-600 opacity-50";
                                    }
                                  }

                                  return (
                                    <button
                                      key={oIdx}
                                      onClick={() => handleSelectOption(qIdx, oIdx)}
                                      disabled={isSubmitted}
                                      className={`w-full p-3 text-left text-xs rounded-xl border flex items-center justify-between transition-all cursor-pointer ${btnStyle}`}
                                    >
                                      <span><strong>{letter}.</strong> {opt}</span>
                                    </button>
                                  );
                                })}
                              </div>

                              {!isSubmitted ? (
                                <button
                                  type="button"
                                  onClick={() => handleSubmitQuestion(qIdx)}
                                  disabled={selectedOptIdx === undefined}
                                  className="px-4 py-2 bg-slate-800 hover:bg-indigo-600 disabled:opacity-40 disabled:hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                                >
                                  Submit Answer
                                </button>
                              ) : (
                                <div className="p-3 bg-slate-950/70 border-l-2 border-indigo-500 rounded-r-xl text-[11px] leading-relaxed text-slate-400 italic">
                                  <strong className="text-slate-300 block not-italic mb-0.5">Explanation:</strong>
                                  {q.explanation}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Transcript accordion */}
                  {selectedLecture.status === 'completed' && selectedLecture.transcript && (
                    <details className="glass-panel p-6 rounded-3xl border border-slate-800 group">
                      <summary className="font-bold text-white text-base flex justify-between items-center cursor-pointer select-none">
                        <span>Verbatim Audio Transcript</span>
                        <ChevronRight className="h-5 w-5 text-slate-500 group-open:rotate-90 transition-transform" />
                      </summary>
                      <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-400 leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto pr-1">
                        {selectedLecture.transcript}
                      </div>
                    </details>
                  )}
                </>
              ) : (
                <div className="glass-panel p-12 rounded-3xl border border-slate-800 text-center text-slate-500 italic">
                  Select a lecture from the sidebar library to begin studying.
                </div>
              )}
            </div>

          </div>
        )}

        {/* Tab: Remedial Center */}
        {activeTab === 'remedial' && (
          <div className="space-y-6">
            <div className="glass-panel p-6 rounded-3xl border border-slate-800">
              <h2 className="text-xl font-bold text-white mb-2">Your Personal Learning Accelerator</h2>
              <p className="text-xs text-slate-400 max-w-xl">
                When you score low on class topics, our system generates custom remedial study decks containing simplified explanations, worked examples, and extra questions to help you improve.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {remedialDecks.map((deck) => (
                <div key={deck.id} className="glass-panel p-6 rounded-2xl flex flex-col justify-between border border-slate-800 hover:border-slate-700 transition-all">
                  <div className="space-y-4">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-[10px] font-bold text-violet-400 bg-violet-500/10 border border-violet-500/15 px-2 py-0.5 rounded">
                        {deck.topic}
                      </span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        deck.status === 'assigned'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/15'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
                      }`}>
                        {deck.status === 'assigned' ? 'New Material' : 'Completed'}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-bold text-base text-white">{deck.title}</h3>
                      <p className="text-slate-500 text-[11px] mt-1">Assigned: {new Date(deck.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="mt-6 flex gap-2">
                    <button
                      onClick={() => setActiveRemedialDeck(deck)}
                      className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl active:scale-95 transition-all text-center cursor-pointer shadow-md shadow-indigo-600/10"
                    >
                      Study Slide Deck
                    </button>
                  </div>
                </div>
              ))}

              {remedialDecks.length === 0 && (
                <div className="col-span-full py-16 text-center glass-panel rounded-3xl border border-slate-850 text-slate-500 italic text-sm">
                  You have no assigned remedial content. Keep up the good work! 🎓
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      {/* Render Slide Presentation Overlay */}
      {activeRemedialDeck && (
        <RemedialPresentation
          content={activeRemedialDeck}
          onClose={() => {
            // Update deck status locally when student closes slides, or query DB
            if (activeRemedialDeck.status === 'assigned') {
              fetch(`/api/remedial/${activeRemedialDeck.id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'reviewed' })
              }).then(() => fetchStudentData());
            }
            setActiveRemedialDeck(null);
          }}
        />
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Shield, Users, BookOpen, AlertTriangle, Search, TrendingUp, Award, BarChart3 } from 'lucide-react';

export default function AdminDashboard({ user, onLogout }) {
  const [analytics, setAnalytics] = useState({ students: [], topics: [] });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchAnalytics = async () => {
    try {
      const res = await fetch('/api/analytics/mastery');
      const data = await res.json();
      setAnalytics(data);
    } catch (e) {
      console.error('Error fetching analytics:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  // Filter students based on search term
  const filteredStudents = analytics.students.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Compute aggregate institutional metrics
  const totalStudents = analytics.students.length;
  const flaggedCount = analytics.students.filter(s =>
    Object.values(s.topics).some(t => t.flagged)
  ).length;

  const totalMasterySum = analytics.students.reduce((sum, s) => sum + s.overall_mastery, 0);
  const institutionalAverage = totalStudents > 0 ? Math.round(totalMasterySum / totalStudents) : 0;

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 pb-12">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/40 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
              <Shield className="h-6 w-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="font-extrabold text-xl tracking-tight text-white flex items-center gap-1.5">
                SmartClass <span className="text-xs bg-indigo-500/20 text-indigo-300 font-semibold px-2 py-0.5 rounded-full border border-indigo-500/10">Admin Portal</span>
              </h1>
              <p className="text-xs text-slate-400">Institutional Statistics & Academic Analytics</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-xs font-semibold text-white">Administrator ({user.username})</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest">Super User</p>
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-400 text-sm font-medium">Loading institutional data...</p>
          </div>
        ) : (
          <>
            {/* Aggregate Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Students</p>
                    <p className="text-3xl font-extrabold text-white mt-2">{totalStudents}</p>
                  </div>
                  <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/15">
                    <Users className="h-6 w-6 text-indigo-400" />
                  </div>
                </div>
                <div className="mt-4 text-slate-500 text-[11px]">Enrolled across all courses</div>
              </div>

              <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Avg Mastery Score</p>
                    <p className="text-3xl font-extrabold text-emerald-400 mt-2">{institutionalAverage}%</p>
                  </div>
                  <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/15">
                    <TrendingUp className="h-6 w-6 text-emerald-400" />
                  </div>
                </div>
                <div className="mt-4 text-slate-500 text-[11px]">Aggregated quiz and homework scores</div>
              </div>

              <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Students Flagged</p>
                    <p className="text-3xl font-extrabold text-rose-400 mt-2">{flaggedCount}</p>
                  </div>
                  <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/15">
                    <AlertTriangle className="h-6 w-6 text-rose-400" />
                  </div>
                </div>
                <div className="mt-4 text-slate-500 text-[11px] font-semibold text-rose-400/80">Needs active remedial support</div>
              </div>

              <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Core Subjects</p>
                    <p className="text-3xl font-extrabold text-violet-400 mt-2">{analytics.topics.length}</p>
                  </div>
                  <div className="p-3 bg-violet-500/10 rounded-xl border border-violet-500/15">
                    <BookOpen className="h-6 w-6 text-violet-400" />
                  </div>
                </div>
                <div className="mt-4 text-slate-500 text-[11px]">Actively tracked curricula</div>
              </div>
            </div>

            {/* Subject Mastery Charts & Weak Topics */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Subject Mastery Bar Chart */}
              <div className="lg:col-span-2 glass-panel p-6 rounded-3xl space-y-6">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
                  <BarChart3 className="h-5 w-5 text-indigo-400" />
                  <h3 className="font-extrabold text-white text-lg">Curriculum Subject Mastery</h3>
                </div>

                <div className="space-y-5">
                  {analytics.topics.map((item, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-bold text-slate-200">{item.topic}</span>
                        <span className="text-slate-400 text-xs">{item.students_assessed} Students assessed • Avg: <strong className="text-indigo-300 font-bold">{item.average_mastery}%</strong></span>
                      </div>
                      
                      <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800 shadow-inner flex">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            item.average_mastery >= 75
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                              : item.average_mastery >= 60
                              ? 'bg-gradient-to-r from-indigo-500 to-indigo-400'
                              : 'bg-gradient-to-r from-rose-500 to-orange-400'
                          }`}
                          style={{ width: `${item.average_mastery}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  
                  {analytics.topics.length === 0 && (
                    <div className="text-center py-10 text-slate-500 text-sm italic">
                      No subject grades recorded yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Action/Flag Summary */}
              <div className="glass-panel p-6 rounded-3xl flex flex-col justify-between">
                <div className="space-y-5">
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
                    <AlertTriangle className="h-5 w-5 text-rose-400" />
                    <h3 className="font-extrabold text-white text-lg">Weak Concept Alerts</h3>
                  </div>

                  <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
                    {analytics.topics
                      .filter(t => t.flagged_students > 0)
                      .map((topic, idx) => (
                        <div key={idx} className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center gap-3">
                          <div className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-slate-200 truncate">{topic.topic}</h4>
                            <p className="text-slate-400 text-xs mt-0.5">
                              {topic.flagged_students} of {topic.students_assessed} students fall under the 60% mastery threshold.
                            </p>
                          </div>
                        </div>
                      ))}
                    
                    {analytics.topics.filter(t => t.flagged_students > 0).length === 0 && (
                      <div className="text-center py-10 text-slate-500 text-sm italic">
                        All student mastery scores are currently above threshold! 🎉
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="pt-4 border-t border-slate-800/80 text-xs text-slate-500 italic mt-4">
                  Note: Remedial actions can be initiated directly by teachers via their classroom dashboard.
                </div>
              </div>
            </div>

            {/* Students List Table */}
            <div className="glass-panel p-6 rounded-3xl space-y-6">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-800 pb-5">
                <h3 className="font-extrabold text-white text-lg">Student Directory</h3>
                
                <div className="relative max-w-sm w-full">
                  <Search className="absolute left-3.5 top-2.5 h-4.5 w-4.5 text-slate-500" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name or email..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-bold">
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Topics Mastery Overview</th>
                      <th className="py-3 px-4 text-center">Avg Mastery</th>
                      <th className="py-3 px-4 text-right">Academic Standing</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {filteredStudents.map((student, idx) => {
                      const topicEntries = Object.entries(student.topics);
                      const hasFlag = topicEntries.some(([_, t]) => t.flagged);

                      return (
                        <tr key={idx} className="hover:bg-slate-900/30 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-white">{student.name}</td>
                          <td className="py-3.5 px-4 text-slate-400">{student.email}</td>
                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap gap-1.5">
                              {topicEntries.length > 0 ? (
                                topicEntries.map(([topicName, details], tIdx) => (
                                  <span
                                    key={tIdx}
                                    className={`px-2 py-0.5 rounded-md font-semibold text-[10px] border ${
                                      details.flagged
                                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                                        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                                    }`}
                                  >
                                    {topicName}: {details.mastery_score}%
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-500 italic text-[11px]">No grading data</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold text-white">
                            {student.overall_mastery}%
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {hasFlag ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/20 text-rose-300 font-bold text-[10px]">
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                Action Required
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/20 text-emerald-300 font-bold text-[10px]">
                                <Award className="h-3 w-3 shrink-0" />
                                Proficient
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    
                    {filteredStudents.length === 0 && (
                      <tr>
                        <td colSpan="5" className="text-center py-10 text-slate-500 italic text-sm">
                          No matching students found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

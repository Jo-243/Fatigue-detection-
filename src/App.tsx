/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, 
  AlertTriangle, 
  Clock, 
  User, 
  Settings, 
  Bell, 
  PhoneCall, 
  Zap, 
  Activity,
  Lock,
  Unlock,
  ChevronRight,
  Plus,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";

// Types
interface Guardian {
  id: number;
  name: string;
  phone: string;
  email: string;
}

interface UserProfile {
  name: string;
  role: 'student' | 'it_worker';
  daily_limit_minutes: number;
}

interface UsageLog {
  id: number;
  timestamp: string;
  app_name: string;
  duration_seconds: number;
}

interface Routine {
  id: number;
  time: string;
  activity: string;
  completed: number;
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export default function App() {
  const [view, setView] = useState<'dashboard' | 'settings' | 'guardians' | 'locked' | 'routine'>('dashboard');
  const [user, setUser] = useState<UserProfile>({ name: 'User', role: 'it_worker', daily_limit_minutes: 360 });
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [usageSeconds, setUsageSeconds] = useState(0);
  const [fatigueLevel, setFatigueLevel] = useState(0); // 0-100
  const [isLocked, setIsLocked] = useState(false);
  const [recommendation, setRecommendation] = useState("System learning your patterns...");
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);

  const usageIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize
  useEffect(() => {
    fetchData();
    
    // Simulate usage tracking (every 10 seconds we add 10 seconds of usage)
    usageIntervalRef.current = setInterval(() => {
      trackUsage();
    }, 10000);

    return () => {
      if (usageIntervalRef.current) clearInterval(usageIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    // Check for lock condition
    const limitSeconds = user.daily_limit_minutes * 60;
    if (usageSeconds > limitSeconds && !isLocked) {
      setIsLocked(true);
      setView('locked');
    }
  }, [usageSeconds, user.daily_limit_minutes]);

  useEffect(() => {
    // AI Analysis every minute or when usage changes significantly
    if (usageSeconds > 0 && usageSeconds % 60 === 0) {
      analyzeFatigue();
    }
  }, [usageSeconds]);

  const fetchData = async () => {
    try {
      const [userRes, guardiansRes, statsRes, routinesRes] = await Promise.all([
        fetch('/api/user'),
        fetch('/api/guardians'),
        fetch('/api/stats'),
        fetch('/api/routines')
      ]);
      
      const userData = await userRes.json();
      const guardiansData = await guardiansRes.json();
      const statsData = await statsRes.json();
      const routinesData = await routinesRes.json();

      setUser(userData);
      setGuardians(guardiansData);
      setUsageSeconds(statsData.total_seconds);
      setRoutines(routinesData);
    } catch (error) {
      console.error("Failed to fetch data", error);
    }
  };

  const trackUsage = async () => {
    try {
      await fetch('/api/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_name: 'Vigilant App', duration_seconds: 10 })
      });
      setUsageSeconds(prev => prev + 10);
    } catch (error) {
      console.error("Failed to track usage", error);
    }
  };

  const analyzeFatigue = async () => {
    try {
      const routineContext = routines.map(r => `${r.time}: ${r.activity} (${r.completed ? 'Done' : 'Pending'})`).join(', ');
      const prompt = `Analyze the following digital usage data for a ${user.role}. 
      Total usage today: ${Math.round(usageSeconds / 60)} minutes. 
      Daily limit: ${user.daily_limit_minutes} minutes.
      Current time: ${new Date().toLocaleTimeString()}.
      User's Daily Routine: ${routineContext || 'No routine set'}.
      
      Provide a fatigue score (0-100) and a brief, intelligent recommendation (max 15 words).
      Respond in JSON format: { "score": number, "recommendation": string }`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const result = JSON.parse(response.text || "{}");
      setFatigueLevel(result.score || 0);
      setRecommendation(result.recommendation || "Take a short break.");
    } catch (error) {
      console.error("AI Analysis failed", error);
    }
  };

  const handleEmergency = () => {
    setIsEmergencyActive(true);
    // In a real app, this would trigger SMS/Call
    setTimeout(() => {
      alert(`EMERGENCY ALERT SENT to ${guardians.length} guardians: ${guardians.map(g => g.name).join(', ')}`);
      setIsEmergencyActive(false);
    }, 2000);
  };

  const unlockSystem = () => {
    // In a real app, this might require a PIN or guardian override
    setIsLocked(false);
    setView('dashboard');
  };

  const addGuardian = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newGuardian = {
      name: formData.get('name') as string,
      phone: formData.get('phone') as string,
      email: formData.get('email') as string,
    };

    await fetch('/api/guardians', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newGuardian)
    });
    fetchData();
    e.currentTarget.reset();
  };

  const updateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const updatedUser = {
      name: formData.get('name') as string,
      role: formData.get('role') as 'student' | 'it_worker',
      daily_limit_minutes: parseInt(formData.get('limit') as string),
    };

    await fetch('/api/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedUser)
    });
    setUser(updatedUser);
    setView('dashboard');
  };

  const addRoutine = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newRoutine = {
      time: formData.get('time') as string,
      activity: formData.get('activity') as string,
    };

    await fetch('/api/routines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRoutine)
    });
    fetchData();
    e.currentTarget.reset();
  };

  const deleteRoutine = async (id: number) => {
    await fetch(`/api/routines/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const toggleRoutine = async (id: number, completed: boolean) => {
    await fetch(`/api/routines/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !completed })
    });
    fetchData();
  };

  // UI Components
  const ProgressBar = ({ value, color = 'bg-emerald-500' }: { value: number, color?: string }) => (
    <div className="w-full bg-black/5 rounded-full h-2 overflow-hidden">
      <motion.div 
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(value, 100)}%` }}
        className={`h-full ${color}`}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#1A1A1A] font-sans selection:bg-emerald-100">
      {/* Navigation Rail (Mobile Bottom, Desktop Side) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-black/5 px-6 py-4 flex justify-around items-center z-40 md:top-0 md:bottom-0 md:left-0 md:w-20 md:flex-col md:border-r md:border-t-0">
        <button onClick={() => setView('dashboard')} className={`p-2 rounded-xl transition-colors ${view === 'dashboard' ? 'bg-emerald-50 text-emerald-600' : 'text-gray-400 hover:text-gray-600'}`}>
          <Activity size={24} />
        </button>
        <button onClick={() => setView('routine')} className={`p-2 rounded-xl transition-colors ${view === 'routine' ? 'bg-emerald-50 text-emerald-600' : 'text-gray-400 hover:text-gray-600'}`}>
          <Bell size={24} />
        </button>
        <button onClick={() => setView('guardians')} className={`p-2 rounded-xl transition-colors ${view === 'guardians' ? 'bg-emerald-50 text-emerald-600' : 'text-gray-400 hover:text-gray-600'}`}>
          <Shield size={24} />
        </button>
        <button onClick={() => setView('settings')} className={`p-2 rounded-xl transition-colors ${view === 'settings' ? 'bg-emerald-50 text-emerald-600' : 'text-gray-400 hover:text-gray-600'}`}>
          <Settings size={24} />
        </button>
      </nav>

      <main className="pb-24 md:pb-0 md:pl-24 pt-8 px-6 max-w-4xl mx-auto">
        <AnimatePresence mode="wait">
          {view === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <header className="flex justify-between items-start">
                <div>
                  <h1 className="text-3xl font-serif italic font-medium tracking-tight">Hello, {user.name}</h1>
                  <p className="text-gray-500 text-sm mt-1">Monitoring your {user.role} lifestyle</p>
                </div>
                <div className="bg-white p-3 rounded-2xl shadow-sm border border-black/5">
                  <Clock className="text-emerald-600" size={20} />
                </div>
              </header>

              {/* Fatigue Card */}
              <section className="bg-white rounded-[32px] p-8 shadow-sm border border-black/5 relative overflow-hidden">
                <div className="relative z-10">
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Fatigue Analysis</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${fatigueLevel > 70 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {fatigueLevel > 70 ? 'High Risk' : 'Optimal'}
                    </span>
                  </div>
                  
                  <div className="flex items-end gap-4 mb-4">
                    <span className="text-6xl font-serif font-medium leading-none">{fatigueLevel}%</span>
                    <span className="text-gray-400 mb-1">Fatigue Level</span>
                  </div>

                  <ProgressBar value={fatigueLevel} color={fatigueLevel > 70 ? 'bg-red-500' : 'bg-emerald-500'} />

                  <div className="mt-8 flex items-start gap-3 bg-[#F9F9F7] p-4 rounded-2xl border border-black/5">
                    <Zap size={18} className="text-amber-500 mt-0.5" />
                    <p className="text-sm text-gray-600 italic">"{recommendation}"</p>
                  </div>
                </div>
                
                {/* Decorative background element */}
                <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-emerald-50 rounded-full blur-3xl opacity-50" />
              </section>

              {/* Usage Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-[32px] p-6 border border-black/5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                      <Clock size={18} />
                    </div>
                    <span className="text-sm font-medium">Screen Time</span>
                  </div>
                  <div className="text-2xl font-medium">{Math.floor(usageSeconds / 60)}m <span className="text-gray-400 text-sm font-normal">/ {user.daily_limit_minutes}m</span></div>
                  <div className="mt-4">
                    <ProgressBar value={(usageSeconds / (user.daily_limit_minutes * 60)) * 100} color="bg-blue-500" />
                  </div>
                </div>

                <div className="bg-white rounded-[32px] p-6 border border-black/5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                      <Bell size={18} />
                    </div>
                    <span className="text-sm font-medium">Next Routine</span>
                  </div>
                  <div className="text-2xl font-medium">
                    {routines.find(r => !r.completed)?.activity || "All Done"}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    {routines.find(r => !r.completed)?.time || "No pending tasks"}
                  </p>
                </div>
              </div>

              {/* Emergency Button */}
              <button 
                onClick={handleEmergency}
                disabled={isEmergencyActive}
                className={`w-full py-6 rounded-[32px] flex items-center justify-center gap-3 transition-all active:scale-95 ${isEmergencyActive ? 'bg-gray-100 text-gray-400' : 'bg-[#1A1A1A] text-white hover:bg-black shadow-xl shadow-black/10'}`}
              >
                {isEmergencyActive ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                    <Activity size={24} />
                  </motion.div>
                ) : (
                  <AlertTriangle size={24} className="text-red-500" />
                )}
                <span className="text-lg font-medium">Emergency SOS</span>
              </button>
            </motion.div>
          )}

          {view === 'routine' && (
            <motion.div 
              key="routine"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <header>
                <h2 className="text-3xl font-serif italic font-medium">Daily Routine</h2>
                <p className="text-gray-500 text-sm mt-1">Structure your day for better wellbeing</p>
              </header>

              <div className="space-y-4">
                {routines.map(r => (
                  <div key={r.id} className={`bg-white p-6 rounded-[24px] border border-black/5 flex justify-between items-center transition-opacity ${r.completed ? 'opacity-50' : ''}`}>
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => toggleRoutine(r.id, !!r.completed)}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${r.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300'}`}
                      >
                        {r.completed && <Activity size={12} />}
                      </button>
                      <div>
                        <h3 className={`font-medium text-lg ${r.completed ? 'line-through text-gray-400' : ''}`}>{r.activity}</h3>
                        <p className="text-sm text-gray-500">{r.time}</p>
                      </div>
                    </div>
                    <button onClick={() => deleteRoutine(r.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}

                {routines.length === 0 && (
                  <div className="text-center py-12 bg-white rounded-[24px] border border-dashed border-gray-300">
                    <p className="text-gray-400">No routine items added yet</p>
                  </div>
                )}
              </div>

              <form onSubmit={addRoutine} className="bg-white p-8 rounded-[32px] border border-black/5 space-y-4">
                <h3 className="font-medium mb-2">Add Routine Item</h3>
                <div className="grid grid-cols-3 gap-4">
                  <input name="time" type="time" required className="col-span-1 p-4 bg-[#F9F9F7] rounded-2xl border border-black/5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                  <input name="activity" placeholder="Activity (e.g. Deep Work, Lunch)" required className="col-span-2 p-4 bg-[#F9F9F7] rounded-2xl border border-black/5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                </div>
                <button type="submit" className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-medium hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2">
                  <Plus size={20} /> Add to Routine
                </button>
              </form>
            </motion.div>
          )}

          {view === 'guardians' && (
            <motion.div 
              key="guardians"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <header>
                <h2 className="text-3xl font-serif italic font-medium">Guardians</h2>
                <p className="text-gray-500 text-sm mt-1">Trusted contacts for emergency alerts</p>
              </header>

              <div className="space-y-4">
                {guardians.map(g => (
                  <div key={g.id} className="bg-white p-6 rounded-[24px] border border-black/5 flex justify-between items-center">
                    <div>
                      <h3 className="font-medium text-lg">{g.name}</h3>
                      <p className="text-sm text-gray-500">{g.phone}</p>
                    </div>
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-full">
                      <PhoneCall size={20} />
                    </div>
                  </div>
                ))}

                {guardians.length === 0 && (
                  <div className="text-center py-12 bg-white rounded-[24px] border border-dashed border-gray-300">
                    <p className="text-gray-400">No guardians added yet</p>
                  </div>
                )}
              </div>

              <form onSubmit={addGuardian} className="bg-white p-8 rounded-[32px] border border-black/5 space-y-4">
                <h3 className="font-medium mb-2">Add New Guardian</h3>
                <input name="name" placeholder="Name" required className="w-full p-4 bg-[#F9F9F7] rounded-2xl border border-black/5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                <input name="phone" placeholder="Phone Number" required className="w-full p-4 bg-[#F9F9F7] rounded-2xl border border-black/5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                <input name="email" placeholder="Email (Optional)" className="w-full p-4 bg-[#F9F9F7] rounded-2xl border border-black/5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                <button type="submit" className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-medium hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2">
                  <Plus size={20} /> Add Guardian
                </button>
              </form>
            </motion.div>
          )}

          {view === 'settings' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <header>
                <h2 className="text-3xl font-serif italic font-medium">Profile Settings</h2>
                <p className="text-gray-500 text-sm mt-1">Customize your wellbeing parameters</p>
              </header>

              <form onSubmit={updateProfile} className="bg-white p-8 rounded-[32px] border border-black/5 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Display Name</label>
                  <input name="name" defaultValue={user.name} required className="w-full p-4 bg-[#F9F9F7] rounded-2xl border border-black/5" />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Lifestyle Role</label>
                  <select name="role" defaultValue={user.role} className="w-full p-4 bg-[#F9F9F7] rounded-2xl border border-black/5 appearance-none">
                    <option value="student">Student</option>
                    <option value="it_worker">IT Worker</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Daily Screen Limit (Minutes)</label>
                  <input name="limit" type="number" defaultValue={user.daily_limit_minutes} required className="w-full p-4 bg-[#F9F9F7] rounded-2xl border border-black/5" />
                </div>

                <button type="submit" className="w-full py-4 bg-[#1A1A1A] text-white rounded-2xl font-medium hover:bg-black transition-colors">
                  Save Changes
                </button>
              </form>
            </motion.div>
          )}

          {view === 'locked' && (
            <motion.div 
              key="locked"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="fixed inset-0 bg-[#1A1A1A] z-50 flex flex-col items-center justify-center p-8 text-center"
            >
              <div className="w-24 h-24 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-8">
                <Lock size={48} />
              </div>
              <h2 className="text-4xl font-serif italic text-white mb-4">Usage Limit Reached</h2>
              <p className="text-gray-400 max-w-md mb-12">
                Vigilant has detected excessive screen time. Your access is temporarily restricted to protect your wellbeing.
              </p>
              
              <div className="space-y-4 w-full max-w-xs">
                <button 
                  onClick={handleEmergency}
                  className="w-full py-4 bg-red-600 text-white rounded-2xl font-medium flex items-center justify-center gap-2"
                >
                  <AlertTriangle size={20} /> Emergency SOS
                </button>
                <button 
                  onClick={unlockSystem}
                  className="w-full py-4 bg-white/10 text-white rounded-2xl font-medium hover:bg-white/20 transition-colors flex items-center justify-center gap-2"
                >
                  <Unlock size={20} /> Request Unlock
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

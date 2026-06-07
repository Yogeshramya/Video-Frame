'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { motion, AnimatePresence } from 'framer-motion';
import { Award, Lock, Mail, Loader2, LogOut, LayoutDashboard, PlusCircle, Database } from 'lucide-react';
import DashboardView from '../components/admin/DashboardView';
import UploadMemoryForm from '../components/admin/UploadMemoryForm';
import ManageMemoriesTable from '../components/admin/ManageMemoriesTable';

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'add' | 'manage'>('dashboard');

  // Listen to Auth state changes
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
      } catch (err) {
        console.error('Session check failed', err);
      } finally {
        setAuthLoading(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setLoginError(error.message);
      }
    } catch {
      setLoginError('An unexpected authentication error occurred.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0a] text-white gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-[#D4AF37]" />
        <span className="font-serif uppercase tracking-widest text-[#D4AF37] text-xs">Verifying credentials...</span>
      </div>
    );
  }

  // RENDER LOGIN SCREEN IF NO SESSION
  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a] px-6 select-none relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(212,175,55,0.03)_0%,transparent_70%)] pointer-events-none" />
        
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full glass-panel border border-[#D4AF37]/20 p-6 sm:p-8 rounded shadow-2xl relative"
        >
          {/* Top decorative borders */}
          <div className="absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2 border-[#D4AF37]" />
          <div className="absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2 border-[#D4AF37]" />
          <div className="absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2 border-[#D4AF37]" />
          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2 border-[#D4AF37]" />

          <div className="text-center mb-8 flex flex-col items-center">
            <div className="w-12 h-12 rounded bg-[#D4AF37]/10 flex items-center justify-center text-[#D4AF37] mb-3 border border-[#D4AF37]/20">
              <Award className="w-6 h-6" />
            </div>
            <h1 className="text-xl md:text-2xl font-serif font-bold gold-text-gradient uppercase tracking-widest">Admin Control</h1>
            <p className="text-xs text-white/40 mt-1 uppercase tracking-widest">YR Digital Memories Registry</p>
          </div>

          {loginError && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-4 py-3 rounded mb-6 text-center uppercase tracking-wide">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> Email Address
              </label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@yrdigitalmemories.com"
                className="bg-black/60 border border-white/10 focus:border-[#D4AF37] outline-none px-4 py-3 rounded text-sm transition-colors text-white"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> Security Password
              </label>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="bg-black/60 border border-white/10 focus:border-[#D4AF37] outline-none px-4 py-3 rounded text-sm transition-colors text-white"
              />
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loginLoading}
              className="w-full bg-[#D4AF37] hover:bg-[#AA771C] text-black font-bold uppercase tracking-widest py-3.5 rounded text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              {loginLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Authenticate Credentials'}
            </motion.button>
          </form>
        </motion.div>
      </div>
    );
  }

  // RENDER ADMIN DASHBOARD WRAPPER IF LOGGED IN
  return (
    <div className="min-h-screen bg-[#080808] text-white flex flex-col overflow-x-hidden">
      {/* Admin header */}
      <header className="glass-panel border-b border-white/5 py-4 px-4 sm:px-6 md:px-12 flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="flex items-center justify-between w-full lg:w-auto gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-base sm:text-lg md:text-xl font-bold tracking-wider font-serif gold-text-gradient">
              YR DIGITAL MEMORIES
            </span>
            <span className="bg-white/10 text-white/60 text-[9px] uppercase tracking-widest px-2 py-0.5 sm:px-2.5 sm:py-1 rounded font-semibold border border-white/5">
              Admin
            </span>
          </div>
          
          {/* Sign Out Button for mobile */}
          <button 
            onClick={handleSignOut}
            className="lg:hidden flex items-center gap-1.5 text-[9px] uppercase tracking-widest font-bold text-red-400 border border-red-500/20 hover:bg-red-500/10 px-3 py-2 rounded transition-all cursor-pointer"
          >
            <LogOut className="w-3 h-3" /> Sign Out
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center bg-black/40 border border-white/5 p-1 rounded gap-1 w-full lg:w-auto justify-around sm:justify-center">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 sm:px-5 py-2 rounded text-[10px] sm:text-xs uppercase tracking-widest font-bold transition-all cursor-pointer ${activeTab === 'dashboard' ? 'bg-[#D4AF37] text-black' : 'text-white/60 hover:text-white'}`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" /> 
            <span>Overview</span>
          </button>
          <button 
            onClick={() => setActiveTab('add')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 sm:px-5 py-2 rounded text-[10px] sm:text-xs uppercase tracking-widest font-bold transition-all cursor-pointer ${activeTab === 'add' ? 'bg-[#D4AF37] text-black' : 'text-white/60 hover:text-white'}`}
          >
            <PlusCircle className="w-3.5 h-3.5" /> 
            <span>Add Memory</span>
          </button>
          <button 
            onClick={() => setActiveTab('manage')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 sm:px-5 py-2 rounded text-[10px] sm:text-xs uppercase tracking-widest font-bold transition-all cursor-pointer ${activeTab === 'manage' ? 'bg-[#D4AF37] text-black' : 'text-white/60 hover:text-white'}`}
          >
            <Database className="w-3.5 h-3.5" /> 
            <span>Manage</span>
          </button>
        </div>

        {/* Sign Out Button for desktop layout */}
        <div className="hidden lg:block">
          <button 
            onClick={handleSignOut}
            className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-red-400 border border-red-500/20 hover:bg-red-500/10 px-4 py-2 rounded transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </header>

      {/* Main dashboard content container */}
      <main className="flex-1 p-4 sm:p-6 md:p-12 max-w-7xl w-full mx-auto overflow-x-hidden">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
            >
              <DashboardView />
            </motion.div>
          )}

          {activeTab === 'add' && (
            <motion.div
              key="add"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
            >
              <UploadMemoryForm onUploadSuccess={() => setActiveTab('manage')} />
            </motion.div>
          )}

          {activeTab === 'manage' && (
            <motion.div
              key="manage"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
            >
              <ManageMemoriesTable />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

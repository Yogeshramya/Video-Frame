'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Eye, Trash2, ShieldAlert, RefreshCw, Loader2, CheckCircle2, Play, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Memory {
  id: string;
  customer_name: string;
  memory_title: string;
  description: string;
  image_url: string;
  video_url: string;
  scan_count: number;
  status: string;
  created_at: string;
}

export default function ManageMemoriesTable() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [compiling, setCompiling] = useState(false);
  const [compileStatus, setCompileStatus] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetchMemories();
  }, []);

  const fetchMemories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('memories')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMemories(data || []);
    } catch (err) {
      console.error('Error fetching memories:', err);
    } finally {
      setLoading(false);
    }
  };

  // Dynamic script loader helper
  const loadScript = (src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load: ${src}`));
      document.head.appendChild(script);
    });
  };

  // Image downloader helper
  const downloadAndLoadImage = async (url: string): Promise<HTMLImageElement> => {
    const res = await fetch(url);
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = objUrl;
      img.onload = () => {
        URL.revokeObjectURL(objUrl);
        resolve(img);
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(objUrl);
        reject(err);
      };
    });
  };

  // Re-compiles all memories currently labeled as 'active'
  const triggerRecompilation = async () => {
    try {
      setCompiling(true);
      setActionError(null);
      setCompileStatus('Initializing compiler module...');

      // Load MindAR compiler bundle dynamically
      await loadScript('https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image.prod.js');

      // Fetch active memories
      setCompileStatus('Downloading active target frames...');
      const { data: activeMemories, error: activeError } = await supabase
        .from('memories')
        .select('id, image_url')
        .eq('status', 'active')
        .order('created_at', { ascending: true });

      if (activeError || !activeMemories) {
        throw new Error('Could not fetch active targets for compilation.');
      }

      if (activeMemories.length === 0) {
        // No active targets. Clear the targets settings and mind file
        setCompileStatus('Removing targets settings (no active targets)...');
        await supabase.from('settings').upsert({
          key: 'targets',
          value: { activeIds: [] },
          updated_at: new Date().toISOString(),
        });
        
        // Remove file from storage
        try {
          await supabase.storage.from('memories').remove(['targets/active_targets.mind']);
        } catch (e) {}

        setCompileStatus('Done');
        return;
      }

      const loadedImages: HTMLImageElement[] = [];
      for (const mem of activeMemories) {
        try {
          const img = await downloadAndLoadImage(mem.image_url);
          loadedImages.push(img);
        } catch (downloadErr) {
          console.error(`Failed to load target image: ${mem.image_url}`, downloadErr);
          throw new Error('Image asset retrieval failed. Ensure CORS configurations allow downloads.');
        }
      }

      setCompileStatus('Processing feature vectors (client-side)...');
      const compiler = new (window as any).MINDAR.IMAGE.Compiler();
      
      await compiler.compileImageTargets(loadedImages, (progress: number) => {
        setCompileStatus(`Analyzing image points: ${Math.round(progress)}%`);
      });

      setCompileStatus('Exporting binary targets file...');
      const exportedBuffer = await compiler.exportData();

      setCompileStatus('Uploading revised target to storage bucket...');
      const targetBlob = new Blob([exportedBuffer], { type: 'application/octet-stream' });
      const { error: targetUploadError } = await supabase.storage
        .from('memories')
        .upload('targets/active_targets.mind', targetBlob, {
          contentType: 'application/octet-stream',
          upsert: true,
        });

      if (targetUploadError) throw targetUploadError;

      setCompileStatus('Updating index map registries...');
      const activeIds = activeMemories.map(m => m.id);
      const { error: settingsError } = await supabase
        .from('settings')
        .upsert({
          key: 'targets',
          value: { activeIds },
          updated_at: new Date().toISOString(),
        });

      if (settingsError) throw settingsError;

    } catch (err: any) {
      console.error('Recompilation failure:', err);
      setActionError(err.message || 'Compiler process failed.');
    } finally {
      setCompiling(false);
    }
  };

  // Toggle Memory Active/Disabled Status
  const handleToggleStatus = async (id: string, currentStatus: string) => {
    setActionError(null);
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    try {
      const { error } = await supabase
        .from('memories')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      
      // Update local state first
      setMemories(prev => prev.map(m => m.id === id ? { ...m, status: newStatus } : m));
      
      // Trigger target compilation to reflect change
      await triggerRecompilation();
    } catch (err: any) {
      setActionError(err.message || 'Failed to update memory status.');
    }
  };

  // Delete Memory & cleanup storage files
  const handleDeleteMemory = async (memory: Memory) => {
    if (!confirm(`Are you sure you want to delete the memory of "${memory.customer_name}"? This action is permanent.`)) {
      return;
    }

    setActionError(null);
    try {
      // 1. Delete database row
      const { error: dbError } = await supabase
        .from('memories')
        .delete()
        .eq('id', memory.id);

      if (dbError) throw dbError;

      // 2. Remove files from Supabase Storage
      try {
        const imagePath = memory.image_url.split('/storage/v1/object/public/memories/').pop();
        const videoPath = memory.video_url.split('/storage/v1/object/public/memories/').pop();
        
        const filesToRemove = [];
        if (imagePath) filesToRemove.push(decodeURIComponent(imagePath));
        if (videoPath) filesToRemove.push(decodeURIComponent(videoPath));

        if (filesToRemove.length > 0) {
          await supabase.storage.from('memories').remove(filesToRemove);
        }
      } catch (storageErr) {
        console.warn('Storage files cleanup failed/skipped:', storageErr);
      }

      // 3. Remove local state
      setMemories(prev => prev.filter(m => m.id !== memory.id));

      // 4. Compile targets again
      await triggerRecompilation();
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete memory.');
    }
  };

  return (
    <div className="space-y-6">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-serif font-bold gold-text-gradient uppercase tracking-widest">Manage Memories</h2>
          <p className="text-xs text-white/40 mt-1 uppercase tracking-widest">Active records are compiled into the scanning targets file</p>
        </div>

        {/* Manual Rebuild Button */}
        <button 
          onClick={triggerRecompilation}
          disabled={compiling || loading}
          className="flex items-center gap-2 bg-black/40 border border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10 disabled:opacity-50 px-4 py-2.5 rounded text-xs uppercase tracking-widest font-bold transition-all cursor-pointer"
        >
          {compiling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Force Rebuild Targets
        </button>
      </div>

      {actionError && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-4 py-3 rounded flex items-center gap-2 uppercase tracking-wide">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Compiler Overlay */}
      <AnimatePresence>
        {compiling && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 select-none">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-950 border border-[#D4AF37]/30 max-w-md w-full p-8 rounded shadow-2xl text-center flex flex-col items-center gap-4"
            >
              <Loader2 className="w-10 h-10 animate-spin text-[#D4AF37]" />
              <div className="text-xs uppercase tracking-widest text-[#D4AF37] font-bold">Recompiling AR Target File</div>
              <p className="text-xs text-white/60 font-light">{compileStatus}</p>
              <p className="text-[10px] text-white/20 italic">Do not close this window while targets compile.</p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Table Section */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" />
        </div>
      ) : memories.length === 0 ? (
        <div className="glass-panel text-center py-16 border border-white/5 rounded">
          <ShieldAlert className="w-12 h-12 text-[#D4AF37] opacity-35 mx-auto mb-3" />
          <h4 className="text-sm font-serif uppercase tracking-widest text-white/60">No Memories Found</h4>
          <p className="text-xs text-white/30 mt-1">Click "Add Memory" to upload your first client frame image and wedding video.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded border border-white/5 bg-black/30">
          <table className="min-w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/5 bg-black/50 text-[#D4AF37] uppercase tracking-wider font-semibold font-serif text-[10px]">
                <th className="px-6 py-4">Thumbnail</th>
                <th className="px-6 py-4">Customer Name</th>
                <th className="px-6 py-4">Memory Title</th>
                <th className="px-6 py-4 text-center">Scan Count</th>
                <th className="px-6 py-4">Created Date</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {memories.map((memory) => {
                const date = new Date(memory.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                });

                return (
                  <tr key={memory.id} className="hover:bg-white/[0.02] transition-colors">
                    {/* Thumbnail */}
                    <td className="px-6 py-4">
                      <div className="w-12 h-9 rounded overflow-hidden border border-white/10 bg-zinc-900">
                        <img 
                          src={memory.image_url} 
                          alt={memory.customer_name} 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </td>

                    {/* Customer Name */}
                    <td className="px-6 py-4 font-semibold text-white/90">{memory.customer_name}</td>

                    {/* Memory Title */}
                    <td className="px-6 py-4 text-white/60 font-light">{memory.memory_title}</td>

                    {/* Scan Count */}
                    <td className="px-6 py-4 text-center text-[#D4AF37] font-bold">{memory.scan_count}</td>

                    {/* Created Date */}
                    <td className="px-6 py-4 text-white/50">{date}</td>

                    {/* Status Toggle Badge */}
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => handleToggleStatus(memory.id, memory.status)}
                        className={`px-3 py-1 rounded-full text-[9px] uppercase tracking-widest font-bold border transition-colors cursor-pointer ${
                          memory.status === 'active' 
                            ? 'border-[#D4AF37]/30 text-[#D4AF37] bg-[#D4AF37]/5 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400' 
                            : 'border-white/10 text-white/40 hover:bg-[#D4AF37]/10 hover:border-[#D4AF37]/30 hover:text-[#D4AF37]'
                        }`}
                      >
                        {memory.status === 'active' ? 'Active' : 'Disabled'}
                      </button>
                    </td>

                    {/* Actions buttons */}
                    <td className="px-6 py-4 text-right space-x-2">
                      <a href={`/watch/${memory.id}`} target="_blank" rel="noopener noreferrer">
                        <button className="p-2 text-white/40 hover:text-[#D4AF37] bg-white/5 hover:bg-white/10 border border-white/10 rounded transition-colors cursor-pointer inline-flex items-center" title="Watch Video">
                          <Eye className="w-4 h-4" />
                        </button>
                      </a>
                      <button 
                        onClick={() => handleDeleteMemory(memory)}
                        className="p-2 text-white/40 hover:text-red-400 bg-white/5 hover:bg-red-500/15 border border-white/10 hover:border-red-500/20 rounded transition-colors cursor-pointer inline-flex items-center" 
                        title="Delete Memory"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}

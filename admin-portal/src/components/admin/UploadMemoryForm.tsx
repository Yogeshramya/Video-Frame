'use client';

import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Upload, Film, FileText, User, Tag, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface UploadMemoryFormProps {
  onUploadSuccess: () => void;
}

export default function UploadMemoryForm({ onUploadSuccess }: UploadMemoryFormProps) {
  const [customerName, setCustomerName] = useState('');
  const [memoryTitle, setMemoryTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);

  // Status indicators
  const [step, setStep] = useState<'idle' | 'uploading' | 'compiling' | 'success'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Helper script loader
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

  // Helper image downloader/loader
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

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!imageFile || !videoFile) {
      setError('Both frame image and video files are required.');
      return;
    }

    // Format & Size validations
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const allowedVideoTypes = ['video/mp4', 'video/quicktime']; // MOV is quicktime

    if (!allowedImageTypes.includes(imageFile.type)) {
      setError('Invalid image format. Only JPG, PNG, and WEBP are supported.');
      return;
    }

    if (!allowedVideoTypes.includes(videoFile.type)) {
      setError('Invalid video format. Only MP4 and MOV are supported.');
      return;
    }

    const maxVideoSize = 500 * 1024 * 1024; // 500MB
    if (videoFile.size > maxVideoSize) {
      setError('Video file exceeds the maximum allowed size of 500MB.');
      return;
    }

    try {
      setStep('uploading');
      setProgress(10);
      
      // Step 1: Upload Image to Supabase Storage
      setStatusMessage('Uploading frame image target...');
      const imageExt = imageFile.name.split('.').pop();
      const imagePath = `images/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${imageExt}`;
      
      const { error: imgError } = await supabase.storage
        .from('memories')
        .upload(imagePath, imageFile);

      if (imgError) throw imgError;
      const imageUrl = supabase.storage.from('memories').getPublicUrl(imagePath).data.publicUrl;

      setProgress(40);

      // Step 2: Upload Video to Supabase Storage
      setStatusMessage('Uploading video memory (this may take a moment)...');
      const videoExt = videoFile.name.split('.').pop();
      const videoPath = `videos/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${videoExt}`;

      const { error: vidError } = await supabase.storage
        .from('memories')
        .upload(videoPath, videoFile, {
          cacheControl: '3600',
        });

      if (vidError) throw vidError;
      const videoUrl = supabase.storage.from('memories').getPublicUrl(videoPath).data.publicUrl;

      setProgress(70);

      // Step 3: Insert metadata to memories table
      setStatusMessage('Saving memory registry to database...');
      const { error: dbError } = await supabase
        .from('memories')
        .insert([
          {
            customer_name: customerName,
            memory_title: memoryTitle,
            description: description,
            image_url: imageUrl,
            video_url: videoUrl,
            scan_count: 0,
            status: 'active',
          }
        ]);

      if (dbError) throw dbError;

      setProgress(85);

      // Step 4: Re-compile MindAR Targets
      setStep('compiling');
      setStatusMessage('Initializing MindAR Compiler...');
      
      // Load MindAR compiler production bundle dynamically (using UMD version 1.1.5 to expose global Compiler class)
      await loadScript('https://cdn.jsdelivr.net/npm/mind-ar@1.1.5/dist/mindar-image.prod.js');
      // Fetch all active memories to compile
      setStatusMessage('Retrieving active images...');
      const { data: activeMemories, error: activeError } = await supabase
        .from('memories')
        .select('id, image_url')
        .eq('status', 'active')
        .order('created_at', { ascending: true });

      if (activeError || !activeMemories) {
        throw new Error('Failed to retrieve active memories for target recompilation.');
      }

      setStatusMessage(`Downloading ${activeMemories.length} frame targets into compiler...`);
      const loadedImages: HTMLImageElement[] = [];
      for (const mem of activeMemories) {
        try {
          const img = await downloadAndLoadImage(mem.image_url);
          loadedImages.push(img);
        } catch (downloadErr) {
          console.error(`Failed to download image: ${mem.image_url}`, downloadErr);
          throw new Error('Error downloading image assets for compilation. Check CORS configuration.');
        }
      }

      setStatusMessage('Extracting image feature points (client-side)...');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const compiler = new (window as any).MINDAR.IMAGE.Compiler();
      
      // Compile images
      await compiler.compileImageTargets(loadedImages, (compProgress: number) => {
        setStatusMessage(`Compiling target feature points: ${Math.round(compProgress)}%`);
      });

      setStatusMessage('Exporting compiled target binary...');
      const exportedBuffer = await compiler.exportData();

      setStatusMessage('Uploading updated target file to Storage...');
      const targetBlob = new Blob([exportedBuffer], { type: 'application/octet-stream' });
      const { error: targetUploadError } = await supabase.storage
        .from('memories')
        .upload('targets/active_targets.mind', targetBlob, {
          contentType: 'application/octet-stream',
          upsert: true,
        });

      if (targetUploadError) throw targetUploadError;

      setStatusMessage('Registering new mapping indices...');
      const activeIds = activeMemories.map(m => m.id);
      const { error: settingsError } = await supabase
        .from('settings')
        .upsert({
          key: 'targets',
          value: { activeIds },
          updated_at: new Date().toISOString(),
        });

      if (settingsError) throw settingsError;

      setStep('success');
      setStatusMessage('Memory successfully uploaded, compiled, and deployed!');
      
      // Reset form fields
      setCustomerName('');
      setMemoryTitle('');
      setDescription('');
      setImageFile(null);
      setVideoFile(null);

      // Trigger transition to manage tab
      setTimeout(() => {
        onUploadSuccess();
      }, 2000);

    } catch (err) {
      console.error('Upload flow error:', err);
      const errorMessage = err instanceof Error ? err.message : 'An error occurred during upload or compiler phase.';
      setError(errorMessage);
      setStep('idle');
    }
  };

  return (
    <div className="max-w-2xl mx-auto w-full">
      <div className="text-center mb-6 sm:mb-8">
        <h2 className="text-lg sm:text-xl md:text-2xl font-serif font-bold gold-text-gradient uppercase tracking-widest">Add New Digital Memory</h2>
        <p className="text-[10px] sm:text-xs text-white/40 mt-1 uppercase tracking-widest">Register frame image, video film, and compile target</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-4 py-3 rounded mb-6 flex items-center gap-2 uppercase tracking-wide">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Upload & Compiler Progress Screen */}
      {step !== 'idle' && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-panel border border-[#D4AF37]/20 p-8 rounded shadow-2xl text-center flex flex-col items-center justify-center min-h-[300px] mb-8"
        >
          {step === 'success' ? (
            <div className="flex flex-col items-center gap-4 animate-bounce">
              <CheckCircle2 className="w-16 h-16 text-[#D4AF37]" />
              <h3 className="text-lg font-serif font-bold text-white uppercase tracking-wider">Success!</h3>
              <p className="text-xs text-white/50">{statusMessage}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6 w-full max-w-md">
              <Loader2 className="w-12 h-12 animate-spin text-[#D4AF37]" />
              <div className="space-y-2 w-full">
                <div className="text-xs uppercase tracking-widest text-[#D4AF37] font-bold">{step === 'uploading' ? 'Phase 1: Uploading Files' : 'Phase 2: Compiling AR Targets'}</div>
                <div className="text-xs text-white/50">{statusMessage}</div>
              </div>
              
              {/* Simple gold progress bar */}
              {step === 'uploading' && (
                <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden border border-white/10">
                  <div 
                    className="bg-gradient-to-r from-[#BF953F] to-[#FCF6BA] h-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}

      {step === 'idle' && (
        <form onSubmit={handleFormSubmit} className="space-y-5 sm:space-y-6 glass-panel border border-white/5 p-4 sm:p-6 md:p-8 rounded shadow-lg relative">
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Customer Name */}
            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Customer Name
              </label>
              <input 
                type="text" 
                required
                placeholder="e.g. Sophia & Alexander"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="bg-black/50 border border-white/10 focus:border-[#D4AF37] outline-none px-4 py-3 rounded text-sm transition-colors text-white"
              />
            </div>

            {/* Memory Title */}
            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" /> Memory Title
              </label>
              <input 
                type="text" 
                required
                placeholder="e.g. Wedding Cinematic Film"
                value={memoryTitle}
                onChange={(e) => setMemoryTitle(e.target.value)}
                className="bg-black/50 border border-white/10 focus:border-[#D4AF37] outline-none px-4 py-3 rounded text-sm transition-colors text-white"
              />
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Description
            </label>
            <textarea 
              rows={3}
              placeholder="Provide a brief context or description for this memory plaque (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-black/50 border border-white/10 focus:border-[#D4AF37] outline-none px-4 py-3 rounded text-sm transition-colors text-white resize-none"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
            {/* Frame Image File Picker */}
            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" /> Frame Image target
              </label>
              <div className="relative border border-dashed border-white/10 hover:border-[#D4AF37] rounded transition-colors bg-black/30 p-4 sm:p-6 flex flex-col items-center justify-center cursor-pointer min-h-[100px]">
                <input 
                  type="file" 
                  accept="image/png, image/jpeg, image/webp"
                  required
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <Upload className="w-6 h-6 sm:w-8 sm:h-8 text-[#D4AF37] opacity-60 mb-2" />
                <span className="text-xs font-semibold text-center truncate w-full text-center px-2">
                  {imageFile ? imageFile.name : 'Select Frame Target'}
                </span>
                <span className="text-[9px] text-white/30 uppercase tracking-widest mt-1">JPG, PNG, WEBP</span>
              </div>
            </div>

            {/* Video File Picker */}
            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5" /> Memory Video Film
              </label>
              <div className="relative border border-dashed border-white/10 hover:border-[#D4AF37] rounded transition-colors bg-black/30 p-4 sm:p-6 flex flex-col items-center justify-center cursor-pointer min-h-[100px]">
                <input 
                  type="file" 
                  accept="video/mp4, video/quicktime"
                  required
                  onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <Film className="w-6 h-6 sm:w-8 sm:h-8 text-[#D4AF37] opacity-60 mb-2" />
                <span className="text-xs font-semibold text-center truncate w-full text-center px-2">
                  {videoFile ? videoFile.name : 'Select Memory Video'}
                </span>
                <span className="text-[9px] text-white/30 uppercase tracking-widest mt-1">MP4, MOV (Max 500MB)</span>
              </div>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            className="w-full bg-[#D4AF37] hover:bg-[#AA771C] text-black font-bold uppercase tracking-widest py-4 rounded text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            Create Memory & Compile Target
          </motion.button>
        </form>
      )}
    </div>
  );
}

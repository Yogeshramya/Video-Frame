'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Share2, ArrowLeft, Loader2, Award, Calendar } from 'lucide-react';
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

export default function WatchPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [memory, setMemory] = useState<Memory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [shareSuccess, setShareSuccess] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load memory from Supabase
  useEffect(() => {
    if (!id) return;

    const fetchMemory = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('memories')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (error || !data) {
          setError('Memory not found or has been disabled by administrator.');
        } else {
          setMemory(data);
        }
      } catch (err) {
        console.error('Error fetching memory:', err);
        setError('Failed to load memory database record.');
      } finally {
        setLoading(false);
      }
    };

    fetchMemory();
  }, [id]);

  // Handle controls fadeout
  const handleUserActivity = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3500);
  };

  useEffect(() => {
    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('touchstart', handleUserActivity);
    return () => {
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('touchstart', handleUserActivity);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying]);

  // Autoplay handler
  useEffect(() => {
    if (memory && videoRef.current) {
      const playVideo = async () => {
        try {
          // Try to autoplay with sound first (unmuted)
          videoRef.current!.muted = false;
          setIsMuted(false);
          await videoRef.current!.play();
          setIsPlaying(true);
        } catch (unmutedErr) {
          console.log('Unmuted autoplay blocked, falling back to muted autoplay');
          try {
            // Force muted autoplay which browsers always allow
            videoRef.current!.muted = true;
            setIsMuted(true);
            await videoRef.current!.play();
            setIsPlaying(true);
          } catch (mutedErr) {
            console.log('Muted autoplay blocked, waiting for user interaction');
          }
        }
      };
      playVideo();
    }
  }, [memory]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
    handleUserActivity();
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
    handleUserActivity();
  };

  const handleReplay = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    videoRef.current.play().catch(() => {});
    setIsPlaying(true);
    handleUserActivity();
  };

  const handleShare = async () => {
    try {
      const url = window.location.href;
      await navigator.clipboard.writeText(url);
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to copy link', err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0a] text-white gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-[#D4AF37]" />
        <span className="font-serif uppercase tracking-widest text-[#D4AF37] text-sm">Loading Premium Memory...</span>
      </div>
    );
  }

  if (error || !memory) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0a] text-white p-6 text-center">
        <Award className="w-16 h-16 text-[#D4AF37] opacity-40 mb-4" />
        <h2 className="text-2xl font-bold font-serif mb-2 text-[#D4AF37] uppercase">Playback Error</h2>
        <p className="text-gray-400 max-w-md text-sm font-light mb-8">{error || 'Something went wrong.'}</p>
        <Link href="/">
          <button className="bg-[#D4AF37] text-black font-bold uppercase tracking-widest px-8 py-3 rounded text-xs hover:bg-[#AA771C] transition-colors">
            Back to Homepage
          </button>
        </Link>
      </div>
    );
  }

  const formattedDate = new Date(memory.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="relative min-h-screen bg-black text-white overflow-hidden flex flex-col justify-center select-none">
      
      {/* Dynamic Video Element */}
      <video
        ref={videoRef}
        src={memory.video_url}
        playsInline
        loop
        onClick={togglePlay}
        className="absolute inset-0 w-full h-full object-cover z-0"
      />

      {/* Luxury Plaque Card & Overlay Controls */}
      <AnimatePresence>
        {showControls && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 bg-gradient-to-t from-black/80 via-black/10 to-black/60 flex flex-col justify-between p-6 md:p-12 pointer-events-none"
          >
            {/* Top Navigation */}
            <div className="flex justify-between items-center w-full pointer-events-auto">
              <button 
                onClick={() => router.back()}
                className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold hover:text-[#D4AF37] bg-black/40 backdrop-blur-md border border-white/10 px-4 py-2.5 rounded transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              
              <button 
                onClick={handleShare}
                className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold hover:text-[#D4AF37] bg-black/40 backdrop-blur-md border border-white/10 px-4 py-2.5 rounded transition-all cursor-pointer"
              >
                <Share2 className="w-4 h-4" /> {shareSuccess ? 'Link Copied!' : 'Share'}
              </button>
            </div>

            {/* Tap indicator if muted */}
            {isMuted && isPlaying && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
                <motion.button
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  onClick={toggleMute}
                  className="bg-[#D4AF37] text-black font-bold uppercase tracking-widest text-xs px-6 py-3.5 rounded-full shadow-[0_0_20px_rgba(212,175,55,0.4)] flex items-center gap-2 cursor-pointer"
                >
                  <VolumeX className="w-4 h-4 animate-bounce" /> Tap to Unmute
                </motion.button>
              </div>
            )}

            {/* Bottom Memory Plaque & Player Bar */}
            <div className="w-full flex flex-col gap-6 pointer-events-auto">
              {/* Gold Carved Memory Plaque */}
              <div className="w-full max-w-xl self-start bg-black/75 backdrop-blur-lg border border-[#D4AF37]/30 p-6 rounded shadow-2xl relative overflow-hidden">
                {/* Gold corner accents */}
                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#D4AF37]" />
                <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#D4AF37]" />
                <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#D4AF37]" />
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#D4AF37]" />

                <div className="flex flex-col gap-1.5">
                  <h1 className="text-xl md:text-2xl font-bold font-serif gold-text-gradient uppercase tracking-wider">
                    {memory.memory_title}
                  </h1>
                  <div className="text-sm font-semibold text-white/90">{memory.customer_name}</div>
                  <div className="flex items-center gap-1.5 text-white/50 text-xs mt-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{formattedDate}</span>
                  </div>
                  {memory.description && (
                    <p className="text-gray-400 text-xs mt-2 font-light leading-relaxed border-t border-white/5 pt-2">
                      {memory.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Player control bar */}
              <div className="flex items-center justify-between bg-black/60 backdrop-blur-md border border-white/5 px-6 py-4 rounded-lg">
                <div className="flex items-center gap-6">
                  <button 
                    onClick={togglePlay}
                    className="text-white hover:text-[#D4AF37] transition-colors cursor-pointer"
                  >
                    {isPlaying ? <Pause className="w-6 h-6 fill-white hover:fill-[#D4AF37]" /> : <Play className="w-6 h-6 fill-white hover:fill-[#D4AF37]" />}
                  </button>
                  <button 
                    onClick={handleReplay}
                    className="text-white hover:text-[#D4AF37] transition-colors cursor-pointer"
                    title="Replay Video"
                  >
                    <RotateCcw className="w-5.5 h-5.5" />
                  </button>
                </div>

                <div>
                  <button 
                    onClick={toggleMute}
                    className="text-white hover:text-[#D4AF37] transition-colors cursor-pointer"
                  >
                    {isMuted ? <VolumeX className="w-6 h-6 text-red-400" /> : <Volume2 className="w-6 h-6 text-[#D4AF37]" />}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

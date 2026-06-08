'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { Camera, RefreshCw, AlertTriangle, ArrowLeft, Loader2, Sparkles, Volume2, VolumeX } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

// Prevent TypeScript compile errors for custom A-Frame elements
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'a-scene': any;
      'a-camera': any;
      'a-entity': any;
      'a-assets': any;
      'a-video': any;
      'a-plane': any;
    }
  }
  namespace React {
    namespace JSX {
      interface IntrinsicElements {
        'a-scene': any;
        'a-camera': any;
        'a-entity': any;
        'a-assets': any;
        'a-video': any;
        'a-plane': any;
      }
    }
  }
}

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

export default function ScannerPage() {
  const router = useRouter();
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [activeIds, setActiveIds] = useState<string[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [aspectRatios, setAspectRatios] = useState<{ [key: string]: number }>({});
  const [activeMemory, setActiveMemory] = useState<Memory | null>(null);
  
  const [loadingMessage, setLoadingMessage] = useState('Initializing AR platform...');
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isMuted, setIsMuted] = useState(false); // Play with sound by default!

  const isMutedRef = useRef(isMuted);
  const loggedIds = useRef<Set<string>>(new Set());

  // Keep isMutedRef updated
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // 1. Fetch active targets and memory records from Supabase
  useEffect(() => {
    const fetchTargetsAndMemories = async () => {
      try {
        setLoadingMessage('Fetching memory registry...');
        let ids: string[] = [];
        const { data: settingsData, error: settingsError } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'targets')
          .maybeSingle();

        if (settingsError || !settingsData) {
          // Fallback to active memories list
          const { data: memoriesList, error: memError } = await supabase
            .from('memories')
            .select('id')
            .eq('status', 'active')
            .order('created_at', { ascending: true });

          if (memError || !memoriesList || memoriesList.length === 0) {
            setError('No active memory frames are currently configured in the platform.');
            return;
          }
          ids = memoriesList.map(m => m.id);
        } else {
          ids = settingsData.value.activeIds || [];
        }

        if (ids.length === 0) {
          setError('No active memory frames are configured.');
          return;
        }

        setActiveIds(ids);
        setLoadingMessage('Loading media assets...');

        const { data: memoriesData, error: fetchMemError } = await supabase
          .from('memories')
          .select('*')
          .in('id', ids);

        if (fetchMemError || !memoriesData || memoriesData.length === 0) {
          setError('Failed to fetch the registered memory assets.');
          return;
        }

        // Align and order memories exactly as activeIds indices
        const orderedMemories = ids
          .map(id => memoriesData.find(m => m.id === id))
          .filter(Boolean) as Memory[];

        setMemories(orderedMemories);

        // Preload aspect ratios
        const ratios: { [key: string]: number } = {};
        await Promise.all(
          orderedMemories.map(m => {
            return new Promise<void>((resolve) => {
              const img = new Image();
              img.src = m.image_url;
              img.onload = () => {
                ratios[m.id] = img.naturalHeight / img.naturalWidth;
                resolve();
              };
              img.onerror = () => {
                ratios[m.id] = 0.75; // 4:3 default fallback
                resolve();
              };
            });
          })
        );
        setAspectRatios(ratios);
      } catch (err) {
        console.error('Error fetching registry data:', err);
        setError('Failed to initialize active targets registry.');
      }
    };

    fetchTargetsAndMemories();
  }, []);

  // 2. Dynamic scripts loader
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

  // 3. Sequential load of A-Frame and MindAR
  useEffect(() => {
    if (activeIds.length === 0) return;

    let isMounted = true;

    const loadAR = async () => {
      try {
        setLoadingMessage('Loading camera viewport...');
        await loadScript('https://aframe.io/releases/1.5.0/aframe.min.js');
        setLoadingMessage('Loading image recognition engine...');
        await loadScript('https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js');
        
        if (isMounted) {
          setScriptsLoaded(true);
          setIsScanning(true);
        }
      } catch (err) {
        console.error('AR engine load error:', err);
        if (isMounted) {
          setError('Failed to load the Augmented Reality engine. Please refresh and try again.');
        }
      }
    };

    loadAR();

    return () => {
      isMounted = false;
      try {
        const sceneEl = document.querySelector('a-scene') as any;
        if (sceneEl && sceneEl.systems && sceneEl.systems['mindar-image-system']) {
          sceneEl.systems['mindar-image-system'].stop();
        }
      } catch (e) {
        console.warn('Error stopping AR systems:', e);
      }

      // Cleanup dynamically appended video feeds and overlays
      const videos = document.querySelectorAll('body > video');
      videos.forEach(v => v.remove());

      const ui = document.querySelectorAll('.mindar-ui-overlay');
      ui.forEach(u => u.remove());
    };
  }, [activeIds]);

  // 3b. Hide MindAR's built-in UI and fix any remaining sizing issues
  useEffect(() => {
    if (!scriptsLoaded) return;

    const fixMindAR = () => {
      // Hide MindAR's own gray scanning corners — we use our custom reticle
      document.querySelectorAll('.mindar-ui-overlay').forEach(el => {
        (el as HTMLElement).style.setProperty('display', 'none', 'important');
      });

      // Target only the camera feed video (no src = getUserMedia stream)
      // Our memory videos in <a-assets> have src attributes, so :not([src]) is safe
      document.querySelectorAll('video:not([src]), video[src=""]').forEach(el => {
        const v = el as HTMLElement;
        v.style.setProperty('position', 'fixed', 'important');
        v.style.setProperty('top', '0', 'important');
        v.style.setProperty('left', '0', 'important');
        v.style.setProperty('width', '100vw', 'important');
        v.style.setProperty('height', '100vh', 'important');
        v.style.setProperty('object-fit', 'cover', 'important');
        v.style.setProperty('z-index', '0', 'important');
      });
    };

    fixMindAR();
    const t1 = setTimeout(fixMindAR, 300);
    const t2 = setTimeout(fixMindAR, 1000);
    const t3 = setTimeout(fixMindAR, 3000);

    // Watch for MindAR dynamically injecting elements
    const observer = new MutationObserver(fixMindAR);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [scriptsLoaded]);



  // Audio chime feedback using Web Audio API
  const playDetectionSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const now = ctx.currentTime;
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now); // A5 note
      osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(554.37, now); // C#5 note
      osc2.frequency.exponentialRampToValueAtTime(880, now + 0.25);
      gain2.gain.setValueAtTime(0.08, now);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.4);
      osc2.stop(now + 0.65);
    } catch (e) {
      console.warn('Web Audio chime failed:', e);
    }
  };

  // 4. Attach target event listeners
  useEffect(() => {
    if (!scriptsLoaded || memories.length === 0) return;

    const targetEntities = document.querySelectorAll('[mindar-image-target]');
    
    const handleTargetFound = (event: any) => {
      const targetEl = event.currentTarget;
      const indexAttr = targetEl.getAttribute('data-index');
      const memoryId = targetEl.getAttribute('data-id');
      const index = parseInt(indexAttr, 10);
      
      const foundMemory = memories.find(m => m.id === memoryId);
      if (!foundMemory) return;

      console.log(`Detected target index: ${index}, memory: ${memoryId}`);
      setActiveMemory(foundMemory);

      // Play A-Frame projected video
      const video = document.querySelector(`#video-${memoryId}`) as HTMLVideoElement;
      if (video) {
        video.muted = isMutedRef.current;
        video.play().catch(err => {
          console.log('Autoplay unmuted blocked by browser policy, falling back to muted play', err);
          video.muted = true;
          setIsMuted(true);
          video.play().catch(e => console.error('Video play blocked completely', e));
        });
      }

      playDetectionSound();

      // Log analytics only once per session
      if (!loggedIds.current.has(memoryId)) {
        loggedIds.current.add(memoryId);
        logScanAnalytics(memoryId);
      }
    };

    const handleTargetLost = (event: any) => {
      const targetEl = event.currentTarget;
      const memoryId = targetEl.getAttribute('data-id');
      
      console.log(`Lost target frame: ${memoryId}`);

      const video = document.querySelector(`#video-${memoryId}`) as HTMLVideoElement;
      if (video) {
        video.pause();
      }

      setActiveMemory(prev => prev?.id === memoryId ? null : prev);
    };

    targetEntities.forEach(el => {
      el.addEventListener('targetFound', handleTargetFound);
      el.addEventListener('targetLost', handleTargetLost);
    });

    return () => {
      targetEntities.forEach(el => {
        el.removeEventListener('targetFound', handleTargetFound);
        el.removeEventListener('targetLost', handleTargetLost);
      });
    };
  }, [scriptsLoaded, memories]);

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    memories.forEach(m => {
      const video = document.querySelector(`#video-${m.id}`) as HTMLVideoElement;
      if (video) {
        video.muted = newMuted;
      }
    });
  };

  // 5. Log analytics entries to Supabase
  const logScanAnalytics = async (memoryId: string) => {
    let deviceType = 'Desktop';
    let browser = 'Unknown';
    let country = 'Unknown';
    let city = 'Unknown';

    const ua = navigator.userAgent;
    if (/mobile/i.test(ua)) deviceType = 'Mobile';
    else if (/tablet/i.test(ua)) deviceType = 'Tablet';

    if (ua.indexOf('Chrome') > -1) browser = 'Chrome';
    else if (ua.indexOf('Safari') > -1) browser = 'Safari';
    else if (ua.indexOf('Firefox') > -1) browser = 'Firefox';
    else if (ua.indexOf('Edge') > -1) browser = 'Edge';

    try {
      const res = await fetch('https://ipapi.co/json/');
      if (res.ok) {
        const loc = await res.json();
        country = loc.country_name || 'Unknown';
        city = loc.city || 'Unknown';
      }
    } catch (e) {
      console.warn('IP location fetch bypassed/failed:', e);
    }

    try {
      const { data: mem } = await supabase
        .from('memories')
        .select('scan_count')
        .eq('id', memoryId)
        .maybeSingle();
      
      if (mem) {
        await supabase
          .from('memories')
          .update({ scan_count: (mem.scan_count || 0) + 1 })
          .eq('id', memoryId);
      }

      await supabase.from('scan_analytics').insert([
        {
          memory_id: memoryId,
          device_type: deviceType,
          browser: browser,
          country: country,
          city: city,
        }
      ]);
    } catch (err) {
      console.error('Error logging scan analytics:', err);
    }
  };

  return (
    <div className="relative min-h-screen bg-black text-white overflow-hidden flex flex-col justify-between">
      
      {/* Absolute Home Button */}
      <div className="fixed top-4 left-4 sm:top-6 sm:left-6 z-50">
        <Link href="/">
          <button className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs uppercase tracking-widest font-bold bg-black/60 backdrop-blur-md border border-white/10 px-3 py-2 sm:px-4 sm:py-2.5 rounded hover:text-[#D4AF37] transition-colors cursor-pointer">
            <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Home
          </button>
        </Link>
      </div>

      {/* Loading & Error States Screen */}
      {!scriptsLoaded && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/95 text-center p-6">
          {error ? (
            <div className="flex flex-col items-center gap-4 max-w-md">
              <AlertTriangle className="w-16 h-16 text-red-500 opacity-80" />
              <h2 className="text-xl font-bold font-serif text-[#D4AF37] uppercase">Scanner Issue</h2>
              <p className="text-xs text-gray-400 font-light leading-relaxed">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="mt-4 flex items-center gap-2 bg-[#D4AF37] text-black text-xs font-bold uppercase tracking-widest px-6 py-3 rounded hover:bg-[#AA771C] transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" /> Refresh Page
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-[#D4AF37]" />
              <span className="font-serif uppercase tracking-widest text-[#D4AF37] text-xs">{loadingMessage}</span>
              <p className="text-[10px] text-white/30 max-w-xs leading-relaxed">Ensure camera permissions are allowed when prompted.</p>
            </div>
          )}
        </div>
      )}

      {/* Scanner UI Reticle overlay - Hidden when memory is actively projected */}
      {scriptsLoaded && isScanning && !activeMemory && (
        <div className="fixed inset-0 z-40 flex flex-col items-center px-6 pt-6 pb-8 sm:px-8 sm:pt-8 sm:pb-10 pointer-events-none">
          {/* Top scanning header — w-fit prevents full-width stretch, keeping it centered */}
          <div className="mt-16 sm:mt-20 w-fit bg-black/50 backdrop-blur-sm border border-white/5 rounded-full px-4 py-1.5 sm:px-6 sm:py-2 text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-[#D4AF37] flex items-center justify-center gap-1.5 sm:gap-2">
            <Camera className="w-3.5 h-3.5 animate-pulse" /> Point camera at physical frame
          </div>

          {/* flex-1 wrapper ensures reticle is perfectly centered in remaining space */}
          <div className="flex-1 flex items-center justify-center">
            <div className="relative w-56 h-56 min-[375px]:w-64 min-[375px]:h-64 md:w-80 md:h-80 border-2 border-white/10 rounded-lg flex items-center justify-center">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#D4AF37] rounded-tl" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#D4AF37] rounded-tr" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#D4AF37] rounded-bl" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#D4AF37] rounded-br" />
              <div className="absolute left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent shadow-[0_0_10px_rgba(212,175,55,0.8)] animate-[bounce_3s_infinite]" />
            </div>
          </div>

          {/* Footer search message */}
          <div className="text-[10px] sm:text-[11px] text-white/50 tracking-wider bg-black/40 px-4 py-1.5 sm:px-5 sm:py-2 rounded-full border border-white/5">
            Searching for active photo frames...
          </div>
        </div>
      )}

      {/* Floating active memory plaque overlay */}
      <AnimatePresence>
        {activeMemory && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-6 right-6 md:left-12 md:right-12 z-50 flex flex-col sm:flex-row items-center justify-between gap-4 pointer-events-none"
          >
            {/* Memory details card */}
            <div className="w-full max-w-lg bg-black/85 backdrop-blur-md border border-[#D4AF37]/30 p-4 sm:p-5 rounded shadow-2xl relative overflow-hidden pointer-events-auto">
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#D4AF37]" />
              <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#D4AF37]" />
              <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#D4AF37]" />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#D4AF37]" />

              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#D4AF37] animate-pulse" /> Playing Augmented Memory
                </span>
                <h2 className="text-base sm:text-lg font-serif font-bold gold-text-gradient uppercase tracking-wider mt-1">
                  {activeMemory.memory_title}
                </h2>
                <div className="text-xs text-white/80 font-semibold">{activeMemory.customer_name}</div>
                {activeMemory.description && (
                  <p className="text-gray-400 text-[10px] sm:text-xs font-light leading-relaxed border-t border-white/5 pt-1.5 mt-1.5 max-h-12 overflow-y-auto">
                    {activeMemory.description}
                  </p>
                )}
              </div>
            </div>

            {/* Mute/Unmute Floating Button */}
            <div className="pointer-events-auto">
              <button
                onClick={toggleMute}
                className="bg-black/60 backdrop-blur-md border border-[#D4AF37]/30 hover:border-[#D4AF37] p-3.5 rounded-full text-white hover:text-[#D4AF37] transition-all cursor-pointer shadow-lg hover:shadow-[0_0_15px_rgba(212,175,55,0.2)]"
              >
                {isMuted ? (
                  <VolumeX className="w-5 h-5 text-red-400" />
                ) : (
                  <Volume2 className="w-5 h-5 text-[#D4AF37]" />
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MindAR A-Frame Canvas Area — no embedded = A-Frame owns full screen natively */}
      {scriptsLoaded && (
        <a-scene 
          mindar-image="imageTargetSrc: /api/targets; autoStart: true; maxTrack: 1; filterMinCF: 0.0001; filterBeta: 0.001; uiLoading: no; uiScanning: no; uiError: no;"
          color-space="sRGB"
          renderer="colorManagement: true, physicallyCorrectLights"
          vr-mode-ui="enabled: false"
          device-orientation-permission-ui="enabled: false"
        >
            <a-assets>
              {memories.map(m => (
                <video
                  key={m.id}
                  id={`video-${m.id}`}
                  src={m.video_url}
                  loop
                  playsInline
                  webkit-playsinline="true"
                  crossOrigin="anonymous"
                  muted={isMuted}
                />
              ))}
            </a-assets>

            <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>

            {/* Mapping active memories to their corresponding index targets */}
            {memories.map((m, index) => {
              const height = aspectRatios[m.id] || 0.75;
              return (
                <a-entity 
                  key={m.id}
                  mindar-image-target={`targetIndex: ${index}`}
                  data-index={index}
                  data-id={m.id}
                >
                  <a-video
                    src={`#video-${m.id}`}
                    width="1"
                    height={height}
                    position="0 0 0"
                    rotation="0 0 0"
                  />
                </a-entity>
              );
            })}
        </a-scene>
      )}
    </div>
  );
}

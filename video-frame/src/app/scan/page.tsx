'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { Camera, RefreshCw, AlertTriangle, ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import Link from 'next/link';

// Prevent TypeScript compile errors for custom A-Frame elements
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'a-scene': any;
      'a-camera': any;
      'a-entity': any;
    }
  }
  namespace React {
    namespace JSX {
      interface IntrinsicElements {
        'a-scene': any;
        'a-camera': any;
        'a-entity': any;
      }
    }
  }
}

export default function ScannerPage() {
  const router = useRouter();
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [activeIds, setActiveIds] = useState<string[]>([]);
  const [loadingMessage, setLoadingMessage] = useState('Initializing AR platform...');
  const [error, setError] = useState<string | null>(null);
  const [detectedId, setDetectedId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // 1. Fetch active targets mapping from Supabase
  useEffect(() => {
    const fetchTargets = async () => {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'targets')
          .maybeSingle();

        if (error || !data) {
          // If settings doc doesn't exist, we fall back to sorting active memories by created_at
          const { data: memories, error: memError } = await supabase
            .from('memories')
            .select('id')
            .eq('status', 'active')
            .order('created_at', { ascending: true });

          if (memError || !memories || memories.length === 0) {
            setError('No active memory frames are currently configured in the platform.');
            return;
          }
          setActiveIds(memories.map(m => m.id));
        } else {
          setActiveIds(data.value.activeIds || []);
        }
      } catch (err) {
        console.error('Error loading targets list:', err);
        setError('Failed to load active targets registry.');
      }
    };

    fetchTargets();
  }, []);

  // 2. Load script loader helper
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

  // 3. Sequential load of A-Frame then MindAR
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
        console.error('Script loading error:', err);
        if (isMounted) {
          setError('Failed to load the Augmented Reality engine. Please refresh and try again.');
        }
      }
    };

    loadAR();

    // Cleanup camera stream and dom elements on page leave
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

      // Clean up DOM fragments appended by MindAR/A-Frame
      const videos = document.querySelectorAll('body > video');
      videos.forEach(v => v.remove());

      const ui = document.querySelectorAll('.mindar-ui-overlay');
      ui.forEach(u => u.remove());
    };
  }, [activeIds]);

  // Audio chime feedback using Web Audio API
  const playDetectionSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const now = ctx.currentTime;
      
      // First tone (higher frequency, shorter)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now); // A5 note
      osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      
      // Second tone (slightly lower frequency, longer, creating a chime effect)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(554.37, now); // C#5 note
      osc2.frequency.exponentialRampToValueAtTime(880, now + 0.25);
      gain2.gain.setValueAtTime(0.1, now);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.4);
      osc2.stop(now + 0.65);
    } catch (e) {
      console.warn('Web Audio playback failed:', e);
    }
  };

  // 4. Listen to MindAR events
  useEffect(() => {
    if (!scriptsLoaded || activeIds.length === 0) return;

    const targetEntities = document.querySelectorAll('[mindar-image-target]');
    
    const handleTargetFound = async (event: any) => {
      const targetEl = event.currentTarget;
      const indexAttr = targetEl.getAttribute('data-index');
      const memoryIdAttr = targetEl.getAttribute('data-id');
      
      if (detectedId) return; // Prevent multiple triggers
      
      // Play detection audio feedback
      playDetectionSound();
      
      const index = parseInt(indexAttr, 10);
      const memoryId = memoryIdAttr;

      console.log(`Detected frame at index: ${index}, memoryId: ${memoryId}`);
      setDetectedId(memoryId);
      setIsScanning(false);

      // Play transition feedback and redirect
      await logScanAnalytics(memoryId);
      
      setTimeout(() => {
        router.push(`/watch/${memoryId}`);
      }, 1500);
    };

    targetEntities.forEach(el => {
      el.addEventListener('targetFound', handleTargetFound);
    });

    return () => {
      targetEntities.forEach(el => {
        el.removeEventListener('targetFound', handleTargetFound);
      });
    };
  }, [scriptsLoaded, activeIds, detectedId]);

  // 5. Log scan analytics to Supabase
  const logScanAnalytics = async (memoryId: string) => {
    let deviceType = 'Desktop';
    let browser = 'Unknown';
    let country = 'Unknown';
    let city = 'Unknown';

    // Parse UA
    const ua = navigator.userAgent;
    if (/mobile/i.test(ua)) deviceType = 'Mobile';
    else if (/tablet/i.test(ua)) deviceType = 'Tablet';

    if (ua.indexOf('Chrome') > -1) browser = 'Chrome';
    else if (ua.indexOf('Safari') > -1) browser = 'Safari';
    else if (ua.indexOf('Firefox') > -1) browser = 'Firefox';
    else if (ua.indexOf('Edge') > -1) browser = 'Edge';

    // Resolve location
    try {
      const res = await fetch('https://ipapi.co/json/');
      if (res.ok) {
        const loc = await res.json();
        country = loc.country_name || 'Unknown';
        city = loc.city || 'Unknown';
      }
    } catch (e) {
      console.warn('Geolocation lookup bypassed/failed:', e);
    }

    try {
      // Fetch and increment scan count
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

      // Record detailed scan log
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
      console.error('Analytics save error:', err);
    }
  };

  return (
    <div className="relative min-h-screen bg-black text-white overflow-hidden flex flex-col justify-between">
      
      {/* Background/Camera UI Overlay */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-20">
        <Link href="/">
          <button className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs uppercase tracking-widest font-bold bg-black/60 backdrop-blur-md border border-white/10 px-3 py-2 sm:px-4 sm:py-2.5 rounded hover:text-[#D4AF37] transition-colors cursor-pointer">
            <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Home
          </button>
        </Link>
      </div>

      {/* Loader UI before AR begins */}
      {(!scriptsLoaded || detectedId) && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/95 text-center p-6">
          {detectedId ? (
            <div className="flex flex-col items-center gap-4 animate-pulse">
              <div className="w-16 h-16 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37] flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-[#D4AF37]" />
              </div>
              <h2 className="text-2xl font-serif gold-text-gradient uppercase tracking-widest font-bold">Frame Detected!</h2>
              <p className="text-xs text-gray-400">Loading your cinematic memory experience...</p>
            </div>
          ) : error ? (
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
              <p className="text-[10px] text-white/30 max-w-xs leading-relaxed">Please ensure you grant camera permissions when prompted.</p>
            </div>
          )}
        </div>
      )}

      {/* Target Reticle Overlay during scanning */}
      {scriptsLoaded && isScanning && (
        <div className="absolute inset-0 z-10 flex flex-col justify-between items-center p-6 sm:p-8 pointer-events-none">
          {/* Top scanning header */}
          <div className="bg-black/50 backdrop-blur-sm border border-white/5 rounded-full px-4 py-1.5 sm:px-6 sm:py-2 mt-20 text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-[#D4AF37] flex items-center gap-1.5 sm:gap-2">
            <Camera className="w-3.5 h-3.5 animate-pulse" /> Point camera at physical frame
          </div>

          {/* Central reticle design */}
          <div className="relative w-56 h-56 min-[375px]:w-64 min-[375px]:h-64 md:w-80 md:h-80 border-2 border-white/10 rounded-lg flex items-center justify-center">
            {/* Custom bracket corners */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#D4AF37] rounded-tl" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#D4AF37] rounded-tr" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#D4AF37] rounded-bl" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#D4AF37] rounded-br" />
            
            {/* Glowing scan bar */}
            <div className="absolute left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent shadow-[0_0_10px_rgba(212,175,55,0.8)] animate-[bounce_3s_infinite]" />
          </div>

          {/* Footer search message */}
          <div className="text-[10px] sm:text-[11px] text-white/50 tracking-wider bg-black/40 px-4 py-1.5 sm:px-5 sm:py-2 rounded-full border border-white/5">
            Searching for active photo frames...
          </div>
        </div>
      )}

      {/* MindAR A-Frame Canvas Area */}
      {scriptsLoaded && (
        <div className="fixed inset-0 w-full h-full z-0">
          <a-scene 
            mindar-image="imageTargetSrc: /api/targets; autoStart: true; maxTrack: 1; filterMinCF: 0.0001; filterBeta: 0.001;" 
            color-space="sRGB" 
            embedded 
            renderer="colorManagement: true, physicallyCorrectLights" 
            vr-mode-ui="enabled: false" 
            device-orientation-permission-ui="enabled: false"
            class="w-full h-full"
          >
            <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>

            {/* Programmatically list and assign index to each target */}
            {activeIds.map((id, index) => (
              <a-entity 
                key={id}
                mindar-image-target={`targetIndex: ${index}`}
                data-index={index}
                data-id={id}
              />
            ))}
          </a-scene>
        </div>
      )}
    </div>
  );
}

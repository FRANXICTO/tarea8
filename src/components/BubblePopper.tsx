import React, { useEffect, useRef, useState } from "react";
import { Bubble, Particle, HandPointer } from "../types";
import { Play, Pause, RefreshCw, Zap, Volume2, VolumeX, Sparkles, Camera, HelpCircle } from "lucide-react";

export default function BubblePopper() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Game state
  const [score, setScore] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [trackingMode, setTrackingMode] = useState<"camera" | "manual">("manual");
  const [isMediaPipeLoading, setIsMediaPipeLoading] = useState<boolean>(false);
  const [mediaPipeStatus, setMediaPipeStatus] = useState<string>("Desconectado");
  const [hasCamera, setHasCamera] = useState<boolean>(false);
  
  // Ref pointers to bridge with non-reactive requestAnimationFrame loop
  const scoreRef = useRef<number>(0);
  const bubblesRef = useRef<Bubble[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const handPointersRef = useRef<HandPointer[]>([]);
  const lastSpawnTimeRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(true);
  const trackModeRef = useRef<"camera" | "manual">("manual");
  
  const mousePointerRef = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });
  const activeAudioContextRef = useRef<AudioContext | null>(null);

  // Synced state refs
  useEffect(() => {
    scoreRef.current = score;
    isPlayingRef.current = isPlaying;
    trackModeRef.current = trackingMode;
  }, [score, isPlaying, trackingMode]);

  // Audio effect generator
  const playPopSound = () => {
    if (isMuted) return;
    try {
      if (!activeAudioContextRef.current) {
        activeAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = activeAudioContextRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      // Sweeping frequency upwards for a neat popping sound
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.13);
    } catch (e) {
      console.warn("Audio Context popping error:", e);
    }
  };

  // Dynamically load MediaPipe Libraries safely from CDN
  const loadMediaPipe = async () => {
    if (trackingMode === "camera") return; // already loaded or loading
    setIsMediaPipeLoading(true);
    setMediaPipeStatus("Cargando scripts...");

    try {
      await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js");
      await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js");
      
      setMediaPipeStatus("Configurando cámara...");
      setupCameraAndHands();
    } catch (err) {
      console.error("Error loading MediaPipe Scripts:", err);
      setMediaPipeStatus("Fallo al iniciar. Usando modo táctil.");
      setTrackingMode("manual");
      setIsMediaPipeLoading(false);
    }
  };

  const loadScript = (src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Fallo de script: ${src}`));
      document.head.appendChild(script);
    });
  };

  // Setup camera and MediaPipe Hands instance
  const setupCameraAndHands = async () => {
    const HandsClass = (window as any).Hands;
    const CameraClass = (window as any).Camera;

    if (!HandsClass || !CameraClass) {
      setMediaPipeStatus("Librerías no presentes. Modo táctil activado.");
      setTrackingMode("manual");
      setIsMediaPipeLoading(false);
      return;
    }

    try {
      const hands = new HandsClass({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      hands.onResults((results: any) => {
        const pointers: HandPointer[] = [];
        if (results.multiHandLandmarks && results.multiHandedness) {
          results.multiHandLandmarks.forEach((landmarks: any, handIndex: number) => {
            // landmarks 8 (Index tip) and 12 (Middle tip)
            [8, 12].forEach((landmarkId) => {
              const pt = landmarks[landmarkId];
              if (pt) {
                // MediaPipe gives coordinates in 0..1 scale.
                // Since our canvas and video will both be mirrored with scaleX(-1),
                // we map X coordinate accordingly.
                pointers.push({
                  x: pt.x,
                  y: pt.y,
                  index: landmarkId,
                  handIndex: handIndex
                });
              }
            });
          });
        }
        handPointersRef.current = pointers;
      });

      if (videoRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 }
        });
        videoRef.current.srcObject = stream;
        setHasCamera(true);

        const cameraInstance = new CameraClass(videoRef.current, {
          onFrame: async () => {
            if (videoRef.current && trackModeRef.current === "camera") {
              await hands.send({ image: videoRef.current });
            }
          },
          width: 640,
          height: 480
        });

        await cameraInstance.start();
        setTrackingMode("camera");
        setMediaPipeStatus("Activo");
      }
    } catch (e: any) {
      console.warn("Error de cámara/MediaPipe initialization:", e);
      setMediaPipeStatus("Sin Permiso. Modo Táctil.");
      setTrackingMode("manual");
    } finally {
      setIsMediaPipeLoading(false);
    }
  };

  // Handle switching back and forth
  const handleToggleTracking = () => {
    if (trackingMode === "manual") {
      loadMediaPipe();
    } else {
      // pause stream
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      setTrackingMode("manual");
      setHasCamera(false);
      setMediaPipeStatus("Desconectado");
      handPointersRef.current = [];
    }
  };

  // Main canvas animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
      }
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Color list for bubbles
    const bubbleColors = [
      "rgba(56, 189, 248, 0.75)",  // Sky blue
      "rgba(168, 85, 247, 0.75)",  // Purple
      "rgba(236, 72, 153, 0.75)",  // Pink
      "rgba(245, 158, 11, 0.75)",  // Amber
      "rgba(16, 185, 129, 0.75)",  // Emerald
      "rgba(239, 68, 68, 0.75)"    // Red
    ];

    const gameLoop = (timestamp: number) => {
      if (!isPlayingRef.current) {
        animId = requestAnimationFrame(gameLoop);
        return;
      }

      const w = canvas.width;
      const h = canvas.height;

      // Clear Canvas
      ctx.clearRect(0, 0, w, h);

      // 1. Spawning system
      const timeSinceLastSpawn = timestamp - lastSpawnTimeRef.current;
      const spawnInterval = w < 640 ? 1200 : 800; // spawn faster on larger screens
      if (timeSinceLastSpawn > spawnInterval && bubblesRef.current.length < 15) {
        const radius = Math.random() * 25 + 20; // Size 20-45px
        const x = Math.random() * (w - radius * 2) + radius;
        const speed = Math.random() * 2 + 1.5; // fall speed
        const color = bubbleColors[Math.floor(Math.random() * bubbleColors.length)];
        
        bubblesRef.current.push({
          id: Math.random().toString(),
          x,
          y: -radius,
          radius,
          speed,
          color,
          pointValue: 10
        });
        lastSpawnTimeRef.current = timestamp;
      }

      // 2. Map coordinates of cursors / hand pointers
      const activePointers: { x: number; y: number; isHand: boolean }[] = [];

      if (trackModeRef.current === "camera") {
        handPointersRef.current.forEach((pt) => {
          // coordinatept.x y are relative 0..1
          // Since we are mirroring, we do: pointerX = pt.x * w, Y = pt.y * h
          activePointers.push({
            x: pt.x * w,
            y: pt.y * h,
            isHand: true
          });
        });
      } else if (mousePointerRef.current.active) {
        activePointers.push({
          x: mousePointerRef.current.x,
          y: mousePointerRef.current.y,
          isHand: false
        });
      }

      // 3. Update & Collision detection
      const remainingBubbles: Bubble[] = [];
      const currentBubbles = bubblesRef.current;

      currentBubbles.forEach((bubble) => {
        // Move downwards
        bubble.y += bubble.speed;
        let isPopped = false;

        // Collision check
        for (let pointer of activePointers) {
          const dx = pointer.x - bubble.x;
          const dy = pointer.y - bubble.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // Pop condition: pointer contacts bubble boundary
          const contactDistance = pointer.isHand ? bubble.radius + 15 : bubble.radius;
          if (distance <= contactDistance) {
            isPopped = true;
            playPopSound();
            
            // Add score
            setScore((prev) => prev + bubble.pointValue);

            // Generate particle splash
            for (let i = 0; i < 18; i++) {
              const angle = Math.random() * Math.PI * 2;
              const speed = Math.random() * 5 + 2;
              particlesRef.current.push({
                x: bubble.x,
                y: bubble.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: Math.random() * 4 + 2,
                color: bubble.color,
                alpha: 1,
                life: 0,
                maxLife: Math.random() * 30 + 15
              });
            }
            break;
          }
        }

        // Keep bubble if it hasn't fallen off or exploded
        if (!isPopped && bubble.y - bubble.radius < h) {
          remainingBubbles.push(bubble);
        }
      });
      bubblesRef.current = remainingBubbles;

      // 4. Update the explosion particles
      const remainingParticles: Particle[] = [];
      particlesRef.current.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05; // gravity pull on sparks
        p.life++;
        p.alpha = 1 - p.life / p.maxLife;

        if (p.life < p.maxLife) {
          remainingParticles.push(p);

          // Draw particle
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha;
          ctx.fill();
        }
      });
      particlesRef.current = remainingParticles;
      ctx.globalAlpha = 1.0; // reset

      // 5. Draw active bubbles beautifully with glossy gradients
      bubblesRef.current.forEach((b) => {
        // Draw main glassy sphere
        const grad = ctx.createRadialGradient(
          b.x - b.radius * 0.3,
          b.y - b.radius * 0.3,
          b.radius * 0.1,
          b.x,
          b.y,
          b.radius
        );
        grad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
        grad.addColorStop(0.3, b.color);
        grad.addColorStop(1, "rgba(255, 255, 255, 0.1)");

        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.lineWidth = 1;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.stroke();

        // High gloss highlight
        ctx.beginPath();
        ctx.arc(b.x - b.radius * 0.35, b.y - b.radius * 0.35, b.radius * 0.18, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
        ctx.shadowBlur = 0; // reset blur
        ctx.fill();
      });

      // 6. Draw local cursor pointers or MediaPipe feedback indicators
      activePointers.forEach((pointer) => {
        // Outer pulsing ring
        ctx.beginPath();
        ctx.arc(pointer.x, pointer.y, pointer.isHand ? 22 : 12, 0, Math.PI * 2);
        ctx.strokeStyle = pointer.isHand ? "#a855f7" : "#0ea5e9";
        ctx.lineWidth = 2;
        ctx.shadowColor = pointer.isHand ? "#a855f7" : "#0ea5e9";
        ctx.shadowBlur = 8;
        ctx.stroke();

        // Inner solid dot
        ctx.beginPath();
        ctx.arc(pointer.x, pointer.y, pointer.isHand ? 8 : 4, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.shadowBlur = 0;
        ctx.fill();
      });

      animId = requestAnimationFrame(gameLoop);
    };

    animId = requestAnimationFrame(gameLoop);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animId);
    };
  }, [isMuted]);

  // Handle manual coordinate feeding (Mouse or Touch)
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (trackingMode === "camera") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    mousePointerRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      active: true
    };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (trackingMode === "camera") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (e.touches[0]) {
      const rect = canvas.getBoundingClientRect();
      mousePointerRef.current = {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
        active: true
      };
    }
  };

  const handlePointerLeave = () => {
    mousePointerRef.current.active = false;
  };

  const resetGame = () => {
    bubblesRef.current = [];
    particlesRef.current = [];
    setScore(0);
  };

  return (
    <div id="game_container_panel" className="relative flex flex-col md:flex-row h-full w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 text-slate-100 shadow-2xl">
      
      {/* 1. Left Control Panel: Configurations & HUD Info */}
      <div id="game_hud_sidebar" className="w-full md:w-80 p-5 flex flex-col justify-between bg-slate-900 border-r border-slate-800 shrink-0 z-10">
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-1 text-emerald-400 font-bold uppercase tracking-widest text-xs">
              <Sparkles className="w-4 h-4 animate-pulse" />
              <span>Cazador de Burbujas</span>
            </div>
            <h3 className="text-xl font-bold font-sans text-slate-50 tracking-tight">Interacción Gestual</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Superpone tu imagen real, colisiona con las burbujas cayendo usando tus manos y explótalas sin tocar nada físico.
            </p>
          </div>

          {/* Action button configurations */}
          <div className="space-y-3">
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
              <label className="text-xs font-semibold text-slate-400 block">Modo de Detección</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  id="btn_mode_manual"
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
                    trackingMode === "manual"
                      ? "bg-sky-500 text-white shadow-md shadow-sky-500/20"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                  onClick={() => {
                    if (trackingMode === "camera") handleToggleTracking();
                    setTrackingMode("manual");
                  }}
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  Mano/Mouse
                </button>
                <button
                  id="btn_mode_camera"
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
                    trackingMode === "camera"
                      ? "bg-purple-600 text-slate-50 shadow-md shadow-purple-600/20"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  } ${isMediaPipeLoading ? "opacity-70 cursor-not-allowed" : ""}`}
                  disabled={isMediaPipeLoading}
                  onClick={handleToggleTracking}
                >
                  <Camera className="w-3.5 h-3.5" />
                  {isMediaPipeLoading ? "Iniciando..." : "Cámara Web"}
                </button>
              </div>
              <div className="text-[10px] text-slate-500 mt-1 flex justify-between items-center">
                <span>Estado MediaPipe:</span>
                <span className={`font-semibold ${trackingMode === "camera" ? "text-purple-400" : "text-slate-400"}`}>
                  {mediaPipeStatus}
                </span>
              </div>
            </div>

            {/* Instruction block */}
            <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs">
              <span className="font-bold text-slate-300 mb-2 block">Cómo jugar:</span>
              {trackingMode === "camera" ? (
                <ul className="list-disc pl-4 space-y-1 text-slate-400">
                  <li>Colócate frente a la cámara web.</li>
                  <li>Usa tu <b className="text-purple-400">dedo índice</b> o tu <b className="text-purple-400">dedo medio</b> para apuntar.</li>
                  <li>Toca las esferas flotantes para explotarlas.</li>
                  <li>¡Mueve ambas manos para duplicar la diversión!</li>
                </ul>
              ) : (
                <ul className="list-disc pl-4 space-y-1 text-slate-400">
                  <li>Desliza tu dedo en la pantalla o mueve el cursor por el lienzo.</li>
                  <li>Tu puntero estalla las burbujas al tocarlas.</li>
                  <li>Usa el audio activado para disfrutar del efecto sonoro.</li>
                </ul>
              )}
            </div>
          </div>

          {/* Settings block */}
          <div className="space-y-2">
            <button
              id="btn_toggle_play_pause"
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4 text-amber-400" /> Pausar Juego
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 text-emerald-400" /> Reanudar Juego
                </>
              )}
            </button>

            <button
              id="btn_toggle_mute"
              onClick={() => setIsMuted(!isMuted)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition"
            >
              {isMuted ? (
                <>
                  <VolumeX className="w-4 h-4 text-red-400" /> Activar Sonido
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 text-emerald-400" /> Silenciar Sonido
                </>
              )}
            </button>
            
            <button
              id="btn_reset"
              onClick={resetGame}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition"
            >
              <RefreshCw className="w-4 h-4 text-sky-400" /> Reiniciar Puntos
            </button>
          </div>
        </div>

        {/* Global branding details */}
        <div className="pt-4 border-t border-slate-800 text-center">
          <div className="text-[10px] text-slate-500 font-mono tracking-tight">
            CAM_UTILS & HANDS ENGINE v2.0
          </div>
        </div>
      </div>

      {/* 2. Main Game Canvas Arena & Overlay Video */}
      <div id="game_stage_arena" className="relative flex-1 h-full min-h-[400px] bg-slate-950 overflow-hidden select-none cursor-crosshair">
        
        {/* Mirror webcam feed underneath the drawing canvas */}
        {trackingMode === "camera" && hasCamera && (
          <video
            ref={videoRef}
            id="webcam_stream_view"
            className="absolute inset-0 w-full h-full object-cover opacity-30 transform scale-x-[-1] pointer-events-none"
            autoPlay
            playsInline
            muted
          />
        )}

        {/* Interactive Drawing Stage */}
        <canvas
          ref={canvasRef}
          id="bubble_drawing_canvas"
          className="absolute inset-0 w-full h-full z-10 transform scale-x-[-1]"
          onMouseMove={handleMouseMove}
          onTouchMove={handleTouchMove}
          onMouseLeave={handlePointerLeave}
        />

        {/* Score Card Dashboard Indicator overlay */}
        <div id="game_hud_stats" className="absolute top-5 right-5 z-20 flex bg-slate-900/90 backdrop-blur-md border border-slate-700/60 rounded-xl px-5 py-3 shadow-xl items-center gap-4">
          <div className="bg-sky-500/10 p-2 rounded-lg border border-sky-500/20">
            <Zap className="w-5 h-5 text-sky-400 fill-sky-400/20" />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Puntuación</div>
            <div className="text-2xl font-bold font-mono text-slate-100 tracking-tight">
              {score} <span className="text-xs text-slate-400">pts</span>
            </div>
          </div>
        </div>

        {/* Muted Indicator overlay */}
        {isMuted && (
          <div className="absolute top-5 left-5 z-20 flex bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-3 py-1.5 text-xs font-semibold items-center gap-1.5 backdrop-blur-md">
            <VolumeX className="w-3.5 h-3.5 animate-pulse" />
            <span>Audio Silenciado</span>
          </div>
        )}

        {/* Fallback Simulator banner helper */}
        {trackingMode === "manual" && (
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-full px-4 py-1.5 text-xs font-semibold items-center gap-2 backdrop-blur-md">
            <div className="w-2 h-2 rounded-full bg-sky-400 animate-ping"></div>
            <span>Simulador Activo: Arrastra tu puntero para explotar burbujas</span>
          </div>
        )}
      </div>

    </div>
  );
}

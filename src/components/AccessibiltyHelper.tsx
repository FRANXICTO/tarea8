import React, { useState, useEffect, useRef } from "react";
import { SpeechHistoryItem } from "../types";
import { Camera, RefreshCw, Volume2, ShieldAlert, Sparkles, AlertCircle, Play, Square, Smartphone, ArrowRight, Eye, WifiOff } from "lucide-react";

export default function AccessibiltyHelper() {
  const [activeMode, setActiveMode] = useState<"objects" | "text">("objects");
  const [streamActive, setStreamActive] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [detectedResult, setDetectedResult] = useState<string>("Toca dos veces o mantén presionado la pantalla para escanear tu entorno.");
  const [history, setHistory] = useState<SpeechHistoryItem[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Touch coordinates for gestures
  const touchStartRef = useRef<{ x: number; y: number; time: number }>({ x: 0, y: 0, time: 0 });

  // Native TTS Reader Utility
  const speakText = (text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel(); // stop previous speech immediately
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-ES";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  // Announce current state transitions vocally
  useEffect(() => {
    const speechMap = {
      objects: "Activo: Modo detección de objetos. Mantén presionado para capturar lo que tienes enfrente.",
      text: "Activo: Modo lectura offline. Mantén presionado para leer textos continuos."
    };
    speakText(speechMap[activeMode]);
  }, [activeMode]);

  // Handle active camera streaming
  useEffect(() => {
    if (streamActive) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [streamActive]);

  const startCamera = async () => {
    try {
      if (mediaStreamRef.current) {
        stopCamera();
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" } // prefer back camera
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (e) {
      console.warn("Fallo al iniciar cámara de accesibilidad:", e);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Grab camera frame and send to Express backend
  const triggerImageScan = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    speakText("Procesando fotograma con visión local...");

    let base64Image = "";

    // If camera is working, extract snapshot to canvas
    if (mediaStreamRef.current && videoRef.current) {
      try {
        const video = videoRef.current;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          base64Image = canvas.toDataURL("image/jpeg", 0.85);
        }
      } catch (err) {
        console.error("Fallo de captura de fotograma:", err);
      }
    }

    try {
      const response = await fetch("/api/ai/accessibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64Image || "dummy_base64", // fallback to simulator if camera blocked
          mode: activeMode
        })
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      setDetectedResult(data.text);
      speakText(data.text);

      // Add to session history
      const logItem: SpeechHistoryItem = {
        id: Math.random().toString(),
        timestamp: new Date().toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' }),
        mode: activeMode,
        detectedText: data.text
      };
      setHistory((prev) => [logItem, ...prev.slice(0, 4)]);

    } catch (error: any) {
      console.error("Error capturing AI metadata:", error);
      const errWord = "Error de conexión temporal. Intente de nuevo.";
      setDetectedResult(errWord);
      speakText(errWord);
    } finally {
      setIsProcessing(false);
    }
  };

  // Implement Accessibilty Swipe Gesture callbacks
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches[0]) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now()
      };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!e.changedTouches[0]) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.time;

    // Check long press (greater than 500ms and minimal movement)
    if (dt > 450 && Math.abs(dx) < 15 && Math.abs(dy) < 15) {
      e.preventDefault();
      triggerImageScan();
      return;
    }

    // Swipe gesture check (minimum swipe size of 70px)
    if (Math.abs(dx) > 75 && Math.abs(dy) < 60) {
      if (dx > 0) {
        // Swipe Right
        setActiveMode("objects");
      } else {
        // Swipe Left
        setActiveMode("text");
      }
    }
  };

  // Toggle modes manually
  const switchMode = (mode: "objects" | "text") => {
    setActiveMode(mode);
  };

  return (
    <div className="flex flex-col xl:flex-row h-full w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 text-slate-100 shadow-2xl">
      
      {/* Sidebar explanation panel */}
      <div className="w-full xl:w-90 p-5 bg-slate-900 border-b xl:border-b-0 xl:border-r border-slate-800 flex flex-col justify-between shrink-0">
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-1 text-purple-400 font-bold uppercase tracking-widest text-xs">
              <Eye className="w-4 h-4 animate-pulse" />
              <span>Ojo Artificial Local</span>
            </div>
            <h3 className="text-xl font-bold font-sans text-slate-50 tracking-tight">Accesibilidad Móvil</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Solución inteligente sin conexión en la nube para asistir a personas invidentes o con baja visión. Identifica el contexto espacial o lee documentos de inmediato utilizando síntesis artificial de voz.
            </p>
          </div>

          {/* Interactive controls */}
          <div className="space-y-4">
            
            {/* Gesture list card */}
            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-2">
              <span className="font-bold text-slate-300 block">Gestos de Accesibilidad (Simulador):</span>
              <div className="space-y-1.5 text-slate-400">
                <div className="flex justify-between border-b border-slate-900 pb-1">
                  <span>↔️ Deslizar Izq / Der:</span>
                  <span className="text-purple-400 font-semibold">Cambiar Modo</span>
                </div>
                <div className="flex justify-between border-b border-slate-900 pb-1">
                  <span>⏱️ Mantener Presionado:</span>
                  <span className="text-purple-400 font-semibold">Capturar / Escanear</span>
                </div>
                <div className="flex justify-between">
                  <span>📱 Clic de Standby:</span>
                  <span className="text-purple-400 font-semibold">Ahorro de Batería</span>
                </div>
              </div>
            </div>

            {/* Energy saver block */}
            <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">Ahorro de Batería (RNF-03)</h4>
                  <span className="text-[10px] text-slate-500">Pausa la cámara si no hay uso</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${streamActive ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                  {streamActive ? "CÁM_ACTIVA" : "STANDBY"}
                </span>
              </div>
              <button
                id="btn_toggle_standby"
                onClick={() => setStreamActive(!streamActive)}
                className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 border transition ${
                  streamActive 
                    ? "bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200" 
                    : "bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white"
                }`}
              >
                {streamActive ? (
                  <>
                    <Square className="w-3.5 h-3.5 text-amber-400" /> Detener Proceso (Standby)
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 text-slate-100" /> Reactivar Ojo Artificial
                  </>
                )}
              </button>
            </div>

            {/* Offline execution reminder card */}
            <div className="p-3 bg-indigo-950/50 border border-indigo-500/20 rounded-xl flex gap-3 text-xs">
              <WifiOff className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-indigo-200 block">Modo Avión Soportado</span>
                <span className="text-slate-400 text-[11px] leading-snug">
                  La app opera de forma completamente autónoma sobre la marcha, con un peso menor a 15MB.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* History of verbalizations */}
        <div className="mt-6 pt-4 border-t border-slate-800">
          <span className="text-xs font-bold text-slate-400 mb-2.5 block">Historial de Lectura:</span>
          {history.length === 0 ? (
            <p className="text-[11px] text-slate-600 font-mono">No hay interacciones registradas aún.</p>
          ) : (
            <div className="space-y-2">
              {history.map((item) => (
                <div key={item.id} className="p-2 bg-slate-950/60 border border-slate-800/80 rounded-lg text-[10px] space-y-1">
                  <div className="flex justify-between text-slate-500 font-mono">
                    <span className="uppercase font-bold text-purple-400">{item.mode === "objects" ? "Entorno" : "Texto"}</span>
                    <span>{item.timestamp}</span>
                  </div>
                  <p className="text-slate-300 italic truncate">"{item.detectedText}"</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Smartphone simulator layout stage */}
      <div className="flex-1 p-6 flex items-center justify-center bg-slate-950 relative overflow-hidden min-h-[500px]">
        
        {/* Glow behind device */}
        <div className="absolute w-72 h-71 rounded-full bg-purple-500/10 blur-3xl pointer-events-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></div>

        {/* Smartphone Wrapper Outer Chassis */}
        <div className="relative w-full max-w-[320px] aspect-[9/18] rounded-[40px] bg-slate-900 border-8 border-slate-800 shadow-2xl flex flex-col overflow-hidden select-none">
          
          {/* Top Notch Camera */}
          <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-28 h-4 rounded-full bg-slate-900 z-50 flex items-center justify-center gap-2 border border-slate-800">
            <div className="w-1.5 h-1.5 rounded-full bg-[#1e293b]"></div>
            <div className="w-12 h-1 rounded-full bg-[#1e293b]"></div>
          </div>

          {/* Screen Content */}
          <div 
            ref={containerRef}
            id="mobile_touch_pad_gesture"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onMouseDown={(e) => {
              // Simulate long press on click
              touchStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
            }}
            onMouseUp={(e) => {
              const dt = Date.now() - touchStartRef.current.time;
              if (dt > 350) {
                triggerImageScan();
              }
            }}
            className="flex-1 flex flex-col relative bg-slate-950"
          >
            {/* Real Web Camera Stream inside phone mock */}
            {streamActive ? (
              <div className="absolute inset-0 w-full h-full">
                <video
                  ref={videoRef}
                  id="mobile_camera_preview"
                  className="w-full h-full object-cover opacity-70"
                  autoPlay
                  playsInline
                  muted
                />
              </div>
            ) : (
              <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-slate-950/95 text-center p-4">
                <AlertCircle className="w-8 h-8 text-amber-500 mb-2 animate-bounce" />
                <span className="text-xs font-bold text-slate-300">Modo de Ahorro Activo</span>
                <span className="text-[10px] text-slate-500 mt-1 leading-snug">Flujo de video en pausa para reducir RAM a menos de 250MB.</span>
              </div>
            )}

            {/* Smart Frame Header Overlay */}
            <div className="relative z-20 flex justify-between items-center px-5 pt-8 pb-3 bg-gradient-to-b from-slate-950 via-slate-950/70 to-transparent text-[10px] font-mono font-bold text-slate-300">
              <span className="tracking-tighter">19:19 PM</span>
              <div className="flex gap-2.5 items-center">
                <span>98%</span>
                <div className="w-5 h-2.5 border border-slate-400 rounded-sm p-0.5 flex">
                  <div className="bg-emerald-400 h-full w-[90%]"></div>
                </div>
              </div>
            </div>

            {/* Active Assisted Model Flag badge overlay */}
            <div className="absolute top-16 left-4 z-20 flex bg-purple-600 text-purple-50 rounded-full px-3 py-1 font-bold text-[9px] uppercase tracking-wider items-center gap-1.5 shadow-md">
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></div>
              <span>{activeMode === "objects" ? "Entorno Local" : "OCR Offline"}</span>
            </div>

            {/* Instructions Floating Banner inside handset */}
            <div className="absolute top-24 left-4 right-4 z-20 bg-slate-900/90 border border-slate-700/50 rounded-xl p-3 backdrop-blur-md shadow-lg">
              <div className="text-[11px] font-semibold text-slate-200">
                {activeMode === "objects" ? (
                  <span>🕵️ ¿Qué tengo enfrente?</span>
                ) : (
                  <span>📄 Escáner de Letras</span>
                )}
              </div>
              <div className="text-[10px] text-slate-400 mt-1 leading-snug">
                Mantén presionado el centro de la pantalla 1 segundo para procesar.
              </div>
            </div>

            {/* Result verbal feedback panel at bottom */}
            <div className="mt-auto relative z-20 p-4 bg-gradient-to-t from-slate-950 via-slate-950/95 to-slate-950/40 border-t border-slate-800/80">
              <div className="space-y-2">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block">Lectura por Voz:</span>
                
                <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl min-h-[80px] flex flex-col justify-between">
                  <p className="text-[11px] text-slate-200 leading-relaxed font-sans font-medium italic">
                    {isProcessing ? "Escuchando silenciosamente el destello..." : `"${detectedResult}"`}
                  </p>
                  
                  {isProcessing && (
                    <div className="flex gap-1 items-center mt-2">
                      <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce"></div>
                    </div>
                  )}

                  {!isProcessing && detectedResult && (
                    <button
                      onClick={() => speakText(detectedResult)}
                      className="self-end p-1.5 rounded-md bg-purple-950/50 hover:bg-purple-950 border border-purple-500/30 text-purple-400 hover:text-purple-300 transition-colors mt-2"
                      title="Repetir audio"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Simulated Swipe Controls fallback for visual users */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    onClick={() => switchMode("objects")}
                    className={`py-1.5 text-[9px] font-bold rounded-lg uppercase tracking-wider transition ${
                      activeMode === "objects" 
                        ? "bg-purple-600 text-white" 
                        : "bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800"
                    }`}
                  >
                    Objetos
                  </button>
                  <button
                    onClick={() => switchMode("text")}
                    className={`py-1.5 text-[9px] font-bold rounded-lg uppercase tracking-wider transition ${
                      activeMode === "text" 
                        ? "bg-purple-600 text-white" 
                        : "bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800"
                    }`}
                  >
                    Texto/OCR
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

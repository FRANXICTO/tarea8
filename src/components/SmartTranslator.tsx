import React, { useState, useEffect, useRef } from "react";
import { TranslationHistoryItem } from "../types";
import { Mic, MicOff, Volume2, Search, ArrowLeftRight, Trash2, Globe, Sparkles, Check, Copy, WifiOff, RefreshCw } from "lucide-react";

export default function SmartTranslator() {
  const [sourceText, setSourceText] = useState<string>("");
  const [translatedResult, setTranslatedResult] = useState<string>("");
  const [sourceLanguage, setSourceLanguage] = useState<string>("es");
  const [targetLanguage, setTargetLanguage] = useState<string>("en");
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<boolean>(false);
  const [history, setHistory] = useState<TranslationHistoryItem[]>([]);

  const recognitionRef = useRef<any>(null);

  // Supported languages list
  const languageOptions = [
    { code: "es", name: "Español", flag: "🇪🇸", langCode: "es-ES" },
    { code: "en", name: "Inglés", flag: "🇺🇸", langCode: "en-US" },
    { code: "pt", name: "Portugués", flag: "🇧🇷", langCode: "pt-BR" },
    { code: "fr", name: "Francés", flag: "🇫🇷", langCode: "fr-FR" },
    { code: "de", name: "Alemán", flag: "🇩🇪", langCode: "de-DE" },
    { code: "it", name: "Italiano", flag: "🇮🇹", langCode: "it-IT" }
  ];

  // Load history on load
  useEffect(() => {
    const saved = localStorage.getItem("translator_history_cards");
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Web Speech API Microphone Dictation Setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsRecording(true);
        setRecordingError(null);
      };

      recognition.onerror = (event: any) => {
        console.error("Mic error:", event);
        if (event.error === "not-allowed") {
          setRecordingError("Sin permiso de micrófono en este iframe.");
        } else {
          setRecordingError(`Error: ${event.error}`);
        }
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.onresult = (event: any) => {
        const resultText = event.results[0][0].transcript;
        if (resultText) {
          setSourceText((prev) => prev ? `${prev} ${resultText}` : resultText);
        }
      };

      recognitionRef.current = recognition;
    }
  }, [sourceLanguage]);

  // Handle Recording Trigger
  const handleToggleRecord = () => {
    if (!recognitionRef.current) {
      setRecordingError("API de dictado por voz no compatible en este navegador.");
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      // Find language locale code
      const currentOpt = languageOptions.find(o => o.code === sourceLanguage);
      recognitionRef.current.lang = currentOpt ? currentOpt.langCode : "es-ES";
      
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.warn("Speech recognition already running or errored", e);
      }
    }
  };

  // Run contextual Translation with server proxy to Gemini 3.5 Flash
  const processTranslation = async (customText?: string) => {
    const textToTranslate = customText || sourceText;
    if (!textToTranslate.trim()) return;

    setIsTranslating(true);
    try {
      const response = await fetch("/api/ai/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textToTranslate,
          sourceLang: languageOptions.find(l => l.code === sourceLanguage)?.name || "Auto",
          targetLang: languageOptions.find(l => l.code === targetLanguage)?.name || "Inglés"
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setTranslatedResult(data.translation);

      // Save to localStorage history limit to last 5
      const newItem: TranslationHistoryItem = {
        id: Math.random().toString(),
        sourceText: textToTranslate,
        translatedText: data.translation,
        sourceLang: sourceLanguage,
        targetLang: targetLanguage,
        timestamp: new Date().toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' })
      };

      setHistory((prev) => {
        const next = [newItem, ...prev.filter(x => x.sourceText !== textToTranslate)].slice(0, 5);
        localStorage.setItem("translator_history_cards", JSON.stringify(next));
        return next;
      });

    } catch (err: any) {
      console.error(err);
      setTranslatedResult(`[Fallo en traducción]: ${err.message}`);
    } finally {
      setIsTranslating(false);
    }
  };

  // Play vocal synthesized audio of translated output
  const handleListenTranslation = () => {
    if (!translatedResult || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(translatedResult);
    
    // Attempt to map target language voice correctly
    const targetOpt = languageOptions.find(o => o.code === targetLanguage);
    utterance.lang = targetOpt ? targetOpt.langCode : "en-US";
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  const handleCopyText = () => {
    if (!translatedResult) return;
    navigator.clipboard.writeText(translatedResult);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  // Intervert language codes
  const handleSwapLanguages = () => {
    const temp = sourceLanguage;
    setSourceLanguage(targetLanguage);
    setTargetLanguage(temp);
    
    const tempText = sourceText;
    setSourceText(translatedResult);
    setTranslatedResult(tempText);
  };

  const handleSelectHistoryItem = (item: TranslationHistoryItem) => {
    setSourceLanguage(item.sourceLang);
    setTargetLanguage(item.targetLang);
    setSourceText(item.sourceText);
    setTranslatedResult(item.translatedText);
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem("translator_history_cards");
  };

  return (
    <div className="flex flex-col xl:flex-row h-full w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 text-slate-100 shadow-2xl">
      
      {/* Parameters panel */}
      <div className="w-full xl:w-90 p-5 bg-slate-900 border-b xl:border-b-0 xl:border-r border-slate-800 flex flex-col justify-between shrink-0 overflow-y-auto">
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-1 text-sky-400 font-bold uppercase tracking-widest text-xs">
              <Globe className="w-4 h-4 animate-pulse" />
              <span>PWA Traductor Inteligente</span>
            </div>
            <h3 className="text-xl font-bold font-sans text-slate-50 tracking-tight">Traducción Contextual</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Traductor inteligente instantáneo optimizado en tamaño PWA. Dicta por voz, asiste con síntesis de audio integrada y lee sin redundancia de significado literal.
            </p>
          </div>

          <div className="space-y-3.5">
            {/* Lang Dropdowns Selection Container */}
            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <span className="text-xs font-semibold text-slate-400 block">Dirección de Lenguaje</span>
              <div className="flex items-center gap-2">
                <select
                  value={sourceLanguage}
                  onChange={(e) => setSourceLanguage(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-semibold text-slate-100 focus:outline-none"
                >
                  {languageOptions.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.flag} {opt.name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={handleSwapLanguages}
                  className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all shrink-0"
                  title="Intercambiar idiomas"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                </button>

                <select
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-semibold text-slate-100 focus:outline-none"
                >
                  {languageOptions.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.flag} {opt.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Offline PWA indicator cards */}
            <div className="p-3 bg-sky-950/40 border border-sky-500/10 rounded-xl space-y-2 text-xs">
              <span className="font-bold text-sky-300 block">Habilitado para PWA Offline:</span>
              <ul className="text-slate-400 text-[11px] list-disc pl-4 space-y-1 leading-snug">
                <li>Instalable en pantallas de inicio móvil.</li>
                <li>Mantiene caché ligera e instantánea.</li>
                <li>Últimas 5 traducciones guardadas en dispositivo.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Translation historic card index */}
        <div className="mt-6 pt-4 border-t border-slate-800">
          <div className="flex justify-between items-center mb-2.5">
            <span className="text-xs font-bold text-slate-400">Historial de Guardados:</span>
            {history.length > 0 && (
              <button onClick={handleClearHistory} className="text-[10px] text-red-400 hover:underline">
                Limpiar
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <p className="text-[10px] text-slate-600 font-mono">No hay traducciones registradas en caché local.</p>
          ) : (
            <div className="space-y-1.5">
              {history.map((card) => (
                <button
                  key={card.id}
                  onClick={() => handleSelectHistoryItem(card)}
                  className="w-full text-left p-2.5 bg-slate-950/60 hover:bg-slate-950 border border-slate-800 rounded-lg text-xs hover:border-sky-500/30 transition shadow-sm space-y-1"
                >
                  <div className="flex justify-between text-[9px] text-slate-500 font-bold uppercase">
                    <span>
                      {card.sourceLang} ➔ {card.targetLang}
                    </span>
                    <span>{card.timestamp}</span>
                  </div>
                  <p className="text-slate-200 truncate italic">"{card.sourceText}"</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Card design stage area */}
      <div className="flex-1 p-6 flex flex-col items-center justify-center bg-slate-950 relative overflow-hidden min-h-[480px]">
        
        {/* Glow ambient circle */}
        <div className="absolute w-72 h-72 rounded-full bg-sky-500/5 blur-3xl pointer-events-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></div>

        {/* Card-based Mobile Translate Frame */}
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-xl flex flex-col divide-y divide-slate-800 overflow-hidden z-20">
          
          {/* Header */}
          <div className="px-4 py-3 flex justify-between items-center bg-slate-950/40">
            <div className="flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-bold text-slate-300 font-sans">Traducción de Voz</span>
            </div>
            
            {/* Network / Offline State mock with light indicator */}
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span>PWA INSTALABLE</span>
            </div>
          </div>

          {/* Top text input panel: Original input */}
          <div className="p-4 bg-slate-900/40 space-y-3 relative">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                Idioma de Origen (
                {languageOptions.find((l) => l.code === sourceLanguage)?.name}
                )
              </span>
              {sourceText && (
                <button
                  onClick={() => setSourceText("")}
                  className="text-[10px] text-red-400 hover:underline"
                >
                  Borrar
                </button>
              )}
            </div>

            <textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              className="w-full h-24 bg-transparent text-xs text-slate-100 placeholder-slate-600 focus:outline-none resize-none leading-relaxed"
              placeholder="Escribe o presiona el micrófono para dictar la frase o palabra que quieras traducir..."
            />

            {/* Micro and speak triggers row */}
            <div className="flex justify-between items-center pt-2">
              <div className="flex gap-2">
                <button
                  onClick={handleToggleRecord}
                  className={`p-2.5 rounded-full flex items-center justify-center transition-all ${
                    isRecording 
                      ? "bg-red-600 text-white animate-pulse" 
                      : "bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300"
                  }`}
                  title="Grabar por Voz"
                >
                  {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                {recordingError && (
                  <span className="text-[10px] text-amber-500 flex items-center max-w-[200px] truncate leading-tight">
                    {recordingError}
                  </span>
                )}
              </div>

              <button
                onClick={() => processTranslation()}
                disabled={isTranslating}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow transition active:scale-95 disabled:opacity-50"
              >
                {isTranslating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Traduciendo...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" /> Traducir
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Bottom text output panel: Translated text */}
          <div className="p-4 bg-slate-950/60 space-y-3">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
              Resultado (
              {languageOptions.find((l) => l.code === targetLanguage)?.name}
              )
            </span>

            <div className="min-h-24 py-1 text-xs text-slate-200 leading-relaxed italic">
              {translatedResult ? (
                translatedResult
              ) : (
                <span className="text-slate-700 not-italic">El resultado de la traducción aparecerá en esta caja de manera instantánea.</span>
              )}
            </div>

            {/* Vocal listen and share tools */}
            {translatedResult && (
              <div className="flex justify-end items-center gap-2 pt-2 border-t border-slate-900">
                <button
                  onClick={handleCopyText}
                  className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all text-[11px] flex items-center gap-1"
                >
                  {copyFeedback ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" /> Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copiar
                    </>
                  )}
                </button>

                <button
                  onClick={handleListenTranslation}
                  className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all text-[11px] flex items-center gap-1"
                  title="Escuchar resultado"
                >
                  <Volume2 className="w-3.5 h-3.5" /> Escuchar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Gamepad2, 
  Eye, 
  Binary, 
  Languages, 
  Cpu, 
  Sparkles, 
  ChevronRight, 
  Layers, 
  HeartHandshake, 
  Activity, 
  Lightbulb, 
  ExternalLink 
} from "lucide-react";

import BubblePopper from "./components/BubblePopper";
import AccessibiltyHelper from "./components/AccessibiltyHelper";
import MathTreeOCR from "./components/MathTreeOCR";
import SmartTranslator from "./components/SmartTranslator";

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("home");
  const [checkKeyStatus, setCheckKeyStatus] = useState<{ active: boolean; loading: boolean }>({ active: false, loading: true });

  // Poll server-side credentials
  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => {
        setCheckKeyStatus({
          active: data.geminiKeyConfigured,
          loading: false
        });
      })
      .catch(() => {
        setCheckKeyStatus({ active: false, loading: false });
      });
  }, []);

  const tabs = [
    {
      id: "bubbles",
      label: "Cazador de Burbujas",
      desc: "Interacción Gestual",
      icon: Gamepad2,
      color: "from-purple-500 to-indigo-500",
      accent: "text-purple-400"
    },
    {
      id: "accessibility",
      label: "Asistente Visual",
      desc: "Accesibilidad Inteligente",
      icon: Eye,
      color: "from-emerald-500 to-teal-500",
      accent: "text-emerald-400"
    },
    {
      id: "mathtree",
      label: "MathTree OCR",
      desc: "Árbol de Expresiones",
      icon: Binary,
      color: "from-amber-500 to-orange-500",
      accent: "text-amber-400"
    },
    {
      id: "translator",
      label: "Traductor Inteligente",
      desc: "PWA de Voz",
      icon: Languages,
      color: "from-sky-500 to-blue-500",
      accent: "text-sky-400"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-purple-500/30 selection:text-white">
      
      {/* 1. Header Navigation System */}
      <header id="main_navigation_header" className="relative border-b border-slate-900 bg-slate-950/80 backdrop-blur-md z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-sky-400 flex items-center justify-center shadow-lg shadow-purple-500/10">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-950 animate-pulse"></div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-tight font-sans text-slate-100 uppercase">VisioMente</span>
              <span className="bg-purple-950 text-purple-400 border border-purple-500/20 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold tracking-widest">
                LAB v1.0
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">Suite Computacional de Visión e IA Corporal</p>
          </div>
        </div>

        {/* Real-time tabs selector */}
        <nav className="hidden lg:flex items-center gap-1 bg-slate-900/40 p-1 border border-slate-900 rounded-xl">
          <button
            id="nav_tab_home"
            onClick={() => setActiveTab("home")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === "home" 
                ? "bg-slate-800 text-slate-100" 
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Inicio
          </button>
          {tabs.map((tab) => {
            const IconComp = tab.icon;
            return (
              <button
                key={tab.id}
                id={`nav_tab_${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
                  activeTab === tab.id
                    ? "bg-gradient-to-r from-slate-800 to-slate-900 text-slate-100 border border-slate-700/30 shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <IconComp className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Global Connection / API keys State status badge */}
        <div className="flex items-center gap-2">
          {!checkKeyStatus.loading && (
            <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold ${
              checkKeyStatus.active 
                ? "bg-emerald-950/50 border border-emerald-500/20 text-emerald-400" 
                : "bg-amber-950/50 border border-amber-500/20 text-amber-500"
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${checkKeyStatus.active ? "bg-emerald-400" : "bg-amber-500"} animate-pulse`}></div>
              <span>{checkKeyStatus.active ? "CONECTADO A GEMINI 3.5" : "FALLBACK AUTOMÁTICO ACTIVO"}</span>
            </div>
          )}
        </div>
      </header>

      {/* Mobile selector header strip */}
      <div className="lg:hidden flex overflow-x-auto gap-1 bg-slate-900 p-2 border-b border-slate-800/80 scrollbar-none z-30">
        <button
          onClick={() => setActiveTab("home")}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition ${
            activeTab === "home" ? "bg-slate-800 text-white" : "text-slate-400"
          }`}
        >
          Inicio
        </button>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition flex items-center gap-1.5 ${
              activeTab === tab.id ? "bg-gradient-to-r from-slate-800 to-slate-900 text-slate-100" : "text-slate-400"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* 2. Main Content viewport wrapper */}
      <main className="flex-1 overflow-y-auto px-6 py-6 max-w-7xl w-full mx-auto flex flex-col justify-between">
        
        <AnimatePresence mode="wait">
          {activeTab === "home" ? (
            
            // INTRO HOME VIEW - SENSORY SUITE INTRODUCTION
            <motion.div
              key="landing_gate"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-12"
            >
              {/* Feature Hero Intro Showcase */}
              <div className="text-center max-w-2xl mx-auto space-y-4 pt-4">
                <div className="inline-flex items-center gap-2 bg-purple-950/50 border border-purple-500/20 text-purple-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider animate-pulse">
                  <Sparkles className="w-4 h-4" />
                  <span>Laboratorio de Interacción Digital</span>
                </div>
                <h1 className="text-4xl sm:text-5xl font-black tracking-tight font-sans text-slate-50 leading-tight">
                  Interactúa con el Futuro sin <b className="bg-gradient-to-r from-purple-400 via-pink-400 to-sky-400 bg-clip-text text-transparent">Pantallas Físicas</b>
                </h1>
                <p className="text-sm sm:text-base text-slate-400 leading-relaxed font-sans">
                  Prueba las cuatro tecnologías diseñadas para revolucionar sanidad, accesibilidad escolar, pedagogía y traducción de voz en tiempo real con modelos locales.
                </p>
              </div>

              {/* Bento Grid Presentation of the Four Apps */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                
                {tabs.map((tab) => {
                  const IconComponent = tab.icon;
                  return (
                    <motion.div
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      whileHover={{ scale: 1.015, borderColor: "rgba(168, 85, 247, 0.4)" }}
                      className="p-6 rounded-2xl bg-slate-900 border border-slate-800/80 flex flex-col justify-between hover:border-slate-700 transition-all cursor-pointer shadow-lg hover:shadow-purple-500/[0.02]"
                    >
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <div className={`p-3.5 rounded-xl bg-gradient-to-br ${tab.color} text-slate-950`}>
                            <IconComponent className="w-5 h-5 text-slate-950 fill-slate-950/10" />
                          </div>
                          <span className="text-[10px] uppercase font-mono tracking-widest text-slate-500 font-bold">
                            Módulo {tab.id === "bubbles" ? "01" : tab.id === "accessibility" ? "02" : tab.id === "mathtree" ? "03" : "04"}
                          </span>
                        </div>

                        <div>
                          <h4 className="text-lg font-bold text-slate-100 font-sans tracking-tight">{tab.label}</h4>
                          <span className="text-xs font-semibold text-purple-400 block mt-0.5">{tab.desc}</span>
                          
                          <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">
                            {tab.id === "bubbles" && "Mueve tus manos físicas para romper burbujas que caen de forma continua en pantalla. Configurado para salas de espera limpia en hospitales infantiles."}
                            {tab.id === "accessibility" && "Convertidor ocular para invidentes. Utiliza OCR offline y reconocimiento de objetos con síntesis auditiva controlable por gestos y toques."}
                            {tab.id === "mathtree" && "Captura fórmulas matemáticas. El sistema traduce las ecuaciones en un árbol sintáctico animado paso a paso con haptic triggers."}
                            {tab.id === "translator" && "Traductor contextual instalado en formato PWA. Captura voz, dicta con Speech API y simula el modo avión sin dependencia del backend."}
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-500">Haz clic para ejecutar el interactivo</span>
                        <div className="flex items-center gap-1 text-purple-400 group-hover:text-purple-300">
                          <span>Probar Módulo</span>
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

              </div>

              {/* General Tech highlights dashboard summary */}
              <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-950/20 via-slate-900 to-indigo-950/20 border border-slate-800/80">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center md:text-left divide-y md:divide-y-0 md:divide-x divide-slate-800">
                  <div className="space-y-1.5 md:pr-4">
                    <div className="flex items-center gap-2 justify-center md:justify-start">
                      <HeartHandshake className="w-5 h-5 text-purple-400" />
                      <h5 className="text-xs font-bold uppercase text-slate-300 tracking-wider">Alineado a Higiene</h5>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      El juego gestual touchless estimula la motricidad fina de los infantes sin dejar virus en pantallas interactivas públicas tradicionales.
                    </p>
                  </div>

                  <div className="space-y-1.5 md:px-6 pt-4 md:pt-0">
                    <div className="flex items-center gap-2 justify-center md:justify-start">
                      <Activity className="w-5 h-5 text-emerald-400" />
                      <h5 className="text-xs font-bold uppercase text-slate-300 tracking-wider">Reducción de Latencia</h5>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      La simulación de IA local en accesibilidad mantiene consumos inferiores a 250MB de RAM y velocidades sobre los 15-20 fotogramas por segundo.
                    </p>
                  </div>

                  <div className="space-y-1.5 md:pl-6 pt-4 md:pt-0">
                    <div className="flex items-center gap-2 justify-center md:justify-start">
                      <Lightbulb className="w-5 h-5 text-amber-500" />
                      <h5 className="text-xs font-bold uppercase text-slate-300 tracking-wider">Árbol Sintáctico Binario</h5>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      La resolución animada de fórmulas convierte complejas recursividades matemáticas en bloques visuales simplificados de forma secuencial.
                    </p>
                  </div>
                </div>
              </div>

            </motion.div>
          ) : (
            
            // MODULE WORKSPACE VIEWPORT
            <motion.div
              key="workspace_viewport"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="w-full flex-1 flex flex-col justify-between"
            >
              {/* Back Tab Header Info bar */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setActiveTab("home")}
                  className="text-xs font-bold text-slate-400 hover:text-white transition flex items-center gap-1.5"
                >
                  &larr; Volver a la Selección de Apps
                </button>
                <div className="text-xs text-slate-500 font-mono">
                  {activeTab === "bubbles" && "INTERACTIVO: CAZADOR_BURBUJAS_v2.0"}
                  {activeTab === "accessibility" && "INTERACTIVO: ASISTENTE_ACCESIBILIDAD_v1.0"}
                  {activeTab === "mathtree" && "INTERACTIVO: MATHTREE_RESOLVER_v1.0"}
                  {activeTab === "translator" && "INTERACTIVO: TRADUCTOR_PWA_v1.5"}
                </div>
              </div>

              {/* Dynamic View Injection */}
              <div id="dynamic_interactive_view" className="flex-1 min-h-[500px]">
                {activeTab === "bubbles" && <BubblePopper />}
                {activeTab === "accessibility" && <AccessibiltyHelper />}
                {activeTab === "mathtree" && <MathTreeOCR />}
                {activeTab === "translator" && <SmartTranslator />}
              </div>

            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* 3. Global Footer Details */}
      <footer id="global_application_footer" className="mt-12 border-t border-slate-900 bg-slate-950 px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="text-[10px] text-slate-600 font-mono tracking-tight text-center sm:text-left">
          PROYECTO INTEGRATOR "VISIOMENTE" · CONSTRUIDO SOBRE @GOOGLE/GENAI & CORRUNAS
        </span>
        
        {/* Simple installation indicator */}
        <div className="flex gap-4 text-[10px] font-sans font-bold text-slate-500">
          <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-cyan-400"></div> Soportado PWA</span>
          <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div> MediaPipe Ready</span>
          <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div> On-Device TTS</span>
        </div>
      </footer>

    </div>
  );
}

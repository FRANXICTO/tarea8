import React, { useState, useEffect, useRef } from "react";
import { MathTreeNode, MathHistoryItem, ResolutionStep } from "../types";
import { Play, Pause, FastForward, Trash2, Camera, Sparkles, Check, CheckCircle, AlertTriangle, Save, RefreshCw, ZoomIn, ZoomOut, Download, AlertCircle } from "lucide-react";

export default function MathTreeOCR() {
  const [inputExpression, setInputExpression] = useState<string>("(4 + 8) / 3");
  const [sanitizedExpression, setSanitizedExpression] = useState<string>("(4+8)/3");
  const [parsedTree, setParsedTree] = useState<MathTreeNode | null>(null);
  const [interimResult, setInterimResult] = useState<number | null>(null);
  const [history, setHistory] = useState<MathHistoryItem[]>([]);
  const [cameraActive, setCameraActive] = useState<boolean>(true);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // SVG Pan & Zoom State
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Web Camera Capture Ref
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Step-by-Step Solver State
  const [resolutionSteps, setResolutionSteps] = useState<ResolutionStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1);
  const [animatedTree, setAnimatedTree] = useState<MathTreeNode | null>(null);
  const [isPlayingSteps, setIsPlayingSteps] = useState<boolean>(false);

  // Load history from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem("mathtree_history");
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Update camera streams
  useEffect(() => {
    if (cameraActive) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [cameraActive]);

  // Sanitize the text input automatically
  useEffect(() => {
    const clean = inputExpression
      .replace(/\s+/g, "") // remove whitespace
      .replace(/x/gi, "*") // multiply sign
      .replace(/X/g, "*")
      .replace(/÷/g, "/"); // division replacement
    setSanitizedExpression(clean);
  }, [inputExpression]);

  const startCamera = async () => {
    try {
      if (mediaStreamRef.current) {
        stopCamera();
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (e) {
      console.warn("No camera access available for math scanning.");
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

  const triggerVibration = (ms = 50) => {
    if ("vibrate" in navigator) {
      navigator.vibrate(ms);
    }
  };

  // Convert Expression to Tree using Shunting-yard Tokenization
  const parseMathExpression = (expr: string): MathTreeNode | null => {
    // 1. Tokenize numbers (including decimals), operators, parentheses
    const tokens: string[] = [];
    let i = 0;
    while (i < expr.length) {
      const char = expr[i];
      if ("+-*/()".includes(char)) {
        tokens.push(char);
        i++;
      } else if (/\d|\./.test(char)) {
        let numStr = "";
        while (i < expr.length && (expr[i] === "." || (expr[i] >= "0" && expr[i] <= "9"))) {
          numStr += expr[i];
          i++;
        }
        tokens.push(numStr);
      } else {
        i++; // skip unknown chars
      }
    }

    if (tokens.length === 0) return null;

    // 2. Infix to Postfix Shunting-yard converter
    const outputQueue: string[] = [];
    const operatorStack: string[] = [];
    const precedence: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2 };

    tokens.forEach((token) => {
      if (!isNaN(parseFloat(token))) {
        outputQueue.push(token);
      } else if ("+-*/".includes(token)) {
        while (
          operatorStack.length > 0 &&
          "+-*/".includes(operatorStack[operatorStack.length - 1]) &&
          precedence[operatorStack[operatorStack.length - 1]] >= precedence[token]
        ) {
          outputQueue.push(operatorStack.pop()!);
        }
        operatorStack.push(token);
      } else if (token === "(") {
        operatorStack.push(token);
      } else if (token === ")") {
        while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1] !== "(") {
          outputQueue.push(operatorStack.pop()!);
        }
        operatorStack.pop(); // discard "("
      }
    });

    while (operatorStack.length > 0) {
      const op = operatorStack.pop()!;
      if (op === "(" || op === ")") {
        throw new Error("Paréntesis desbalanceados");
      }
      outputQueue.push(op);
    }

    // 3. Build expression tree from postfix queue
    const nodeStack: MathTreeNode[] = [];
    let nodeIdCounter = 0;

    outputQueue.forEach((token) => {
      if (!isNaN(parseFloat(token))) {
        nodeStack.push({
          id: `leaf_${nodeIdCounter++}`,
          value: token
        });
      } else if ("+-*/".includes(token)) {
        if (nodeStack.length < 2) {
          throw new Error("Estructura de fórmula inválida");
        }
        const right = nodeStack.pop()!;
        const left = nodeStack.pop()!;
        nodeStack.push({
          id: `op_${nodeIdCounter++}`,
          value: token,
          left,
          right
        });
      }
    });

    if (nodeStack.length !== 1) {
      throw new Error("Error de consistencia operacional");
    }

    return nodeStack[0];
  };

  // Evaluate tree recursively & log steps
  const evaluateTree = (node: MathTreeNode): number => {
    if (!node.left && !node.right) {
      return parseFloat(node.value);
    }

    if (!node.left || !node.right) {
      throw new Error("Nodo hijo ausente");
    }

    const leftVal = evaluateTree(node.left);
    const rightVal = evaluateTree(node.right);
    let out = 0;

    switch (node.value) {
      case "+": out = leftVal + rightVal; break;
      case "-": out = leftVal - rightVal; break;
      case "*": out = leftVal * rightVal; break;
      case "/": 
        if (rightVal === 0) throw new Error("División por cero");
        out = leftVal / rightVal; 
        break;
      default:
        throw new Error(`Operador desconocido: ${node.value}`);
    }

    return parseFloat(out.toFixed(2));
  };

  // Pre-generate recursive simplification trace frames
  const compileResolutionSteps = (root: MathTreeNode) => {
    const steps: ResolutionStep[] = [];
    
    // Deep clone helper
    const cloneTree = (n: MathTreeNode): MathTreeNode => {
      return {
        id: n.id,
        value: n.value,
        resolvedValue: n.resolvedValue,
        left: n.left ? cloneTree(n.left) : undefined,
        right: n.right ? cloneTree(n.right) : undefined
      };
    };

    const processStep = (currentRoot: MathTreeNode): boolean => {
      // Find deepest operator with pure numeric leaves
      const findDeepestOp = (n: MathTreeNode): MathTreeNode | null => {
        if (!n.left || !n.right) return null;
        
        // binary operator candidate check
        const leftIsVal = !n.left.left && !n.left.right;
        const rightIsVal = !n.right.left && !n.right.right;

        if (leftIsVal && rightIsVal) {
          return n;
        }

        const lDeep = n.left ? findDeepestOp(n.left) : null;
        if (lDeep) return lDeep;

        return n.right ? findDeepestOp(n.right) : null;
      };

      const targetOp = findDeepestOp(currentRoot);
      if (!targetOp || !targetOp.left || !targetOp.right) return false;

      const leftVal = parseFloat(targetOp.left.value);
      const rightVal = parseFloat(targetOp.right.value);
      let res = 0;

      switch (targetOp.value) {
        case "+": res = leftVal + rightVal; break;
        case "-": res = leftVal - rightVal; break;
        case "*": res = leftVal * rightVal; break;
        case "/": res = leftVal / rightVal; break;
      }
      res = parseFloat(res.toFixed(2));

      steps.push({
        nodeId: targetOp.id,
        description: `${leftVal} ${targetOp.value} ${rightVal} = ${res}`,
        leftVal,
        rightVal,
        operator: targetOp.value,
        result: res,
        targetExpression: ""
      });

      // Mutate tree coordinates for next trace
      targetOp.value = res.toString();
      delete targetOp.left;
      delete targetOp.right;
      return true;
    };

    let tempTree = cloneTree(root);
    let loopGuard = 0;
    while (processStep(tempTree) && loopGuard < 50) {
      loopGuard++;
    }

    setResolutionSteps(steps);
    setCurrentStepIndex(-1);
  };

  // Run full compiler pipeline on current sanitized formula
  const buildTree = () => {
    try {
      setErrorMessage(null);
      const tree = parseMathExpression(sanitizedExpression);
      if (!tree) {
        throw new Error("No se formó una estructura jerárquica con esta fórmula");
      }
      
      const total = evaluateTree(tree);
      setParsedTree(tree);
      setAnimatedTree(JSON.parse(JSON.stringify(tree))); // clone for resolving animations
      setInterimResult(total);
      
      // Compile stepwise resolution frames
      compileResolutionSteps(tree);

      // Save automatically in local history tracking
      const historyItem: MathHistoryItem = {
        id: Math.random().toString(),
        formula: sanitizedExpression,
        result: total,
        timestamp: new Date().toLocaleDateString("es-ES") + " " + new Date().toLocaleTimeString("es-ES", {hour: '2-digit', minute:'2-digit'})
      };

      setHistory((prev) => {
        const next = [historyItem, ...prev.filter(h => h.formula !== sanitizedExpression)].slice(0, 10);
        localStorage.setItem("mathtree_history", JSON.stringify(next));
        return next;
      });

    } catch (e: any) {
      setErrorMessage(e.message || "Fórmula no balanceada u operable");
      setParsedTree(null);
      setInterimResult(null);
      triggerVibration(180); // longer error rumble
    }
  };

  // Process camera feed using Express backend Gemini math OCR
  const captureAndOcrFormula = async () => {
    if (isCapturing) return;
    setIsCapturing(true);
    setErrorMessage(null);

    let base64Image = "";
    if (mediaStreamRef.current && videoRef.current) {
      try {
        const canvas = document.createElement("canvas");
        const video = videoRef.current;
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          base64Image = canvas.toDataURL("image/jpeg", 0.85);
        }
      } catch (err) {
        console.error("Camera snap error", err);
      }
    }

    try {
      const response = await fetch("/api/ai/math-ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Image || "dummy_base64" })
      });

      const data = await response.json();
      if (response.status === 422 || data.error) {
        throw new Error(data.error || "No se detectó fórmula matemática legible.");
      }

      setInputExpression(data.expression);
      triggerVibration(60);

    } catch (err: any) {
      setErrorMessage(err.message || "Fallo extrayendo fórmula matemática del lienzo.");
      triggerVibration(180);
    } finally {
      setIsCapturing(false);
    }
  };

  // Resolution Animation steps
  const nextResolutionStep = () => {
    if (currentStepIndex >= resolutionSteps.length - 1) {
      setIsPlayingSteps(false);
      return;
    }

    const nextIndex = currentStepIndex + 1;
    setCurrentStepIndex(nextIndex);
    triggerVibration(40);

    // Apply mutation up to next step
    const targetStep = resolutionSteps[nextIndex];
    
    // Deep clone helper mutating matching nodeId
    const cloneAndMutate = (node: MathTreeNode): MathTreeNode => {
      if (node.id === targetStep.nodeId) {
        return {
          id: node.id,
          value: targetStep.result.toString(),
          isHighlighted: true
        };
      }
      return {
        id: node.id,
        value: node.value,
        left: node.left ? cloneAndMutate(node.left) : undefined,
        right: node.right ? cloneAndMutate(node.right) : undefined
      };
    };

    if (animatedTree) {
      setAnimatedTree(cloneAndMutate(animatedTree));
    }
  };

  const restartStepsTracker = () => {
    setCurrentStepIndex(-1);
    if (parsedTree) {
      setAnimatedTree(JSON.parse(JSON.stringify(parsedTree)));
    }
    setIsPlayingSteps(false);
  };

  // Automate interval player for solver
  useEffect(() => {
    let handle: any;
    if (isPlayingSteps) {
      handle = setInterval(() => {
        if (currentStepIndex < resolutionSteps.length - 1) {
          nextResolutionStep();
        } else {
          setIsPlayingSteps(false);
        }
      }, 1600);
    }
    return () => clearInterval(handle);
  }, [isPlayingSteps, currentStepIndex, resolutionSteps]);

  // Tree Visual coordinates layout algorithm
  const renderLayoutNodes = (
    node: MathTreeNode,
    x: number,
    y: number,
    spacing: number,
    level = 0
  ): { nodes: any[]; links: any[] } => {
    const nodes: any[] = [];
    const links: any[] = [];

    const isLeaf = !node.left && !node.right;
    const isOperator = ["+", "-", "*", "/"].includes(node.value);

    nodes.push({
      id: node.id,
      x,
      y,
      value: node.value,
      isLeaf,
      isOperator,
      isHighlighted: node.isHighlighted
    });

    if (node.left) {
      const leftLayout = renderLayoutNodes(node.left, x - spacing, y + 80, spacing * 0.5, level + 1);
      nodes.push(...leftLayout.nodes);
      links.push(...leftLayout.links);
      links.push({ x1: x, y1: y, x2: x - spacing, y2: y + 80 });
    }

    if (node.right) {
      const rightLayout = renderLayoutNodes(node.right, x + spacing, y + 80, spacing * 0.5, level + 1);
      nodes.push(...rightLayout.nodes);
      links.push(...rightLayout.links);
      links.push({ x1: x, y1: y, x2: x + spacing, y2: y + 80 });
    }

    return { nodes, links };
  };

  // Helper drawing components
  const layout = animatedTree ? renderLayoutNodes(animatedTree, 400, 50, 160) : null;

  // Handle Drag / Panning
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Simple Wheel Zoom implementation
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const nextZoom = zoom - e.deltaY * 0.0015;
    setZoom(Math.max(0.4, Math.min(2.5, nextZoom)));
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("mathtree_history");
  };

  return (
    <div className="flex flex-col xl:flex-row h-full w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 text-slate-100 shadow-2xl">
      
      {/* Parameters configuration column & history */}
      <div className="w-full xl:w-90 p-5 bg-slate-900 border-b xl:border-b-0 xl:border-r border-slate-800 flex flex-col justify-between shrink-0 overflow-y-auto">
        <div className="space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-1 text-amber-500 font-bold uppercase tracking-widest text-xs">
              <Sparkles className="w-4 h-4 animate-pulse" />
              <span>MathTree OCR</span>
            </div>
            <h3 className="text-xl font-bold font-sans text-slate-50 tracking-tight">Árbol Binario de Expresiones</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Escanea fórmulas matemáticas impresas, parsea su jerarquía en árboles operacionales y visualiza recursivamente cada paso de la simplificación.
            </p>
          </div>

          {/* Formula snap and text validation block */}
          <div className="space-y-3">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <h4 className="text-xs font-bold text-slate-300">Cámara de Escaneo (IA)</h4>
              
              {cameraActive ? (
                <div className="relative aspect-video rounded-lg overflow-hidden border border-slate-800 bg-slate-900">
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    autoPlay
                    playsInline
                    muted
                  />
                  {isCapturing && (
                    <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center text-xs">
                      <RefreshCw className="w-4 h-4 text-amber-400 animate-spin mr-2" />
                      Procesando con Gemini...
                    </div>
                  )}
                  <button
                    onClick={captureAndOcrFormula}
                    disabled={isCapturing}
                    className="absolute bottom-2 right-2 bg-amber-500 hover:bg-amber-600 text-slate-950 px-2.5 py-1.5 rounded-md text-[10px] font-bold flex items-center gap-1 shadow-lg"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Capturar
                  </button>
                </div>
              ) : (
                <div className="h-28 bg-slate-900/60 rounded-lg flex flex-col items-center justify-center text-xs text-slate-500 border border-slate-800 border-dashed p-4 text-center">
                  <AlertCircle className="w-6 h-6 text-slate-600 mb-1" />
                  <span>Cámara inactiva</span>
                </div>
              )}

              <button
                onClick={() => setCameraActive(!cameraActive)}
                className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-[10px] uppercase font-bold text-slate-400"
              >
                {cameraActive ? "Apagar Cámara" : "Encender Cámara"}
              </button>
            </div>

            {/* Input expression and sanitizer confirm */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 flex justify-between">
                <span>Expresión Matemática:</span>
                <span className="text-[10px] text-amber-400 font-mono tracking-tighter">Fórmula Libre</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputExpression}
                  onChange={(e) => setInputExpression(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-950 text-slate-100 placeholder-slate-700 text-xs rounded-xl border border-slate-800 focus:outline-none focus:border-amber-500"
                  placeholder="Ej: (4 + 8) / 3"
                />
                <button
                  onClick={buildTree}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-1 shrink-0"
                >
                  <Check className="w-4 h-4" /> Go
                </button>
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                Sanitizado: <span className="text-slate-300 font-bold">{sanitizedExpression}</span>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-950/50 border border-red-500/20 text-red-300 text-xs rounded-xl flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>
        </div>

        {/* Math scan history list */}
        <div className="mt-6 pt-4 border-t border-slate-800">
          <div className="flex justify-between items-center mb-2.5">
            <span className="text-xs font-bold text-slate-400">Historial de Fórmulas:</span>
            {history.length > 0 && (
              <button onClick={clearHistory} className="text-[10px] text-red-400 hover:underline">
                Limpiar
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <p className="text-[10px] text-slate-600 font-mono">No hay fórmulas guardadas.</p>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {history.map((hItem) => (
                <button
                  key={hItem.id}
                  onClick={() => setInputExpression(hItem.formula)}
                  className="w-full text-left p-2 bg-slate-950/50 hover:bg-slate-950 border border-slate-800/80 rounded-lg text-xs flex justify-between items-center font-mono hover:border-amber-500/40 transition"
                >
                  <span className="text-slate-300 overflow-hidden text-ellipsis whitespace-nowrap">{hItem.formula}</span>
                  <span className="text-amber-400 font-bold ml-1.5">={hItem.result}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main interactive SVG Drawing stage */}
      <div className="flex-1 flex flex-col bg-slate-950 relative overflow-hidden min-h-[460px]">
        
        {/* SVG Stage controls */}
        <div className="p-4 border-b border-slate-900 flex justify-between items-center z-10 bg-slate-950/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <ZoomIn onClick={() => setZoom(z => Math.min(2.5, z + 0.15))} className="w-4 h-4 text-slate-400 hover:text-slate-200 cursor-pointer" />
            <ZoomOut onClick={() => setZoom(z => Math.max(0.4, z - 0.15))} className="w-4 h-4 text-slate-400 hover:text-slate-200 cursor-pointer" />
            <button
              onClick={() => { setPan({ x: 0, y: 0 }); setZoom(1); }}
              className="text-[10px] font-mono text-slate-400 hover:text-slate-200 border border-slate-800 rounded px-1.5 py-0.5"
            >
              Reset view
            </button>
          </div>

          <div id="solver_buttons" className="flex items-center gap-1.5">
            <button
              onClick={restartStepsTracker}
              className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-850 rounded-lg text-[10px] font-bold text-slate-300 flex items-center gap-1"
              title="Reiniciar debug"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reiniciar
            </button>
            <button
              onClick={nextResolutionStep}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-[10px] font-bold flex items-center gap-1"
              title="Paso a paso"
            >
              <Play className="w-3.5 h-3.5" /> Siguiente Paso
            </button>
            <button
              onClick={() => setIsPlayingSteps(!isPlayingSteps)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 ${
                isPlayingSteps ? "bg-red-600 text-white" : "bg-slate-800 text-slate-200 hover:bg-slate-700"
              }`}
            >
              <FastForward className="w-3.5 h-3.5" />
              {isPlayingSteps ? "Autoplay On" : "Autoplay"}
            </button>
          </div>
        </div>

        {/* Interactive Expression Tree SVG Drawing Stage */}
        <div
          className="flex-1 relative cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          {parsedTree ? (
            <svg
              className="w-full h-full"
              viewBox="0 0 800 450"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "center center",
                transition: isDragging ? "none" : "transform 0.15s ease-out"
              }}
            >
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#475569" />
                </marker>
              </defs>

              {/* Draw connected lines */}
              {layout?.links.map((link, idx) => (
                <line
                  key={`link_${idx}`}
                  x1={link.x1}
                  y1={link.y1}
                  x2={link.x2}
                  y2={link.y2}
                  stroke="#334155"
                  strokeWidth="2.5"
                  markerEnd="url(#arrow)"
                />
              ))}

              {/* Draw node entities */}
              {layout?.nodes.map((node) => (
                <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                  {/* Outer circle layout */}
                  <circle
                    r="22"
                    fill={node.isHighlighted ? "#1e1b4b" : "#0f172a"}
                    stroke={
                      node.isHighlighted
                        ? "#a855f7"
                        : node.isOperator
                        ? "#f59e0b"
                        : "#0ea5e9"
                    }
                    strokeWidth={node.isHighlighted ? "4.5" : "2.5"}
                    className={node.isHighlighted ? "animate-pulse" : ""}
                    filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.5))"
                  />
                  {/* Node label text */}
                  <text
                    textAnchor="middle"
                    alignmentBaseline="central"
                    fill={node.isHighlighted ? "#f3e8ff" : "#f8fafc"}
                    fontSize="13"
                    className="font-mono font-bold"
                  >
                    {node.value}
                  </text>
                </g>
              ))}
            </svg>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-500">
              <Sparkles className="w-10 h-10 text-slate-700 mb-3 animate-pulse" />
              <span className="text-sm font-semibold text-slate-400">Genera o escanea un Árbol Binario</span>
              <span className="text-xs text-slate-600 mt-1 max-w-sm leading-relaxed">
                Ingresa una fórmula matemática válida a la izquierda y presiona el botón 'Go' para construir su representación gráfica interactiva.
              </span>
            </div>
          )}
        </div>

        {/* Stepwise status debug banner at bottom */}
        {resolutionSteps.length > 0 && parsedTree && (
          <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-3">
            <div>
              <span className="text-[10px] text-amber-500 font-mono font-bold uppercase tracking-wider block">Estado de la Simplificación:</span>
              <p className="text-xs font-semibold text-slate-300">
                {currentStepIndex === -1 ? (
                  <span>Operación cargada. Listo para simplificar.</span>
                ) : (
                  <span>Resolviendo: {resolutionSteps.map((s, idx) => idx <= currentStepIndex ? s.description : "").filter(Boolean).join("  ➡️  ")}</span>
                )}
              </p>
            </div>
            
            <div className="flex items-center gap-4 bg-slate-950 p-2 border border-slate-850 rounded-xl shrink-0">
              <div className="text-right">
                <span className="text-[9px] text-slate-500 block font-mono">RESULTADO FINAL</span>
                <span className="text-md font-bold font-mono text-slate-100">{interimResult !== null ? interimResult : "--"}</span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20">
                <CheckCircle className="w-4 h-4 text-amber-500" />
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

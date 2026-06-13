/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Types shared across the interactive system

// 1. Types for Bubble Popper Game (MediaPipe Hands)
export interface Bubble {
  id: string;
  x: number;
  y: number;
  radius: number;
  speed: number;
  color: string;
  pointValue: number;
  word?: string; // Optional bubble labeling
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface HandPointer {
  x: number;
  y: number;
  index: number; // 8 (Index tip), 12 (Middle tip)
  handIndex: number; // Left vs Right index
}


// 2. Types for Accessibility Assistant (Mobile IA Local)
export interface SpeechHistoryItem {
  id: string;
  timestamp: string;
  mode: "objects" | "text";
  detectedText: string;
}


// 3. Types for MathTree OCR (Binary Expression Tree)
export interface MathTreeNode {
  value: string; // The operator (+,-,*,/) or the raw numerical string
  left?: MathTreeNode;
  right?: MathTreeNode;
  id: string; // unique ID to track node during tree animation / drawing
  x?: number; // memoized layout coordinates
  y?: number;
  resolvedValue?: number; // to show resolved intermediate values during stepwise debugger
  isResolving?: boolean; // animation flags
  isHighlighted?: boolean;
}

export interface MathHistoryItem {
  id: string;
  formula: string;
  result: number;
  timestamp: string;
}

export interface ResolutionStep {
  nodeId: string;
  description: string;
  leftVal: number;
  rightVal: number;
  operator: string;
  result: number;
  targetExpression: string;
}


// 4. Types for Smart Translator (Traducción Inteligente PWA)
export interface TranslationHistoryItem {
  id: string;
  sourceText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  timestamp: string;
}

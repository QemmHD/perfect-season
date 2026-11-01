// Claude 2026-11-01: the soccer draft data (src/data/soccer.json, about 1 MB), loaded only when this
// page plays soccer. The top-level await keeps it out of the main chunk: basketball and football
// pages never download it, and the service worker caches it on first use (pwa/sw.js).
// The single-file artifact build (vite --mode artifact, an IIFE) can't have a top-level await, so it
// aliases this module to soccer-raw.artifact.ts and plays NBA/NFL only (SOCCER_AVAILABLE false).
import { SPORT } from './sport';

export const SOCCER_AVAILABLE = true;
export const SOCCER_RAW: unknown = SPORT === 'soccer' ? (await import('../data/soccer.json')).default : null;

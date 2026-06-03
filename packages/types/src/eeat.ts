/** E-E-A-T domain — output of the E-E-A-T Scanner (tool 2). */
import type { Url } from './crawl.js';
import type { ScoreGrade } from './scoring.js';

export type EeatPillarKey = 'experience' | 'expertise' | 'authoritativeness' | 'trust';

export interface EeatSignal {
  id: string;
  pillar: EeatPillarKey;
  label: string;
  present: boolean;
  weight: number;
  evidence?: string;
  recommendation: string;
}

export interface EeatPillar {
  key: EeatPillarKey;
  label: string;
  /** 0..100 pillar score. */
  score: number;
  signals: EeatSignal[];
}

export interface EeatReport {
  url: Url;
  generatedAt: string;
  overall: number;
  grade: ScoreGrade;
  pillars: EeatPillar[];
  pagesCrawled: number;
  improvements: string[];
}

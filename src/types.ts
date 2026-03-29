export interface Game {
  id: number;
  name: string;
  frames: string[];
  totalScore: number;
  frameScores: number[];
  confidence?: number;
  notes?: string;
  oilPattern?: string;
  line?: string;
  ball?: string;
  manualNotes?: string;
}

export interface BowlingStats {
  avg: string;
  pins: number;
  strikeRate: string;
  spareRate: string;
  closedRate: string;
  splitRate: string;
  max: number;
}

export interface ScoreResult {
  total: number;
  frameScores: number[];
}

export interface Report {
  id: string;
  playerName: string;
  tournamentName: string;
  games: Game[];
  date: string;
  stats: BowlingStats;
}

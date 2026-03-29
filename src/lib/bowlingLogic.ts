import { ScoreResult } from "../types";

export const calculateBowlingScore = (frames: string[]): ScoreResult => {
  let total = 0;
  let frameScores: number[] = [];
  const rolls: number[] = [];

  frames.forEach((f, idx) => {
    if (!f) return;
    
    // Standardize notation
    const standardized = f.toUpperCase().replace(/\s/g, "").replace(/^S/, "");
    
    if (idx < 9) {
      // Frames 1-9
      if (standardized === "X") {
        rolls.push(10);
      } else if (standardized.includes("/")) {
        const first = parseInt(standardized[0]) || 0;
        rolls.push(first, 10 - first);
      } else {
        const first = standardized[0] === "-" ? 0 : (parseInt(standardized[0]) || 0);
        const second = standardized[1] === "-" ? 0 : (parseInt(standardized[1]) || 0);
        rolls.push(first, second);
      }
    } else {
      // Frame 10 (can have 3 rolls)
      for (let i = 0; i < standardized.length; i++) {
        const char = standardized[i];
        if (char === "X") {
          rolls.push(10);
        } else if (char === "/") {
          const prev = rolls[rolls.length - 1] || 0;
          rolls.push(10 - prev);
        } else if (char === "-") {
          rolls.push(0);
        } else {
          rolls.push(parseInt(char) || 0);
        }
      }
    }
  });

  let rollIdx = 0;
  for (let i = 0; i < 10; i++) {
    const first = rolls[rollIdx] || 0;
    
    if (first === 10) {
      // Strike
      total += 10 + (rolls[rollIdx + 1] || 0) + (rolls[rollIdx + 2] || 0);
      rollIdx += 1;
    } else {
      const second = rolls[rollIdx + 1] || 0;
      if (first + second === 10) {
        // Spare
        total += 10 + (rolls[rollIdx + 2] || 0);
        rollIdx += 2;
      } else {
        // Open
        total += first + second;
        rollIdx += 2;
      }
    }
    frameScores.push(total);
  }
  return { total, frameScores };
};

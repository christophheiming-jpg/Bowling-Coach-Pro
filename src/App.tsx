import React, { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Camera, Edit3, FileText, Trash2, Loader2, Trophy, User, MapPin, History, Save, ChevronRight, BarChart3, PieChart as PieChartIcon, TrendingUp, Circle, X } from "lucide-react";
// @ts-ignore - html2pdf.js does not have types
import html2pdf from "html2pdf.js";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line 
} from 'recharts';
import { analyzeScoreboard } from "./services/geminiService";
import { calculateBowlingScore } from "./lib/bowlingLogic";
import { Game, BowlingStats, Report } from "./types";

export default function App() {
  const [playerName, setPlayerName] = useState("");
  const [tournamentName, setTournamentName] = useState("");
  const [games, setGames] = useState<Game[]>([]);
  const [activeTab, setActiveTab] = useState<"scan" | "edit" | "report" | "history">("scan");
  const [isScanning, setIsScanning] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [savedReports, setSavedReports] = useState<Report[]>([]);
  
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [lastGameId, setLastGameId] = useState<number | null>(null);
  const [oilPattern, setOilPattern] = useState("");
  const [line, setLine] = useState("");
  const [ball, setBall] = useState("");
  const [manualNotes, setManualNotes] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("bowling_reports");
    if (saved) {
      try {
        setSavedReports(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved reports", e);
      }
    }
  }, []);

  const saveCurrentReport = () => {
    if (!stats || games.length === 0) return;
    const newReport: Report = {
      id: Date.now().toString(),
      playerName,
      tournamentName,
      games,
      date: new Date().toISOString(),
      stats
    };
    const updated = [newReport, ...savedReports];
    setSavedReports(updated);
    localStorage.setItem("bowling_reports", JSON.stringify(updated));
    alert("Analyse wurde in der Historie gespeichert!");
  };

  const loadReport = (report: Report) => {
    setPlayerName(report.playerName);
    setTournamentName(report.tournamentName);
    setGames(report.games);
    setActiveTab("report");
  };

  const deleteReport = (id: string) => {
    const updated = savedReports.filter(r => r.id !== id);
    setSavedReports(updated);
    localStorage.setItem("bowling_reports", JSON.stringify(updated));
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsScanning(true);
    const currentGamesCount = games.length;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Data = (reader.result as string).split(",")[1];
      try {
        const data = await analyzeScoreboard(base64Data);
        if (data.name && !playerName) setPlayerName(data.name);
        
        const scoreResult = calculateBowlingScore(data.frames);
        const newGame: Game = { 
          id: Date.now(), 
          name: `Spiel ${currentGamesCount + 1}`, 
          frames: data.frames,
          totalScore: scoreResult.total,
          frameScores: scoreResult.frameScores,
          confidence: data.confidence,
          notes: data.notes
        };
        
        setGames(prev => [...prev, newGame]);
        setLastGameId(newGame.id);
        setShowCommentModal(true);
        
        if (data.confidence < 0.8) {
          alert(`Hinweis: Die Bildqualität war nicht optimal (Vertrauen: ${Math.round(data.confidence * 100)}%). Bitte überprüfen Sie die Daten im EDIT-Tab.`);
        }
        
        // Switch to report tab after the first scan to show summary
        if (currentGamesCount === 0) setActiveTab("report");
      } catch (err) {
        console.error(err);
        alert("Fehler beim Scannen des Scoreboards. Bitte versuchen Sie es erneut.");
      } finally {
        setIsScanning(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsDataURL(file);
  };

  const saveComments = () => {
    if (lastGameId === null) return;
    setGames(prev => prev.map(g => g.id === lastGameId ? {
      ...g,
      oilPattern,
      line,
      ball,
      manualNotes
    } : g));
    setShowCommentModal(false);
    setOilPattern("");
    setLine("");
    setBall("");
    setManualNotes("");
  };

  const updateGame = (gIdx: number, fIdx: number, value: string) => {
    const newGames = [...games];
    newGames[gIdx].frames[fIdx] = value.toUpperCase();
    const scoreResult = calculateBowlingScore(newGames[gIdx].frames);
    newGames[gIdx].totalScore = scoreResult.total;
    newGames[gIdx].frameScores = scoreResult.frameScores;
    setGames(newGames);
  };

  const stats = useMemo<BowlingStats | null>(() => {
    if (games.length === 0) return null;
    const scores = games.map(g => g.totalScore);
    const totalPins = scores.reduce((a, b) => a + b, 0);
    let framesCount = 0, strikes = 0, spares = 0, closed = 0, splits = 0;
    games.forEach(g => g.frames.forEach(f => {
      if (!f) return; framesCount++;
      if (f.includes("X")) strikes++;
      if (f.includes("/")) spares++;
      if (f.includes("X") || f.includes("/")) closed++;
      if (f.startsWith("S")) splits++;
    }));
    return {
      avg: (totalPins / games.length).toFixed(1),
      pins: totalPins,
      strikeRate: ((strikes / framesCount) * 100).toFixed(1),
      spareRate: ((spares / framesCount) * 100).toFixed(1),
      closedRate: ((closed / framesCount) * 100).toFixed(1),
      splitRate: ((splits / framesCount) * 100).toFixed(1),
      max: Math.max(...scores)
    };
  }, [games]);

  const chartData = useMemo(() => {
    return games.map((g, i) => ({
      name: `G${i + 1}`,
      score: g.totalScore
    }));
  }, [games]);

  const distributionData = useMemo(() => {
    if (!stats) return [];
    return [
      { name: 'Strikes', value: parseFloat(stats.strikeRate), color: '#30D158' },
      { name: 'Spares', value: parseFloat(stats.spareRate || "0"), color: '#0A84FF' },
      { name: 'Open', value: 100 - parseFloat(stats.closedRate), color: '#FF453A' }
    ];
  }, [stats]);

  const downloadPdf = () => {
    if (!reportRef.current) return;
    setIsGeneratingPdf(true);
    const element = reportRef.current;
    const opt = {
      margin: 0,
      filename: `Bowling_Report_${playerName || "Spieler"}.pdf`,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const }
    };
    html2pdf().set(opt).from(element).save().then(() => setIsGeneratingPdf(false));
  };

  return (
    <div className="min-h-screen text-white font-sans selection:bg-blue-500/30 bg-[#0a192f] pt-[5vh]">
      <div className="max-w-[500px] mx-auto min-h-screen flex flex-col relative">
      {/* Tab Bar */}
      <nav className="tab-bar sticky top-[5vh] flex justify-around pt-4 pb-4 z-50 border-b border-[var(--glass-border)]">
        <button 
          onClick={() => setActiveTab("scan")} 
          className={`flex flex-col items-center gap-1 text-[10px] font-black uppercase tracking-widest transition-colors ${activeTab === "scan" ? "text-[var(--ios-blue)]" : "text-[var(--text-sec)]"}`}
        >
          <Camera size={20} />
          SCAN
        </button>
        <button 
          onClick={() => setActiveTab("edit")} 
          className={`flex flex-col items-center gap-1 text-[10px] font-black uppercase tracking-widest transition-colors ${activeTab === "edit" ? "text-[var(--ios-blue)]" : "text-[var(--text-sec)]"}`}
        >
          <Edit3 size={20} />
          EDIT
        </button>
        <button 
          onClick={() => setActiveTab("report")} 
          className={`flex flex-col items-center gap-1 text-[10px] font-black uppercase tracking-widest transition-colors ${activeTab === "report" ? "text-[var(--ios-blue)]" : "text-[var(--text-sec)]"}`}
        >
          <FileText size={20} />
          REPORT
        </button>
        <button 
          onClick={() => setActiveTab("history")} 
          className={`flex flex-col items-center gap-1 text-[10px] font-black uppercase tracking-widest transition-colors ${activeTab === "history" ? "text-[var(--ios-blue)]" : "text-[var(--text-sec)]"}`}
        >
          <History size={20} />
          HISTORY
        </button>
      </nav>

      {/* Content */}
      <main className="flex-1 p-5 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === "scan" && (
            <motion.div 
              key="scan"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="glass-box rounded-[24px] p-[22px] space-y-4 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
                <h3 className="text-[10px] font-black uppercase text-blue-400 tracking-widest flex items-center gap-2">
                  <Trophy size={12} /> Wo bowlst du heute?
                </h3>
                <div className="space-y-3">
                  <div className="relative">
                    <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input 
                      className="w-full bg-white/5 border border-white/10 p-4 pl-12 rounded-2xl outline-none focus:border-blue-500 transition-colors" 
                      value={playerName} 
                      onChange={e => setPlayerName(e.target.value)} 
                      placeholder="Spieler Name" 
                    />
                  </div>
                  <div className="relative">
                    <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input 
                      className="w-full bg-white/5 border border-white/10 p-4 pl-12 rounded-2xl outline-none focus:border-blue-500 transition-colors" 
                      value={tournamentName} 
                      onChange={e => setTournamentName(e.target.value)} 
                      placeholder="Turnier / Ort" 
                    />
                  </div>
                </div>
              </div>

              <div className="glass-box rounded-[24px] p-[22px] text-center space-y-4 py-10 shadow-[0_10px_40px_rgba(0,0,0,0.5)] relative overflow-hidden">
                <div className="absolute -right-4 -top-4 opacity-5 rotate-12">
                  <Circle size={120} fill="currentColor" />
                </div>
                <h3 className="text-sm font-bold text-blue-400 relative z-10">
                  {games.length === 0 ? "Bereit für ersten Scan" : `Spiel ${games.length + 1} hinzufügen`}
                </h3>
                {isScanning ? (
                  <div className="py-6 flex flex-col items-center gap-3 relative z-10">
                    <Loader2 className="animate-spin text-[var(--ios-blue)]" size={40} />
                    <p className="text-xs text-blue-400 animate-pulse">KI analysiert Scoreboard...</p>
                  </div>
                ) : (
                  <button 
                    onClick={() => fileInputRef.current?.click()} 
                    className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center mx-auto shadow-2xl active:scale-90 transition-transform group relative z-10"
                  >
                    <div className="absolute inset-0 rounded-full border-4 border-white/20 scale-110 group-hover:scale-125 transition-transform" />
                    <Camera size={40} className="group-hover:scale-110 transition-transform" />
                  </button>
                )}
                <p className="text-xs text-gray-400 relative z-10">Scoreboard für Spiel {games.length + 1} fotografieren</p>
                <input type="file" ref={fileInputRef} hidden accept="image/*" capture="environment" onChange={handleFileUpload} />
              </div>
              
              {games.length > 0 && (
                <button 
                  onClick={() => {
                    if (confirm("Möchten Sie wirklich alle Daten zurücksetzen?")) {
                      setGames([]);
                      setPlayerName("");
                      setTournamentName("");
                    }
                  }} 
                  className="w-full text-red-500 text-[10px] font-black uppercase tracking-tighter opacity-50 hover:opacity-100 transition-opacity flex items-center justify-center gap-2"
                >
                  <Trash2 size={12} /> Daten zurücksetzen
                </button>
              )}
            </motion.div>
          )}

          {activeTab === "edit" && (
            <motion.div 
              key="edit"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              {games.length === 0 ? (
                <div className="text-center text-gray-500 py-20 flex flex-col items-center gap-4">
                  <Camera size={48} className="opacity-20" />
                  <p>Keine Daten. Bitte scannen Sie zuerst ein Scoreboard.</p>
                </div>
              ) : (
                games.map((g, gIdx) => (
                  <div key={g.id} className="glass-box rounded-[24px] overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
                    <div className="px-4 py-2 text-[10px] font-bold text-blue-400 border-b border-white/5 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span>{g.name}</span>
                        {g.confidence !== undefined && (
                          <span className={`px-1.5 py-0.5 rounded-full text-[8px] ${g.confidence > 0.9 ? "bg-green-500/20 text-green-400" : g.confidence > 0.7 ? "bg-yellow-500/20 text-yellow-400" : "bg-red-500/20 text-red-400"}`}>
                            {Math.round(g.confidence * 100)}% Match
                          </span>
                        )}
                      </div>
                      <button 
                        onClick={() => setGames(prev => prev.filter(game => game.id !== g.id))}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    {g.notes && (
                      <div className="px-4 py-1.5 bg-yellow-500/5 text-[9px] text-yellow-200/60 italic border-b border-white/5">
                        KI-Notiz: {g.notes}
                      </div>
                    )}
                    <div className="grid grid-cols-11">
                      {g.frames.map((f, fIdx) => (
                        <div key={fIdx} className="border-r border-white/5 flex flex-col items-center h-12">
                          <span className="text-[7px] text-gray-600 pt-1">{fIdx+1}</span>
                          <input 
                            className="bg-transparent w-full text-center text-xs font-bold h-full outline-none focus:bg-white/5" 
                            value={f} 
                            onChange={e => updateGame(gIdx, fIdx, e.target.value)} 
                          />
                        </div>
                      ))}
                      <div className="bg-blue-600 flex items-center justify-center font-black text-[10px]">
                        {g.totalScore}
                      </div>
                    </div>
                    <div className="p-3 grid grid-cols-3 gap-2 border-t border-white/5">
                      <div className="space-y-1">
                        <label className="text-[7px] text-gray-500 uppercase font-black">Ölbild</label>
                        <input 
                          className="w-full bg-white/5 border border-white/10 p-1.5 rounded-lg text-[10px] outline-none focus:border-blue-500" 
                          value={g.oilPattern || ""} 
                          onChange={e => {
                            const newGames = [...games];
                            newGames[gIdx].oilPattern = e.target.value;
                            setGames(newGames);
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[7px] text-gray-500 uppercase font-black">Linie</label>
                        <input 
                          className="w-full bg-white/5 border border-white/10 p-1.5 rounded-lg text-[10px] outline-none focus:border-blue-500" 
                          value={g.line || ""} 
                          onChange={e => {
                            const newGames = [...games];
                            newGames[gIdx].line = e.target.value;
                            setGames(newGames);
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[7px] text-gray-500 uppercase font-black">Ball</label>
                        <input 
                          className="w-full bg-white/5 border border-white/10 p-1.5 rounded-lg text-[10px] outline-none focus:border-blue-500" 
                          value={g.ball || ""} 
                          onChange={e => {
                            const newGames = [...games];
                            newGames[gIdx].ball = e.target.value;
                            setGames(newGames);
                          }}
                        />
                      </div>
                    </div>
                    <div className="px-3 pb-3">
                      <label className="text-[7px] text-gray-500 uppercase font-black">Kommentare</label>
                      <textarea 
                        className="w-full bg-white/5 border border-white/10 p-2 rounded-lg text-[10px] outline-none focus:border-blue-500 h-12 resize-none" 
                        value={g.manualNotes || ""} 
                        onChange={e => {
                          const newGames = [...games];
                          newGames[gIdx].manualNotes = e.target.value;
                          setGames(newGames);
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}

          {activeTab === "report" && stats && (
            <motion.div 
              key="report"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {games.length < 3 && (
                <div className="bg-blue-600/20 border border-blue-600/30 p-4 rounded-2xl flex items-center gap-3">
                  <div className="bg-blue-600 p-2 rounded-full">
                    <Camera size={16} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Vollständiger Report</p>
                    <p className="text-xs text-white/80">Noch {3 - games.length} Scans für den PDF-Export nötig.</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div className="glass-box rounded-[24px] p-4 text-center shadow-[0_10px_40px_rgba(0,0,0,0.5)] border-blue-500/30">
                  <span className="text-[8px] text-gray-400 uppercase font-black">High Game</span>
                  <div className="flex items-center justify-center gap-1">
                    <Trophy size={14} className="text-yellow-400" />
                    <strong className="block text-2xl text-yellow-400">{stats.max}</strong>
                  </div>
                </div>
                <div className="glass-box rounded-[24px] p-4 text-center shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
                  <span className="text-[8px] text-gray-400 uppercase font-black">Schnitt</span>
                  <strong className="block text-2xl">{stats.avg}</strong>
                </div>
                <div className="glass-box rounded-[24px] p-4 text-center shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
                  <span className="text-[8px] text-gray-400 uppercase font-black">Strikes</span>
                  <strong className="block text-2xl text-green-400">{stats.strikeRate}%</strong>
                </div>
              </div>

              {games.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-400 px-2">Spiel Details</h3>
                  <div className="space-y-3">
                    {games.map((g, idx) => (
                      <div key={idx} className="glass-box rounded-[24px] p-4 space-y-3 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
                        <div className="flex justify-between items-center border-b border-white/5 pb-2">
                          <span className="text-xs font-black uppercase">{g.name}</span>
                          <span className="text-sm font-black text-blue-400">{g.totalScore} PINS</span>
                        </div>

                        {/* Scoreboard Grid */}
                        <div className="grid grid-cols-10 gap-0.5 border border-white/10 rounded-xl overflow-hidden bg-white/5">
                          {g.frames.map((f, fIdx) => (
                            <div key={fIdx} className="flex flex-col border-r border-white/5 last:border-r-0">
                              <div className="text-[6px] text-gray-500 text-center py-0.5 border-b border-white/5 bg-white/5 font-black uppercase">
                                {fIdx + 1}
                              </div>
                              <div className="flex-1 flex items-center justify-center py-1.5 text-[10px] font-black min-h-[28px]">
                                {f.includes('X') ? <span className="text-blue-400">X</span> : f.includes('/') ? <span className="text-green-400">{f}</span> : f}
                              </div>
                              <div className="text-[8px] text-center py-0.5 bg-white/5 font-bold text-blue-300">
                                {g.frameScores[fIdx]}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <span className="text-[8px] text-gray-500 uppercase font-black">Ölbild</span>
                            <span className="text-[10px] font-bold block truncate">{g.oilPattern || "-"}</span>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[8px] text-gray-500 uppercase font-black">Linie</span>
                            <span className="text-[10px] font-bold block truncate">{g.line || "-"}</span>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[8px] text-gray-500 uppercase font-black">Ball</span>
                            <span className="text-[10px] font-bold block truncate">{g.ball || "-"}</span>
                          </div>
                        </div>
                        {g.manualNotes && (
                          <div className="space-y-1 border-t border-white/5 pt-2">
                            <span className="text-[8px] text-gray-500 uppercase font-black">Kommentare</span>
                            <p className="text-[10px] text-gray-300 leading-tight">{g.manualNotes}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="glass-box rounded-[24px] p-[22px] space-y-3 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
                <h4 className="text-blue-400 text-[10px] font-black uppercase">Vorschau Analyse</h4>
                <p className="text-sm leading-relaxed">
                  Basierend auf {games.length} Spielen zeigt {playerName || "der Spieler"} ein hohes Potenzial. 
                  Die Spare-Quote von {stats.closedRate}% ist der Schlüssel zur 190er-Marke.
                </p>
                <div className="flex gap-2 flex-wrap">
                  <span className="bg-white/10 px-3 py-1 rounded-full text-[10px] font-bold">Spare-Drill 7/10</span>
                  <span className="bg-white/10 px-3 py-1 rounded-full text-[10px] font-bold">Lane-Reading</span>
                </div>
              </div>

              <button 
                disabled={games.length < 3 || isGeneratingPdf} 
                onClick={downloadPdf}
                className={`w-full py-5 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-2 ${games.length < 3 ? "bg-gray-800 text-gray-600" : "bg-blue-600 text-white active:scale-95"}`}
              >
                {isGeneratingPdf ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    PDF wird erstellt...
                  </>
                ) : games.length < 3 ? (
                  `Noch ${3-games.length} Scans nötig`
                ) : (
                  <>
                    <FileText size={20} />
                    PDF Analyse Exportieren
                  </>
                )}
              </button>

              {games.length > 0 && (
                <button 
                  onClick={saveCurrentReport}
                  className="w-full py-4 rounded-2xl border border-blue-600/30 text-blue-400 font-black text-sm uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <Save size={20} />
                  Analyse Speichern
                </button>
              )}
            </motion.div>
          )}

          {activeTab === "history" && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <h2 className="text-xl font-black uppercase tracking-tighter mb-6">Vergangene Analysen</h2>
              {savedReports.length === 0 ? (
                <div className="text-center text-gray-500 py-20 flex flex-col items-center gap-4">
                  <History size={48} className="opacity-20" />
                  <p>Keine gespeicherten Analysen gefunden.</p>
                </div>
              ) : (
                savedReports.map(report => (
                  <div key={report.id} className="glass-box rounded-[24px] p-5 flex justify-between items-center shadow-[0_10px_40px_rgba(0,0,0,0.5)] group">
                    <div className="flex-1 cursor-pointer" onClick={() => loadReport(report)}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-black text-blue-400 uppercase">{new Date(report.date).toLocaleDateString("de-DE")}</span>
                        <span className="text-[10px] text-gray-500">• {report.games.length} Spiele</span>
                      </div>
                      <h4 className="text-lg font-bold">{report.playerName || "Unbekannter Spieler"}</h4>
                      <p className="text-xs text-gray-400">{report.tournamentName || "Kein Ort angegeben"}</p>
                      <div className="mt-3 flex gap-4 items-end">
                        <div className="flex flex-col">
                          <span className="text-[8px] text-gray-500 uppercase font-black">Schnitt</span>
                          <span className="text-sm font-bold">{report.stats.avg}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[8px] text-gray-500 uppercase font-black">Strikes</span>
                          <span className="text-sm font-bold text-green-400">{report.stats.strikeRate}%</span>
                        </div>
                        <div className="flex flex-col bg-yellow-400/10 px-2 py-1 rounded-lg border border-yellow-400/20">
                          <span className="text-[7px] text-yellow-500 uppercase font-black flex items-center gap-1">
                            <Trophy size={8} /> High Game
                          </span>
                          <span className="text-sm font-black text-yellow-400">{report.stats.max}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          if (confirm("Diese Analyse wirklich löschen?")) {
                            deleteReport(report.id);
                          }
                        }}
                        className="p-3 text-red-500/50 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                      <button 
                        onClick={() => loadReport(report)}
                        className="p-3 bg-blue-600/10 text-blue-400 rounded-full group-hover:bg-blue-600 group-hover:text-white transition-all"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Comment Modal */}
      <AnimatePresence>
        {showCommentModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowCommentModal(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass-box w-full max-w-[400px] rounded-[32px] p-8 space-y-6 relative z-10 shadow-[0_20px_60px_rgba(0,0,0,0.8)]"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black uppercase tracking-tighter">Spiel Details</h3>
                <button onClick={() => setShowCommentModal(false)} className="text-gray-500 hover:text-white">
                  <X size={24} />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-blue-400 tracking-widest">Ölbild</label>
                  <input 
                    className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-blue-500 transition-colors" 
                    value={oilPattern} 
                    onChange={e => setOilPattern(e.target.value)} 
                    placeholder="z.B. House Pattern, 42ft" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-blue-400 tracking-widest">Linie</label>
                    <input 
                      className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-blue-500 transition-colors" 
                      value={line} 
                      onChange={e => setLine(e.target.value)} 
                      placeholder="z.B. 15 -> 8" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-blue-400 tracking-widest">Ball</label>
                    <input 
                      className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-blue-500 transition-colors" 
                      value={ball} 
                      onChange={e => setBall(e.target.value)} 
                      placeholder="z.B. Phaze II" 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-blue-400 tracking-widest">Kommentare</label>
                  <textarea 
                    className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-blue-500 transition-colors h-24 resize-none" 
                    value={manualNotes} 
                    onChange={e => setManualNotes(e.target.value)} 
                    placeholder="Weitere Anmerkungen..." 
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setShowCommentModal(false)}
                  className="flex-1 py-4 rounded-2xl border border-white/10 text-gray-400 font-black text-sm uppercase tracking-widest hover:bg-white/5 transition-all"
                >
                  Überspringen
                </button>
                <button 
                  onClick={saveComments}
                  className="flex-[2] py-4 rounded-2xl bg-blue-600 text-white font-black text-sm uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                >
                  Speichern
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer Text */}
      <footer className="mt-auto py-8 text-center opacity-20 pointer-events-none">
        <p className="text-[9px] font-medium tracking-widest uppercase text-gray-500">
          Pro Bowling Analysis provided by Christoph Heiming
        </p>
      </footer>

      {/* HIDDEN PDF GENERATION TEMPLATE */}
      <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
        <div ref={reportRef}>
          {/* SEITE 1 */}
          <div className="pdf-page">
            <div className="flex justify-between items-end border-b-4 border-[#1a3a5f] pb-4 mb-8">
              <div className="text-sm font-bold uppercase">{tournamentName || "Bowling Analyse"}</div>
              <div className="text-4xl font-black">{playerName || "Player Report"}</div>
              <div className="text-sm">{new Date().toLocaleDateString("de-DE")}</div>
            </div>
            <div className="grid grid-cols-4 gap-4 mb-10">
              <div className="bg-[#f4f7fa] p-4 text-center border border-[#d1d9e6] rounded-xl">
                <span className="text-[10px] font-bold uppercase text-[#5c6b80]">Schnitt Ø</span>
                <strong className="block text-2xl text-[#1a3a5f]">{stats?.avg}</strong>
              </div>
              <div className="bg-[#f4f7fa] p-4 text-center border border-[#d1d9e6] rounded-xl">
                <span className="text-[10px] font-bold uppercase text-[#5c6b80]">Strikes</span>
                <strong className="block text-2xl text-[#1a3a5f]">{stats?.strikeRate}%</strong>
              </div>
              <div className="bg-[#f4f7fa] p-4 text-center border border-[#d1d9e6] rounded-xl">
                <span className="text-[10px] font-bold uppercase text-[#5c6b80]">Closed</span>
                <strong className="block text-2xl text-[#1a3a5f]">{stats?.closedRate}%</strong>
              </div>
              <div className="bg-[#f4f7fa] p-4 text-center border border-[#d1d9e6] rounded-xl">
                <span className="text-[10px] font-bold uppercase text-[#5c6b80]">High Game</span>
                <strong className="block text-2xl text-[#1a3a5f]">{stats?.max}</strong>
              </div>
            </div>
            <h3 className="text-lg font-black text-[#1a3a5f] border-l-8 border-[#1a3a5f] pl-4 mb-6 uppercase">Turnier Verlauf</h3>
            <div className="grid grid-cols-2 gap-8 mb-10">
              <div className="p-4 text-center border rounded-2xl" style={{ backgroundColor: 'white', borderColor: '#e5e7eb' }}>
                <h4 className="text-[10px] font-bold uppercase mb-4 flex items-center gap-2" style={{ color: '#9ca3af' }}>
                  <TrendingUp size={12} /> Score Trend
                </h4>
                <div style={{ width: '100%', height: 180 }}>
                  <BarChart width={300} height={180} data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                    <Bar dataKey="score" fill="#1a3a5f" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </div>
              </div>
              <div className="p-4 border rounded-2xl" style={{ backgroundColor: 'white', borderColor: '#e5e7eb' }}>
                <h4 className="text-[10px] font-bold uppercase mb-4 flex items-center gap-2" style={{ color: '#9ca3af' }}>
                  <PieChartIcon size={12} /> Frame Verteilung
                </h4>
                <div style={{ width: '100%', height: 180, display: 'flex', alignItems: 'center' }}>
                  <PieChart width={150} height={180}>
                    <Pie
                      data={distributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {distributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                  <div className="flex flex-col gap-2 ml-4">
                    {distributionData.map((d, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }}></div>
                        <span className="text-[9px] font-bold" style={{ color: '#4b5563' }}>{d.name}: {d.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {games.map(g => (
              <div key={g.id} className="mb-6 border border-[#1a3a5f] rounded-xl overflow-hidden shadow-sm">
                <div className="px-4 py-1 text-[10px] font-bold flex justify-between" style={{ backgroundColor: '#1a3a5f', color: 'white' }}>
                  <span>{g.name}</span>
                  <span>{g.totalScore} PINS</span>
                </div>
                <div className="grid grid-cols-11 text-center">
                  {[...Array(10)].map((_,i) => <div key={i} className="py-1 text-[8px] border-r font-bold" style={{ backgroundColor: '#f9fafb', borderColor: '#e5e7eb', color: '#9ca3af' }}>{i+1}</div>)}
                  <div className="py-1 text-[8px] font-bold" style={{ backgroundColor: '#f3f4f6', color: '#9ca3af' }}>SUM</div>
                  {g.frames.map((f, i) => {
                    const scoreAtFrame = g.frameScores[i];
                    return (
                      <div key={i} className="border-r flex flex-col h-14" style={{ borderColor: '#f3f4f6' }}>
                        <div className="flex-1 flex items-center justify-center font-black text-sm">
                          {f.includes('X') ? <span style={{ color: '#2563eb' }}>X</span> : f.includes('/') ? <span style={{ color: '#16a34a' }}>{f}</span> : f}
                        </div>
                        <div className="py-1 text-[9px] font-bold text-[#1a3a5f] border-t" style={{ backgroundColor: 'rgba(249, 250, 251, 0.5)', borderColor: '#f3f4f6' }}>
                          {scoreAtFrame}
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-center font-black text-lg text-[#1a3a5f]" style={{ backgroundColor: '#f4f7fa' }}>
                    {g.totalScore}
                  </div>
                </div>
                {(g.oilPattern || g.line || g.ball || g.manualNotes) && (
                  <div className="p-3 bg-white border-t border-[#f3f4f6] grid grid-cols-3 gap-4">
                    {g.oilPattern && (
                      <div className="space-y-1">
                        <span className="text-[7px] font-bold uppercase text-gray-400 block">Ölbild</span>
                        <span className="text-[10px] font-bold text-[#1a3a5f]">{g.oilPattern}</span>
                      </div>
                    )}
                    {g.line && (
                      <div className="space-y-1">
                        <span className="text-[7px] font-bold uppercase text-gray-400 block">Linie</span>
                        <span className="text-[10px] font-bold text-[#1a3a5f]">{g.line}</span>
                      </div>
                    )}
                    {g.ball && (
                      <div className="space-y-1">
                        <span className="text-[7px] font-bold uppercase text-gray-400 block">Ball</span>
                        <span className="text-[10px] font-bold text-[#1a3a5f]">{g.ball}</span>
                      </div>
                    )}
                    {g.manualNotes && (
                      <div className="col-span-3 space-y-1 border-t border-[#f3f4f6] pt-2 mt-1">
                        <span className="text-[7px] font-bold uppercase text-gray-400 block">Kommentare</span>
                        <p className="text-[10px] text-[#1a3a5f] leading-tight">{g.manualNotes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div className="mt-12 p-8 border rounded-3xl" style={{ backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }}>
              <h3 className="text-lg font-black mb-3">Management Summary</h3>
              <p className="text-sm leading-relaxed text-justify">
                {playerName} zeigt bei einer Strike-Quote von {stats?.strikeRate}% eine enorme Anwurfkraft. Die Differenz zwischen den hohen Anwürfen und dem finalen Schnitt von {stats?.avg} deutet auf ungenutzte Reserven im Räumspiel hin. Durch ein konsequentes Spare-System lässt sich der Turnierschnitt kurzfristig signifikant steigern.
              </p>
            </div>
            {/* Footer for PDF */}
            <div className="absolute bottom-10 left-0 right-0 text-center opacity-30">
              <p className="text-[8px] font-medium tracking-widest uppercase text-gray-400">
                Pro Bowling Analysis provided by Christoph Heiming
              </p>
            </div>
          </div>
          <div className="html2pdf__page-break"></div>
          {/* SEITE 2 */}
          <div className="pdf-page">
            <div className="flex justify-between items-center border-b-2 pb-4 mb-10" style={{ borderColor: '#e5e7eb' }}>
              <div className="text-xl font-black uppercase tracking-tighter" style={{ color: '#d1d5db' }}>Leistungsdiagnostik & Coaching</div>
              <div className="text-sm font-bold">{playerName}</div>
            </div>
            <h3 className="text-lg font-black text-[#1a3a5f] border-l-8 border-[#1a3a5f] pl-4 mb-8 uppercase">🔍 Experten-Audit</h3>
            <div className="space-y-8 mb-12">
              <div className="pl-4 border-l" style={{ borderColor: '#e5e7eb' }}>
                <h4 className="font-bold text-[#1a3a5f] uppercase text-xs">Technische Beobachtung</h4>
                <p className="text-sm mt-2 leading-relaxed text-justify" style={{ color: '#4b5563' }}>Deine Fähigkeit, Strike-Ketten zu bilden, beweist ein technisch hohes Deckenniveau. Die Ballabgabe ist stabil, was zu einem exzellenten Eintrittswinkel führt.</p>
              </div>
              <div className="pl-4 border-l" style={{ borderColor: '#e5e7eb' }}>
                <h4 className="font-bold text-[#1a3a5f] uppercase text-xs">Bahn-Management</h4>
                <p className="text-sm mt-2 leading-relaxed text-justify" style={{ color: '#4b5563' }}>Die Analyse der Serie über {games.length} Spiele zeigt, dass die Reaktion auf Bahnveränderungen (Transition) meist erst nach einem Open Frame erfolgt. Hier liegt ein strategischer Hebel von etwa 15 Pins pro Spiel.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-8 mb-12">
              <div className="p-6 border rounded-3xl" style={{ borderColor: '#bbf7d0', backgroundColor: '#f0fdf4' }}>
                <h4 className="font-bold mb-3 uppercase text-[10px]" style={{ color: '#166534' }}>Stärken</h4>
                <ul className="text-xs space-y-2" style={{ color: '#15803d' }}>
                  <li>• Präzision beim Anwurf</li>
                  <li>• Hohe Ballgeschwindigkeit</li>
                  <li>• Ausdauer über lange Serien</li>
                </ul>
              </div>
              <div className="p-6 border rounded-3xl" style={{ borderColor: '#fecaca', backgroundColor: '#fef2f2' }}>
                <h4 className="font-bold mb-3 uppercase text-[10px]" style={{ color: '#991b1b' }}>Potenziale</h4>
                <ul className="text-xs space-y-2" style={{ color: '#b91c1c' }}>
                  <li>• Spare-Routine Eckpins</li>
                  <li>• Proaktives Adjustment</li>
                  <li>• Mentaler Reset-Prozess</li>
                </ul>
              </div>
            </div>
            <h3 className="text-lg font-black text-[#1a3a5f] border-l-8 border-[#1a3a5f] pl-4 mb-8 uppercase">📋 Trainings-Schwerpunkte</h3>
            <div className="p-8 border rounded-3xl" style={{ backgroundColor: '#f0f7ff', borderColor: '#d0e3ff' }}>
              <div className="grid grid-cols-2 gap-10">
                <div>
                  <strong className="text-[#1a3a5f] text-sm block mb-2 uppercase">A: Spare-Automatisierung</strong>
                  <p className="text-xs leading-relaxed italic" style={{ color: '#4b5563' }}>Drill: 30 Min nur auf Pin 7 und 10 zielen. Ziel: 10 Treffer in Folge pro Seite mit dem Kunststoffwurf.</p>
                </div>
                <div>
                  <strong className="text-[#1a3a5f] text-sm block mb-2 uppercase">B: Lane Reading</strong>
                  <p className="text-xs leading-relaxed italic" style={{ color: '#4b5563' }}>Drill: Proaktives Wandern. Nach 2 "hohen" Treffern sofort 2 Bretter nach links versetzen.</p>
                </div>
              </div>
              <div className="mt-10 pt-6 border-t text-center" style={{ borderColor: '#bfdbfe' }}>
                <em className="text-sm font-bold" style={{ color: '#1e3a8a' }}>Schnitt-Ziel für die nächste Serie: {">"}185 Pins.</em>
              </div>
            </div>
            {/* Footer for PDF */}
            <div className="absolute bottom-10 left-0 right-0 text-center opacity-30">
              <p className="text-[8px] font-medium tracking-widest uppercase text-gray-400">
                Pro Bowling Analysis provided by Christoph Heiming
              </p>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

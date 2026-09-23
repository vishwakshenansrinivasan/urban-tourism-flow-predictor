import React, { useEffect, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Clock, CloudSun, CloudRain } from 'lucide-react';

export default function ForecastSlider({
  selectedHour = 1,
  onChangeHour,
  maxHours = 48,
  sampleForecastPoint = null
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1); // 1x, 2x, 4x

  // Auto-play interval
  useEffect(() => {
    let interval = null;
    if (isPlaying) {
      interval = setInterval(() => {
        onChangeHour((prev) => (prev >= maxHours ? 1 : prev + 1));
      }, 1200 / speed);
    }
    return () => clearInterval(interval);
  }, [isPlaying, speed, maxHours, onChangeHour]);

  // Format time label from sampleForecastPoint
  const formatTimeLabel = () => {
    if (!sampleForecastPoint?.forecast_timestamp) {
      return `Hour +${selectedHour}`;
    }
    const d = new Date(sampleForecastPoint.forecast_timestamp);
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${dayName}, ${timeStr} (+${selectedHour}h)`;
  };

  const weatherCond = sampleForecastPoint?.weather_condition || 'Clear';
  const tempC = sampleForecastPoint?.temp_c ?? 15;

  return (
    <div className="glass-panel border-t border-white/10 px-6 py-3.5 z-20">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Playback Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onChangeHour((prev) => Math.max(1, prev - 1))}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            title="Previous Hour"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`p-2.5 rounded-xl font-bold flex items-center gap-2 transition cursor-pointer shadow-lg ${
              isPlaying
                ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20'
                : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-cyan-500/20'
            }`}
            title={isPlaying ? 'Pause Simulation' : 'Play 48h Forecast Timeline'}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            <span className="text-xs">{isPlaying ? 'PAUSE' : 'PLAY'}</span>
          </button>

          <button
            onClick={() => onChangeHour((prev) => Math.min(maxHours, prev + 1))}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            title="Next Hour"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          {/* Speed Toggle */}
          <button
            onClick={() => setSpeed((prev) => (prev === 1 ? 2 : prev === 2 ? 4 : 1))}
            className="px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-mono font-bold cursor-pointer transition"
            title="Playback Speed"
          >
            {speed}x
          </button>
        </div>

        {/* Scrubber Slider */}
        <div className="flex-1 w-full flex flex-col gap-1 px-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span className="text-cyan-400 font-bold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatTimeLabel()}
            </span>
            <span>Horizon: {selectedHour} / {maxHours} hrs</span>
          </div>

          <div className="relative flex items-center">
            <input
              id="forecast-hour-slider"
              aria-label="48-hour Forecast Scrubber"
              type="range"
              min="1"
              max={maxHours}
              value={selectedHour}
              onChange={(e) => {
                setIsPlaying(false);
                onChangeHour(Number(e.target.value));
              }}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
          </div>

          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>Now (+1h)</span>
            <span>+12h</span>
            <span>+24h (Tomorrow)</span>
            <span>+36h</span>
            <span>+48h Horizon</span>
          </div>
        </div>

        {/* Forecast Weather Capsule for Selected Hour */}
        <div className="hidden lg:flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl border border-slate-700/60 bg-slate-900/60 text-xs">
          {weatherCond.toLowerCase().includes('rain') ? (
            <CloudRain className="w-4 h-4 text-cyan-400 shrink-0 animate-bounce" />
          ) : (
            <CloudSun className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <div>
            <div className="font-bold text-slate-200">{tempC}°C • {weatherCond}</div>
            <div className="text-[10px] text-slate-400 font-mono">Coastal SF Weather</div>
          </div>
        </div>
      </div>
    </div>
  );
}

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

  useEffect(() => {
    let interval = null;
    if (isPlaying) {
      interval = setInterval(() => {
        onChangeHour((prev) => (prev >= maxHours ? 1 : prev + 1));
      }, 1200 / speed);
    }
    return () => clearInterval(interval);
  }, [isPlaying, speed, maxHours, onChangeHour]);

  const formatTimeLabel = () => {
    if (!sampleForecastPoint?.forecast_timestamp) return `Horizon +${selectedHour}h`;
    const d = new Date(sampleForecastPoint.forecast_timestamp);
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${dayName} · ${timeStr} (+${selectedHour}h)`;
  };

  const weatherCond = sampleForecastPoint?.weather_condition || 'Clear';
  const tempC = sampleForecastPoint?.temp_c ?? 15;
  const progress = ((selectedHour - 1) / (maxHours - 1)) * 100;

  return (
    <div className="bg-white border-t border-slate-200 px-6 py-3.5 z-20 shadow-xs">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">

        {/* Playback Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onChangeHour((prev) => Math.max(1, prev - 1))}
            className="p-2 rounded-lg btn-secondary text-slate-600 hover:text-slate-900 cursor-pointer"
            title="Previous Hour"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`px-3.5 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition cursor-pointer text-xs ${
              isPlaying
                ? 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100'
                : 'btn-primary'
            }`}
            title={isPlaying ? 'Pause Simulation' : 'Play 48h Forecast Timeline'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
          </button>

          <button
            onClick={() => onChangeHour((prev) => Math.min(maxHours, prev + 1))}
            className="p-2 rounded-lg btn-secondary text-slate-600 hover:text-slate-900 cursor-pointer"
            title="Next Hour"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setSpeed((prev) => (prev === 1 ? 2 : prev === 2 ? 4 : 1))}
            className="px-2.5 py-1.5 rounded-lg btn-secondary text-slate-700 text-xs font-mono font-semibold cursor-pointer"
            title="Playback Speed"
          >
            {speed}×
          </button>
        </div>

        {/* Scrubber */}
        <div className="flex-1 w-full flex flex-col gap-1.5 px-2">
          <div className="flex items-center justify-between text-xs font-mono text-slate-500">
            <span className="text-indigo-600 font-semibold flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {formatTimeLabel()}
            </span>
            <span className="text-slate-400">
              {selectedHour} / {maxHours} hrs
            </span>
          </div>

          {/* Styled range track */}
          <div className="relative flex items-center">
            {/* Progress fill layer */}
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-indigo-600 pointer-events-none z-10 transition-all"
              style={{ width: `${progress}%` }}
            />
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
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer relative z-20 bg-slate-200"
            />
          </div>

          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>Now</span>
            <span>+12h</span>
            <span>+24h</span>
            <span>+36h</span>
            <span>+48h</span>
          </div>
        </div>

        {/* Weather Capsule */}
        <div className="hidden lg:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
          {weatherCond.toLowerCase().includes('rain') ? (
            <CloudRain className="w-4 h-4 text-blue-500 shrink-0" />
          ) : (
            <CloudSun className="w-4 h-4 text-amber-500 shrink-0" />
          )}
          <div>
            <div className="font-semibold text-slate-800">{tempC}°C &nbsp;·&nbsp; {weatherCond}</div>
            <div className="text-[10px] text-slate-400 font-mono tracking-wide">CHENNAI TROPICAL</div>
          </div>
        </div>
      </div>
    </div>
  );
}

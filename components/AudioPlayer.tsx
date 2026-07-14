import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Volume2, AlertCircle } from 'lucide-react';

interface AudioPlayerProps {
  src?: string;
  onTimeUpdate?: (currentTime: number) => void;
  onDurationChange?: (duration: number) => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, onTimeUpdate, onDurationChange }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Reset state when src changes
    setIsPlaying(false);
    setProgress(0);
    setDuration(0);
    setError(false);
    if (audioRef.current) {
      audioRef.current.load();
    }
  }, [src]);

  if (!src) {
    return (
      <div className="flex items-center p-4 bg-gray-100 rounded-lg text-gray-500 text-sm">
        <Volume2 className="w-5 h-5 mr-2 opacity-50" />
        该文章暂无音频。
      </div>
    );
  }

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => setError(true));
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const currentTime = audioRef.current.currentTime;
      setProgress(currentTime);
      // 通知父组件当前播放时间
      if (onTimeUpdate) {
        onTimeUpdate(currentTime);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const audioDuration = audioRef.current.duration;
      setDuration(audioDuration);
      setError(false);
      // 通知父组件音频时长
      if (onDurationChange) {
        onDurationChange(audioDuration);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress(time);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  if (error) {
    return (
      <div className="flex items-center p-4 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
        <AlertCircle className="w-5 h-5 mr-2" />
        无法加载音频文件。
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm w-full">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        onError={() => setError(true)}
      />
      
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={togglePlay}
          className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-md"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
        </button>

        <div className="flex-grow flex flex-col justify-center">
          <input
            type="range"
            min="0"
            max={duration || 100}
            value={progress}
            onChange={handleSeek}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1 font-medium">
            <span>{formatTime(progress)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <button
          onClick={() => {
            if (audioRef.current) {
              audioRef.current.currentTime = 0;
              setProgress(0);
            }
          }}
          className="p-2 text-slate-400 hover:text-indigo-600 transition"
          aria-label="Restart"
        >
          <RotateCcw size={20} />
        </button>
      </div>
    </div>
  );
};
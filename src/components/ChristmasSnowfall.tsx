import type { CSSProperties } from 'react';
import { usePublicChurchData } from '../context/ChurchDataContext';

interface SnowflakeSpec {
  id: number;
  left: number;
  size: number;
  duration: number;
  delay: number;
  sway: number;
  opacity: number;
  rotate: number;
  variant: 'crystal' | 'star' | 'mote';
}

const SNOWFLAKES: SnowflakeSpec[] = [
  { id: 1, left: 3, size: 18, duration: 15, delay: -4, sway: 26, opacity: 0.8, rotate: 240, variant: 'crystal' },
  { id: 2, left: 7, size: 7, duration: 19, delay: -11, sway: -18, opacity: 0.55, rotate: 0, variant: 'mote' },
  { id: 3, left: 11, size: 14, duration: 17, delay: -7, sway: 22, opacity: 0.72, rotate: -180, variant: 'star' },
  { id: 4, left: 15, size: 22, duration: 13, delay: -2, sway: -28, opacity: 0.84, rotate: 300, variant: 'crystal' },
  { id: 5, left: 19, size: 6, duration: 22, delay: -15, sway: 16, opacity: 0.48, rotate: 0, variant: 'mote' },
  { id: 6, left: 23, size: 16, duration: 16, delay: -9, sway: -20, opacity: 0.76, rotate: 210, variant: 'star' },
  { id: 7, left: 27, size: 8, duration: 20, delay: -5, sway: 18, opacity: 0.58, rotate: 0, variant: 'mote' },
  { id: 8, left: 31, size: 19, duration: 14, delay: -12, sway: 30, opacity: 0.82, rotate: -260, variant: 'crystal' },
  { id: 9, left: 35, size: 12, duration: 18, delay: -3, sway: -24, opacity: 0.68, rotate: 180, variant: 'star' },
  { id: 10, left: 39, size: 6, duration: 23, delay: -17, sway: 14, opacity: 0.46, rotate: 0, variant: 'mote' },
  { id: 11, left: 43, size: 17, duration: 15.5, delay: -8, sway: -26, opacity: 0.78, rotate: 220, variant: 'crystal' },
  { id: 12, left: 47, size: 7, duration: 21, delay: -13, sway: 20, opacity: 0.52, rotate: 0, variant: 'mote' },
  { id: 13, left: 51, size: 15, duration: 16.5, delay: -1, sway: 24, opacity: 0.74, rotate: -200, variant: 'star' },
  { id: 14, left: 55, size: 21, duration: 13.5, delay: -10, sway: -32, opacity: 0.85, rotate: 280, variant: 'crystal' },
  { id: 15, left: 59, size: 5, duration: 24, delay: -6, sway: 15, opacity: 0.44, rotate: 0, variant: 'mote' },
  { id: 16, left: 63, size: 13, duration: 17.5, delay: -14, sway: -22, opacity: 0.7, rotate: 190, variant: 'star' },
  { id: 17, left: 67, size: 8, duration: 19.5, delay: -4.5, sway: 18, opacity: 0.56, rotate: 0, variant: 'mote' },
  { id: 18, left: 71, size: 18, duration: 14.5, delay: -11.5, sway: 28, opacity: 0.8, rotate: -240, variant: 'crystal' },
  { id: 19, left: 75, size: 6, duration: 21.5, delay: -2.5, sway: -16, opacity: 0.5, rotate: 0, variant: 'mote' },
  { id: 20, left: 79, size: 15, duration: 16, delay: -8.5, sway: 22, opacity: 0.75, rotate: 210, variant: 'star' },
  { id: 21, left: 83, size: 20, duration: 14, delay: -13.5, sway: -26, opacity: 0.82, rotate: -290, variant: 'crystal' },
  { id: 22, left: 87, size: 7, duration: 20.5, delay: -6.5, sway: 16, opacity: 0.54, rotate: 0, variant: 'mote' },
  { id: 23, left: 91, size: 14, duration: 17, delay: -15.5, sway: -20, opacity: 0.72, rotate: 175, variant: 'star' },
  { id: 24, left: 95, size: 18, duration: 15, delay: -3.5, sway: 24, opacity: 0.78, rotate: -230, variant: 'crystal' },
  { id: 25, left: 9, size: 5, duration: 23.5, delay: -18, sway: -14, opacity: 0.45, rotate: 0, variant: 'mote' },
  { id: 26, left: 29, size: 13, duration: 18.5, delay: -16, sway: 20, opacity: 0.66, rotate: 200, variant: 'crystal' },
  { id: 27, left: 49, size: 6, duration: 22.5, delay: -7.5, sway: -18, opacity: 0.48, rotate: 0, variant: 'mote' },
  { id: 28, left: 69, size: 16, duration: 15.5, delay: -12.5, sway: 25, opacity: 0.76, rotate: -220, variant: 'crystal' },
  { id: 29, left: 89, size: 5, duration: 24, delay: -9.5, sway: -15, opacity: 0.42, rotate: 0, variant: 'mote' },
  { id: 30, left: 97, size: 12, duration: 18, delay: -5.5, sway: -18, opacity: 0.68, rotate: 185, variant: 'star' },
];

type SnowStyle = CSSProperties & {
  '--snow-sway': string;
  '--snow-rotate': string;
  '--snow-opacity': number;
};

export function ChristmasSnowfall() {
  const { activeTheme } = usePublicChurchData();

  if (activeTheme !== 'christmas') {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="christmas-snowfall fixed inset-0 pointer-events-none z-30 overflow-hidden select-none"
    >
      {SNOWFLAKES.map((flake) => {
        const style: SnowStyle = {
          left: `${flake.left}%`,
          width: `${flake.size}px`,
          height: `${flake.size}px`,
          animationDuration: `${flake.duration}s`,
          animationDelay: `${flake.delay}s`,
          '--snow-sway': `${flake.sway}px`,
          '--snow-rotate': `${flake.rotate}deg`,
          '--snow-opacity': flake.opacity,
        };

        return (
          <span key={flake.id} className="christmas-snowflake" style={style}>
            {flake.variant === 'mote' ? (
              <span className="block w-full h-full rounded-full bg-white/95 border border-[#1B4332]/20 shadow-[0_1px_4px_rgba(27,67,50,0.28)]" />
            ) : flake.variant === 'star' ? (
              <svg
                viewBox="0 0 24 24"
                className="w-full h-full drop-shadow-[0_1px_3px_rgba(27,67,50,0.3)]"
                fill="none"
              >
                <path
                  d="M12 2v20M3.34 7l17.32 10M20.66 7L3.34 17"
                  stroke="#FFFFFF"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                />
                <path
                  d="M12 2v20M3.34 7l17.32 10M20.66 7L3.34 17"
                  stroke="rgba(27,67,50,0.28)"
                  strokeWidth="0.7"
                  strokeLinecap="round"
                />
                <circle cx="12" cy="12" r="2.1" fill="#FFFFFF" stroke="rgba(27,67,50,0.25)" strokeWidth="0.6" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                className="w-full h-full drop-shadow-[0_1px_3px_rgba(27,67,50,0.32)]"
                fill="none"
              >
                <g stroke="#FFFFFF" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v20M3.34 7l17.32 10M20.66 7L3.34 17" />
                  <path d="M9.6 4.6L12 7l2.4-2.4M9.6 19.4L12 17l2.4 2.4" />
                  <path d="M5.4 5.5l1.1 3.2-3.2 1.1M18.6 18.5l-1.1-3.2 3.2-1.1" />
                  <path d="M18.6 5.5l-1.1 3.2 3.2 1.1M5.4 18.5l1.1-3.2-3.2-1.1" />
                </g>
                <g stroke="rgba(27,67,50,0.22)" strokeWidth="0.55" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v20M3.34 7l17.32 10M20.66 7L3.34 17" />
                </g>
              </svg>
            )}
          </span>
        );
      })}
    </div>
  );
}

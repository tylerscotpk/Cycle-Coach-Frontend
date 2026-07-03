/**
 * Decorative background with dot grid, dashed curves, X marks, circle outlines,
 * and diagonal stripe accents. Matches the Cycle Coach brand aesthetic.
 * Wrap page content inside this component.
 */
const AppBackground = ({ children, className = "" }) => {
  return (
    <div className={`min-h-screen relative overflow-hidden ${className}`} style={{ backgroundColor: '#0a0f2e' }}>
      {/* SVG decorative layer */}
      <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
          <defs>
            {/* Dot grid pattern */}
            <pattern id="dotgrid" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.2" fill="#22d3ee" opacity="0.25" />
            </pattern>

            {/* Diagonal stripes pattern */}
            <pattern id="diagstripes" x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="12" stroke="#0e7490" strokeWidth="2" opacity="0.15" />
            </pattern>
          </defs>

          {/* Dot grid cluster — upper left */}
          <rect x="0" y="0" width="220" height="200" fill="url(#dotgrid)" opacity="0.6" />
          {/* Fade the dot grid with a gradient mask */}
          <rect x="0" y="0" width="220" height="200" fill="url(#dotgrid)" opacity="0.4" style={{ mask: 'linear-gradient(135deg, black 30%, transparent 80%)' }} />

          {/* Dashed curved lines — scattered asymmetrically */}
          <path d="M 60 280 Q 200 150 400 300" fill="none" stroke="#0e7490" strokeWidth="1.5" strokeDasharray="8 6" opacity="0.2" />
          <path d="M -40 500 Q 250 350 500 520" fill="none" stroke="#22d3ee" strokeWidth="1" strokeDasharray="6 8" opacity="0.15" />
          <path d="M 1050 80 Q 1200 200 1420 120" fill="none" stroke="#0e7490" strokeWidth="1.5" strokeDasharray="10 6" opacity="0.18" />
          <path d="M 1275 480 Q 1125 640 1420 720" fill="none" stroke="#22d3ee" strokeWidth="1" strokeDasharray="6 10" opacity="0.12" />

          {/* X marks — scattered at varying sizes */}
          <g opacity="0.18" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round">
            {/* Upper area */}
            <g transform="translate(85, 40)"><line x1="-6" y1="-6" x2="6" y2="6" /><line x1="6" y1="-6" x2="-6" y2="6" /></g>
            <g transform="translate(45, 100)"><line x1="-4" y1="-4" x2="4" y2="4" /><line x1="4" y1="-4" x2="-4" y2="4" /></g>
            <g transform="translate(300, 80)"><line x1="-8" y1="-8" x2="8" y2="8" /><line x1="8" y1="-8" x2="-8" y2="8" /></g>
            {/* Mid area */}
            <g transform="translate(150, 450)"><line x1="-5" y1="-5" x2="5" y2="5" /><line x1="5" y1="-5" x2="-5" y2="5" /></g>
            <g transform="translate(600, 300)"><line x1="-7" y1="-7" x2="7" y2="7" /><line x1="7" y1="-7" x2="-7" y2="7" /></g>
            <g transform="translate(900, 150)"><line x1="-5" y1="-5" x2="5" y2="5" /><line x1="5" y1="-5" x2="-5" y2="5" /></g>
          </g>

          {/* Percentage-based X marks for responsiveness */}
          <g opacity="0.15" stroke="#22d3ee" strokeWidth="1.2" strokeLinecap="round">
            <g transform="translate(1050, 160)"><line x1="-6" y1="-6" x2="6" y2="6" /><line x1="6" y1="-6" x2="-6" y2="6" /></g>
            <g transform="translate(1350, 320)"><line x1="-4" y1="-4" x2="4" y2="4" /><line x1="4" y1="-4" x2="-4" y2="4" /></g>
            <g transform="translate(300, 560)"><line x1="-7" y1="-7" x2="7" y2="7" /><line x1="7" y1="-7" x2="-7" y2="7" /></g>
          </g>

          {/* Circle outlines — scattered */}
          <circle cx="120" cy="320" r="6" fill="none" stroke="#94a3b8" strokeWidth="1" opacity="0.18" />
          <circle cx="350" cy="150" r="4" fill="none" stroke="#22d3ee" strokeWidth="1" opacity="0.2" />
          <circle cx="500" cy="400" r="8" fill="none" stroke="#94a3b8" strokeWidth="1" opacity="0.15" />
          <circle cx="750" cy="200" r="5" fill="none" stroke="#22d3ee" strokeWidth="1" opacity="0.2" />
          <circle cx="200" cy="600" r="7" fill="none" stroke="#94a3b8" strokeWidth="1" opacity="0.15" />
          <circle cx="850" cy="500" r="4" fill="none" stroke="#22d3ee" strokeWidth="1" opacity="0.18" />
          <circle cx="650" cy="100" r="6" fill="none" stroke="#94a3b8" strokeWidth="1" opacity="0.15" />

          {/* Diagonal stripe accent — bottom left corner */}
          <rect x="0" y="680" width="180" height="120" fill="url(#diagstripes)" opacity="0.5" />

          {/* Diagonal stripe accent — bottom right corner */}
          <rect x="1275" y="640" width="225" height="160" fill="url(#diagstripes)" opacity="0.4" />
        </svg>
      </div>

      {/* Content layer */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

export default AppBackground;

import { motion } from "framer-motion";

export default function TrafficScoutLogo({ compact = false, className = "" }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative"
      >
        <svg
          width={compact ? 34 : 40}
          height={compact ? 34 : 40}
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-[0_10px_18px_rgba(23,127,100,0.18)]"
        >
          <defs>
            <linearGradient id="traffic-scout-gradient" x1="4" y1="6" x2="34" y2="34" gradientUnits="userSpaceOnUse">
              <stop stopColor="#1777F6" />
              <stop offset="1" stopColor="#2EC671" />
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="36" height="36" rx="14" fill="url(#traffic-scout-gradient)" />
          <path
            d="M10 27C13.5 22.2 17.8 18 24.2 16.8C28.3 16 30.8 13.5 31 10"
            stroke="white"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="10" cy="27" r="3.1" fill="white" />
          <circle cx="24.5" cy="16.5" r="2.7" fill="white" fillOpacity="0.92" />
          <circle cx="31" cy="10" r="2.5" fill="white" fillOpacity="0.82" />
        </svg>
      </motion.div>
      <div className="min-w-0">
        <p className={`font-bold tracking-tight text-[#091E31] ${compact ? "text-lg" : "text-xl"}`}>TrafficScout</p>
      </div>
    </div>
  );
}

import { motion } from "framer-motion";

const getScoreColor = (score) => {
  if (score >= 80) return "text-green-500";
  if (score >= 60) return "text-chart-2";
  if (score >= 40) return "text-yellow-500";
  return "text-destructive";
};

const getScoreLabel = (score) => {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Moderate";
  return "Low";
};

export default function TrafficScoreGauge({ score }) {
  const circumference = 2 * Math.PI * 54;
  const progress = (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle
            cx="60" cy="60" r="54"
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="8"
          />
          <motion.circle
            cx="60" cy="60" r="54"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            className={getScoreColor(score)}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - progress }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className={`text-3xl font-bold ${getScoreColor(score)}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {score}
          </motion.span>
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
            / 100
          </span>
        </div>
      </div>
      <span className={`text-sm font-semibold ${getScoreColor(score)}`}>
        {getScoreLabel(score)}
      </span>
    </div>
  );
}
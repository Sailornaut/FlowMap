import { motion } from "framer-motion";

export default function TrafficScoutLogo({ compact = false, iconOnly = false, className = "" }) {
  const sizeClasses = iconOnly
    ? compact
      ? "h-10 w-10"
      : "h-12 w-12"
    : compact
      ? "h-12 w-[190px]"
      : "h-16 w-[260px]";

  return (
    <div className={`flex items-center ${className}`}>
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className={`relative overflow-hidden rounded-2xl ${sizeClasses}`}
      >
        <img
          src="/TrafficScoutLogo.png"
          alt="TrafficScout"
          className={`h-full w-full ${iconOnly ? "object-cover object-left" : "object-contain object-left"}`}
        />
      </motion.div>
    </div>
  );
}

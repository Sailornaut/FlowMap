import { motion } from "framer-motion";
import logoAsset from "@/assets/TrafficScoutLogo.png";

export default function TrafficScoutLogo({ compact = false, iconOnly = false, className = "" }) {
  const sizeClasses = iconOnly
    ? compact
      ? "h-12 w-12"
      : "h-14 w-14"
    : compact
      ? "h-14 w-[220px]"
      : "h-20 w-[320px]";

  return (
    <div className={`flex items-center ${className}`}>
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className={`relative overflow-hidden rounded-2xl ${sizeClasses}`}
      >
        <img
          src={logoAsset}
          alt="TrafficScout"
          className={`h-full w-full ${iconOnly ? "object-contain object-center" : "object-contain object-left"}`}
        />
      </motion.div>
    </div>
  );
}

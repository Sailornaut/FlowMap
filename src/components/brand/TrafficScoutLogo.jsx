import { motion } from "framer-motion";
import logoAsset from "@/assets/TrafficScoutLogo.png";
import logoMarkAsset from "@/assets/TSLogo.png";

const baseSizes = {
  compactIcon: { width: 48, height: 48 },
  icon: { width: 56, height: 56 },
  compactWordmark: { width: 220, height: 56 },
  wordmark: { width: 320, height: 80 },
};

export default function TrafficScoutLogo({
  compact = false,
  iconOnly = false,
  className = "",
  variant = "wordmark",
  scale = 1,
}) {
  const { width, height } = iconOnly
    ? compact
      ? baseSizes.compactIcon
      : baseSizes.icon
    : compact
      ? baseSizes.compactWordmark
      : baseSizes.wordmark;

  const logoSrc = variant === "mark" ? logoMarkAsset : logoAsset;

  return (
    <div className={`flex items-center ${className}`}>
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative overflow-hidden rounded-2xl"
        style={{ width: `${width * scale}px`, height: `${height * scale}px` }}
      >
        <img
          src={logoSrc}
          alt="TrafficScout"
          className={`h-full w-full ${iconOnly ? "object-contain object-center" : "object-contain object-left"}`}
        />
      </motion.div>
    </div>
  );
}

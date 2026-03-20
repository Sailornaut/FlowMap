import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";
import { useNavigation } from "@/lib/NavigationContext";

export default function PageTransition({ children }) {
  const location = useLocation();
  const { direction } = useNavigation();

  const variants = {
    initial: { x: `${direction * 100}%`, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit:    { x: `${direction * -40}%`, opacity: 0 },
  };

  return (
    <AnimatePresence mode="popLayout" initial={false} custom={direction}>
      <motion.div
        key={location.pathname}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ type: "tween", ease: [0.25, 0.46, 0.45, 0.94], duration: 0.28 }}
        className="absolute inset-0"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
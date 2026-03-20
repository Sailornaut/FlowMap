import { useNavigate } from "react-router-dom";
import { useNavigation } from "@/lib/NavigationContext";
import { ChevronLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * StackHeader — shows a back button when on a child route.
 * Pass `title` to override the header title.
 */
export default function StackHeader({ title, rightSlot }) {
  const navigate = useNavigate();
  const { isChildRoute } = useNavigation();

  return (
    <AnimatePresence>
      {isChildRoute && (
        <motion.header
          initial={{ y: -44, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -44, opacity: 0 }}
          transition={{ type: "tween", duration: 0.22 }}
          className="flex items-center gap-1 bg-card border-b border-border z-20 relative"
          style={{
            paddingTop: "env(safe-area-inset-top)",
            minHeight: "calc(44px + env(safe-area-inset-top))",
            paddingLeft: "4px",
            paddingRight: "12px",
          }}
        >
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-0.5 text-primary font-medium tap-target rounded-lg px-2"
            aria-label="Go back"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm">Back</span>
          </button>
          {title && (
            <h1 className="flex-1 text-center text-sm font-semibold truncate pr-16">
              {title}
            </h1>
          )}
          {rightSlot && <div className="ml-auto">{rightSlot}</div>}
        </motion.header>
      )}
    </AnimatePresence>
  );
}
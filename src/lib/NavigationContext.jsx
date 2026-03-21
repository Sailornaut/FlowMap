import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * Tracks navigation direction (push vs. pop) for stack-aware page transitions.
 * Also tracks the "active tab" so tab panes can be shown/hidden.
 */

const TAB_ROOTS = ["/app", "/dashboard", "/saved"];

function getTabRoot(pathname) {
  // Find the deepest matching tab root
  return TAB_ROOTS.find((t) => pathname === t || pathname.startsWith(t + "/")) || "/app";
}

const NavigationContext = createContext({
  direction: 1,           // 1 = forward/push, -1 = backward/pop
  activeTab: "/app",
  isChildRoute: false,
  goBack: () => {},
});

export function NavigationProvider({ children }) {
  const location = useLocation();
  const historyStack = useRef([location.pathname]);
  const [direction, setDirection] = useState(1);
  const [activeTab, setActiveTab] = useState(getTabRoot(location.pathname));

  useEffect(() => {
    const current = location.pathname;
    const stack = historyStack.current;
    const prev = stack[stack.length - 1];

    if (current === prev) return;

    const currentTab = getTabRoot(current);
    const prevTab = getTabRoot(prev);
    const isTabSwitch = currentTab !== prevTab;

    if (isTabSwitch) {
      // Tab switch — no slide animation direction needed, treat as forward
      setDirection(1);
      setActiveTab(currentTab);
      historyStack.current = [...stack, current];
    } else {
      // Within same tab stack
      const prevIndex = stack.lastIndexOf(current);
      if (prevIndex !== -1 && prevIndex < stack.length - 1) {
        // Going back to a route we've seen
        setDirection(-1);
        historyStack.current = stack.slice(0, prevIndex + 1);
      } else {
        setDirection(1);
        historyStack.current = [...stack, current];
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Is the current route a "child" (not a tab root)?
  const isChildRoute = !TAB_ROOTS.includes(location.pathname);

  return (
    <NavigationContext.Provider value={{ direction, activeTab, isChildRoute }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  return useContext(NavigationContext);
}

export { TAB_ROOTS };

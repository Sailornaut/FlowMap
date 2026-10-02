import { useEffect } from "react";

// Client-side navigation back to / exits the app and opens the public HTML entry.
export default function Landing() {
  useEffect(() => {
    window.location.replace("/");
  }, []);

  return <p className="p-6"><a href="/">Open the TrafficScout homepage</a></p>;
}

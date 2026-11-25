import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

/** Aviso persistente de modo offline (§7). */
export function BannerConexao() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  if (online) return null;
  return (
    <div
      role="alert"
      style={{
        position: "sticky", top: 0, zIndex: 40, display: "flex", alignItems: "center", gap: 8, justifyContent: "center",
        background: "#B24C3B", color: "#fff", padding: "9px 16px", fontSize: 13.5, fontWeight: 600,
      }}
    >
      <WifiOff size={16} /> Você está offline. As alterações podem não ter sido salvas.
    </div>
  );
}

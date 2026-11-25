import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { C } from "@/styles/tokens";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, children }: EmptyStateProps) {
  return (
    <div className="tv-card" style={{ padding: "48px 32px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
      <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#F4F1E6", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <Icon size={20} color={C.gold} />
      </div>
      <p style={{ fontSize: 15, fontWeight: 600, color: C.ink, margin: "0 0 6px", maxWidth: 420 }}>{title}</p>
      <p style={{ fontSize: 13, color: C.inkSoft, margin: 0, maxWidth: 420, lineHeight: 1.6 }}>{description}</p>
      {children}
    </div>
  );
}
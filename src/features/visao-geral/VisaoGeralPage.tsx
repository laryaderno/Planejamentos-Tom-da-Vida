import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Archive, BarChart3, Bell, GraduationCap, Users } from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { useUsuario } from "@/features/auth/AuthContext";
import { useEtapas, usePerfis, useTurmas } from "@/lib/consultas";
import { podeAprovar } from "@/lib/papeis";
import { useAtividades } from "@/features/atividades/api";
import { C } from "@/styles/tokens";

export function VisaoGeralPage() {
  const eu = useUsuario();
  const navigate = useNavigate();
  const etapas = useEtapas().data ?? [];
  const turmas = useTurmas().data ?? [];
  const perfis = usePerfis().data ?? [];
  const etapaCounts = etapas.map((e) => ({
    etapa: e.nome,
    curto: e.nome.replace("Ensino ", "").replace("Educação ", ""),
    count: turmas.filter((t) => t.etapa_id === e.id).length,
  }));
  const pendencias = perfis.filter((p) => p.status === "pendente" && podeAprovar(eu, p.papel, p.etapa_solicitada_id)).length;
  const professoresAtivos = perfis.filter((p) => p.status === "ativo" && p.papel === "professor").length;
  const totalAtividades = (useAtividades().data ?? []).filter((a) => a.status === "aprovada").length;

  return (
    <div>
      <p style={{ fontSize: 14, color: C.inkSoft, margin: "-8px 0 22px", maxWidth: 560, lineHeight: 1.6 }}>
        Olá, {eu.nome.split(" ")[0]}. Acompanhe suas turmas, sua equipe e o banco de atividades em um só lugar.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        <DashboardCard
          icon={GraduationCap}
          title="Turmas"
          description="Crie turmas e distribua professores entre elas."
          onClick={() => navigate("/turmas")}
        >
          <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
            {etapaCounts.map((e) => (
              <div key={e.etapa}>
                <p style={{ fontSize: 12.5, color: C.inkSoft, margin: "0 0 2px" }}>{e.curto}</p>
                <p className="tv-serif" style={{ fontSize: 22, fontWeight: 600, color: C.ink, margin: 0 }}>{e.count}</p>
              </div>
            ))}
          </div>
        </DashboardCard>

        <DashboardCard
          icon={BarChart3}
          title="Entregas no prazo"
          description="Exemplo — dados reais na Fase 5"
          onClick={() => navigate("/prazos")}
        >
          <p className="tv-serif" style={{ fontSize: 30, fontWeight: 600, color: C.ink, margin: "4px 0 8px" }}>78%</p>
          <div style={{ height: 6, borderRadius: 3, background: C.border, overflow: "hidden" }}>
            <div style={{ width: "78%", height: "100%", background: C.gold }} />
          </div>
          <p style={{ fontSize: 12.5, color: C.inkSoft, margin: "8px 0 0" }}>18 de 23 turmas com o planejamento em dia esta semana</p>
        </DashboardCard>

        <DashboardCard
          icon={Users}
          title="Professores"
          description={`${professoresAtivos} ${professoresAtivos === 1 ? "professor ativo" : "professores ativos"}`}
          onClick={() => navigate("/professores")}
        />

        <DashboardCard
          icon={Bell}
          title="Solicitações de cadastro"
          description={pendencias === 0 ? "Nenhum cadastro aguardando você" : "Cadastros aguardando sua aprovação"}
          badge={pendencias > 0 ? `${pendencias} ${pendencias === 1 ? "pendente" : "pendentes"}` : null}
          onClick={() => navigate("/notificacoes")}
        />

        <DashboardCard
          icon={Archive}
          title="Banco de atividades"
          description={`${totalAtividades} ${totalAtividades === 1 ? "atividade aprovada" : "atividades aprovadas"}`}
          onClick={() => navigate("/banco")}
        />
      </div>
    </div>
  );
}

interface DashboardCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  badge?: string | null;
  onClick?: () => void;
  children?: ReactNode;
}

function DashboardCard({ icon: Icon, title, description, badge, onClick, children }: DashboardCardProps) {
  return (
    <div
      className="tv-card tv-dashboard-card"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick?.()}
      style={{ padding: 22, cursor: onClick ? "pointer" : "default" }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ width: 42, height: 42, borderRadius: 10, background: "#F4E7CE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={19} color={C.goldDeep} />
        </div>
        {badge && (
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: C.red, background: "#F7E3DE", padding: "5px 10px", borderRadius: 999 }}>
            <AlertTriangle size={12} /> {badge}
          </span>
        )}
      </div>
      <p className="tv-serif" style={{ fontSize: 17, fontWeight: 600, color: C.ink, margin: "0 0 4px" }}>{title}</p>
      <p style={{ fontSize: 13, color: C.inkSoft, margin: "0 0 14px" }}>{description}</p>
      {children && <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>{children}</div>}
    </div>
  );
}

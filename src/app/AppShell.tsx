import { LogOut, UserCircle } from "lucide-react";
import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router";
import { BannerConexao } from "@/components/BannerConexao";
import { useUsuario } from "@/features/auth/AuthContext";
import { SincronizacaoProvider } from "@/lib/offline/SincronizacaoContext";
import { useSair } from "@/lib/offline/useSair";
import { useContadorNotificacoes } from "@/features/notificacoes/api";
import { ROTULO_PAPEL } from "@/lib/papeis";
import { C } from "@/styles/tokens";
import { LOGO_URL } from "./marca";
import { itensDoPapel, NAVEGACAO, podeAcessar } from "./navegacao";

/** Layout das telas internas; mantém a fila de alterações sendo enviada. */
export function AppShell() {
  return (
    <SincronizacaoProvider>
      <Moldura />
    </SincronizacaoProvider>
  );
}

function Moldura() {
  const usuario = useUsuario();
  const { pedirSaida, modal: modalSaida } = useSair();
  const { pathname } = useLocation();
  const titulo = NAVEGACAO.find((i) => pathname.startsWith(i.caminho))?.rotulo ?? "";
  const contador = useContadorNotificacoes();
  const itens = itensDoPapel(usuario.papel).filter((i) => i.caminho !== "/perfil");

  // Rota fora do menu do papel: volta para o início.
  if (!podeAcessar(usuario.papel, pathname)) return <Navigate to="/" replace />;


  return (
    <div className="tv-root tv-app-shell" style={{ display: "flex", minHeight: "100vh" }}>
      <aside
        className="tv-sidebar"
        style={{
          width: 232, background: C.sidebar, padding: "18px 12px", display: "flex",
          flexDirection: "column", flexShrink: 0, borderRight: `1px solid ${C.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px 20px" }}>
          <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#fff", border: `1px solid ${C.border}`, padding: 2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
            <img
              src={LOGO_URL}
              alt="Logo Escola Tom da Vida"
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          </div>
          <div style={{ minWidth: 0 }}>
            <p className="tv-serif" style={{ color: C.ink, fontSize: 15, fontWeight: 700, margin: 0, whiteSpace: "nowrap" }}>Tom da Vida</p>
            <p style={{ color: C.sideTextMuted, fontSize: 11.5, margin: 0 }}>Sistema de planejamento</p>
          </div>
        </div>

        <nav className="tv-sidebar-nav" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {itens.map((item) => {
            const Icon = item.icone;
            return (
              <NavLink
                key={item.caminho}
                to={item.caminho}
                className={({ isActive }) => `tv-nav-item ${isActive ? "active" : ""}`}
              >
                <Icon size={16} strokeWidth={2} style={{ flexShrink: 0 }} />
                <span style={{ whiteSpace: "nowrap" }}>{item.rotulo}</span>
                {item.contador && contador > 0 && (
                  <span
                    aria-label={`${contador} não lidas`}
                    style={{ marginLeft: "auto", minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, background: C.red, color: "#fff", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                  >
                    {contador > 99 ? "99+" : contador}
                  </span>
                )}
              </NavLink>
            );
          })}
          <NavLink to="/perfil" className={({ isActive }) => `tv-nav-item tv-nav-perfil ${isActive ? "active" : ""}`}>
            <UserCircle size={16} strokeWidth={2} style={{ flexShrink: 0 }} />
            <span style={{ whiteSpace: "nowrap" }}>Meu perfil</span>
          </NavLink>
        </nav>

        <div className="tv-sidebar-footer" style={{ marginTop: "auto", paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
          <button className="tv-nav-item" onClick={pedirSaida}>
            <LogOut size={16} strokeWidth={2} style={{ flexShrink: 0 }} />
            <span>Sair</span>
          </button>
        </div>
      </aside>


      <main className="tv-scroll" style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
        <BannerConexao />
        <header
          className="tv-topo"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "16px 36px", background: "#fff", borderBottom: `1px solid ${C.border}` }}
        >
          <h1 className="tv-serif" style={{ fontSize: 19, fontWeight: 600, color: C.ink, margin: 0 }}>{titulo}</h1>
          <Link to="/perfil" title="Meu perfil" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", minWidth: 0 }}>
            <span style={{ textAlign: "right", minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{usuario.nome}</span>
              <span style={{ display: "block", fontSize: 11.5, color: C.inkSoft }}>{ROTULO_PAPEL[usuario.papel]}</span>
            </span>
            <span style={{ width: 32, height: 32, borderRadius: "50%", background: C.primary, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
              {usuario.nome[0] ?? "?"}
            </span>
          </Link>
        </header>
        <div className="tv-conteudo" style={{ padding: "28px 36px 30px" }}>
          <Outlet />
        </div>
      </main>
      {modalSaida}
    </div>
  );
}

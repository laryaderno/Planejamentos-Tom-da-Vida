import { useState } from "react";
import {
  LayoutGrid, GraduationCap, Users, Bell, CalendarDays, BookOpen,
  Archive, Plus, X, Eye, EyeOff, LogOut, ChevronDown, ChevronRight,
  Pencil, Trash2, BarChart3, AlertTriangle, Folder, ArrowLeft,
  Check, ArrowRight,
} from "lucide-react";

const C = {
  ink: "#1E2A28",
  inkSoft: "#54615C",
  paper: "#F1EEE2",
  card: "#FCFBF6",
  border: "#DBD5C2",
  sidebar: "#173130",
  sidebarSoft: "#20403E",
  sideText: "#CBD8D2",
  sideTextMuted: "#88A19A",
  gold: "#BD8236",
  goldDeep: "#9C6B29",
  sage: "#6C8A63",
  amber: "#C99A3C",
  red: "#B24C3B",
};

const ETAPAS = [
  "Educação Infantil",
  "Ensino Fundamental I",
  "Ensino Fundamental II",
  "Ensino Médio",
];

const INITIAL_TURMAS = [
  { id: 1, etapa: "Educação Infantil", nome: "Berçário", turno: "Matutino", professores: 2 },
  { id: 2, etapa: "Educação Infantil", nome: "Maternal", turno: "Matutino", professores: 2 },
  { id: 3, etapa: "Educação Infantil", nome: "Jardim 1", turno: "Matutino", professores: 3 },
  { id: 4, etapa: "Educação Infantil", nome: "Jardim 2", turno: "Vespertino", professores: 3 },
  { id: 5, etapa: "Ensino Fundamental I", nome: "1º Ano A", turno: "Matutino", professores: 4 },
  { id: 6, etapa: "Ensino Fundamental I", nome: "2º Ano A", turno: "Matutino", professores: 4 },
  { id: 7, etapa: "Ensino Fundamental II", nome: "6º Ano A", turno: "Vespertino", professores: 6 },
  { id: 8, etapa: "Ensino Médio", nome: "1ª Série A", turno: "Vespertino", professores: 7 },
];

const PROFESSORES = [
  { nome: "Marina Alves", turmas: "Jardim 1", email: "marina.alves@escolatomdavida.com.br" },
  { nome: "Carlos Eduardo Souza", turmas: "Jardim 2, Maternal", email: "carlos.souza@escolatomdavida.com.br" },
  { nome: "Beatriz Lima", turmas: "1º Ano A", email: "beatriz.lima@escolatomdavida.com.br" },
  { nome: "Renata Prado", turmas: "6º Ano A (Inglês)", email: "renata.prado@escolatomdavida.com.br" },
];

const SOLICITACOES_PENDENTES = [
  { nome: "Renata Prado", perfil: "Coordenador", escopo: "Educação Infantil", data: "28/08/2026" },
  { nome: "João Silva", perfil: "Professor", escopo: "2º Ano A — Ensino Fundamental I", data: "30/08/2026" },
];

// Repositório de atividades aprovadas por turma (seção 5.6), organizado em pastas por tema.
// Chave = id da turma em INITIAL_TURMAS.
const ATIVIDADES_POR_TURMA = {
  3: {
    pastas: [
      {
        tema: "Rotina e Acolhida",
        atividades: [
          { titulo: "Roda de conversa com caixa surpresa", propostaPor: "Marina Alves", aprovadaPor: "Coord. Renata Prado", data: "12/08/2026" },
          { titulo: "Música de boas-vindas com instrumentos", propostaPor: "Marina Alves", aprovadaPor: "Adm. Rodolfo Santos", data: "03/07/2026" },
        ],
      },
      {
        tema: "Linguagem e Comunicação",
        atividades: [
          { titulo: "Contação de história com fantoches", propostaPor: "Marina Alves", aprovadaPor: "Coord. Renata Prado", data: "20/08/2026" },
        ],
      },
      {
        tema: "Matemática e Raciocínio Lógico",
        atividades: [
          { titulo: "Classificação de blocos por cor e tamanho", propostaPor: "Marina Alves", aprovadaPor: "Coord. Renata Prado", data: "05/08/2026" },
          { titulo: "Contagem com sementes e potinhos", propostaPor: "Marina Alves", aprovadaPor: "Adm. Rodolfo Santos", data: "22/07/2026" },
        ],
      },
      { tema: "Artes e Expressão", atividades: [] },
    ],
  },
  5: {
    pastas: [
      {
        tema: "Língua Portuguesa",
        atividades: [
          { titulo: "Produção de texto coletivo sobre o final de semana", propostaPor: "Beatriz Lima", aprovadaPor: "Coord. Renata Prado", data: "18/08/2026" },
        ],
      },
      {
        tema: "Matemática",
        atividades: [
          { titulo: "Problemas de adição com material dourado", propostaPor: "Beatriz Lima", aprovadaPor: "Adm. Rodolfo Santos", data: "10/08/2026" },
        ],
      },
    ],
  },
};

function totalAtividadesAprovadas() {
  return Object.values(ATIVIDADES_POR_TURMA)
    .flatMap((t) => t.pastas)
    .reduce((sum, pasta) => sum + pasta.atividades.length, 0);
}

const NAV_ITEMS = [
  { id: "visao-geral", label: "Visão geral", icon: LayoutGrid },
  { id: "turmas", label: "Turmas", icon: GraduationCap },
  { id: "professores", label: "Professores", icon: Users },
  { id: "solicitacoes", label: "Solicitações", icon: Bell },
  { id: "prazos", label: "Prazos e ciclos", icon: CalendarDays },
  { id: "conteudo", label: "Conteúdo programático", icon: BookOpen },
  { id: "banco", label: "Banco de atividades", icon: Archive },
];

export default function App() {
  const [screen, setScreen] = useState("login");
  const [user, setUser] = useState(null);
  const [activePage, setActivePage] = useState("turmas");
  const [turmas, setTurmas] = useState(INITIAL_TURMAS);

  function handleLogin(email) {
    const namePart = email.split("@")[0].replace(/[.\-_]/g, " ");
    const name = namePart.replace(/\b\w/g, (c) => c.toUpperCase());
    setUser({ name, email });
    setScreen("app");
  }

  function handleLogout() {
    setUser(null);
    setScreen("login");
    setActivePage("turmas");
  }

  return (
    <div style={{ minHeight: "100vh", background: C.paper }}>
      <GlobalStyle />
      {screen === "login" ? (
        <LoginScreen onLogin={handleLogin} />
      ) : (
        <AppShell
          user={user}
          activePage={activePage}
          setActivePage={setActivePage}
          onLogout={handleLogout}
          turmas={turmas}
          setTurmas={setTurmas}
        />
      )}
    </div>
  );
}

/* ---------------------------- Global styles ---------------------------- */

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,450;9..144,560;9..144,650&family=Work+Sans:wght@400;500;600;700&display=swap');

      .tv-root, .tv-root * { box-sizing: border-box; font-family: 'Work Sans', sans-serif; }
      .tv-serif { font-family: 'Fraunces', serif; }

      .tv-input {
        width: 100%; padding: 10px 12px; border-radius: 7px;
        border: 1px solid ${C.border}; background: #fff; color: ${C.ink};
        font-size: 14px; outline: none; transition: border-color .15s, box-shadow .15s;
      }
      .tv-input:focus { border-color: ${C.gold}; box-shadow: 0 0 0 3px rgba(189,130,54,0.15); }
      .tv-input:disabled { background: #F3F1E8; color: ${C.inkSoft}; cursor: not-allowed; }

      .tv-btn {
        display: inline-flex; align-items: center; justify-content: center; gap: 6px;
        padding: 9px 16px; border-radius: 7px; font-size: 14px; font-weight: 600;
        cursor: pointer; border: 1px solid transparent; transition: filter .15s, background .15s;
      }
      .tv-btn:disabled { cursor: not-allowed; opacity: 0.55; }
      .tv-btn-primary { background: ${C.gold}; color: #fff; }
      .tv-btn-primary:hover:not(:disabled) { filter: brightness(1.06); }
      .tv-btn-secondary { background: transparent; color: ${C.ink}; border-color: ${C.border}; }
      .tv-btn-secondary:hover:not(:disabled) { background: #EFEAD9; }
      .tv-btn-text { background: transparent; color: ${C.gold}; padding: 4px 6px; }
      .tv-btn-text:hover:not(:disabled) { text-decoration: underline; }
      .tv-btn-text-danger { background: transparent; color: ${C.red}; padding: 4px 6px; }
      .tv-btn-text-danger:hover:not(:disabled) { text-decoration: underline; }

      .tv-nav-item {
        display: flex; align-items: center; gap: 10px; width: 100%;
        padding: 9px 14px; border-radius: 7px; color: ${C.sideText};
        font-size: 14px; font-weight: 500; cursor: pointer; border: none;
        background: transparent; text-align: left; position: relative;
      }
      .tv-nav-item:hover { background: ${C.sidebarSoft}; }
      .tv-nav-item.active { background: ${C.sidebarSoft}; color: #fff; }
      .tv-nav-item.active::before {
        content: ""; position: absolute; left: -14px; top: 8px; bottom: 8px; width: 3px;
        background: ${C.gold}; border-radius: 0 3px 3px 0;
      }

      .tv-card {
        background: ${C.card}; border: 1px solid ${C.border}; border-radius: 10px;
      }
      .tv-dashboard-card { transition: border-color .15s, transform .1s; }
      .tv-dashboard-card:hover, .tv-dashboard-card:focus-visible { border-color: ${C.gold}; }
      .tv-dashboard-card:active { transform: scale(0.99); }

      .tv-modal-overlay {
        position: fixed; inset: 0; background: rgba(23,49,48,0.45);
        display: flex; align-items: center; justify-content: center; z-index: 50;
        animation: tvFade .12s ease-out;
      }
      @keyframes tvFade { from { opacity: 0; } to { opacity: 1; } }
      .tv-modal {
        background: #fff; border-radius: 12px; width: 380px; max-width: 92vw;
        padding: 22px; box-shadow: 0 20px 50px rgba(23,49,48,0.25);
      }

      .tv-scroll::-webkit-scrollbar { width: 8px; }
      .tv-scroll::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }

      @media (max-width: 820px) {
        .tv-app-shell { flex-direction: column; }
        .tv-sidebar { width: 100% !important; flex-direction: row !important; overflow-x: auto; }
        .tv-sidebar-nav { flex-direction: row !important; gap: 4px; }
        .tv-nav-item.active::before { display: none; }
        .tv-sidebar-footer { display: none !important; }
      }
    `}</style>
  );
}

/* ------------------------------ Login screen ----------------------------- */

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [touched, setTouched] = useState(false);
  const [showCadastroNote, setShowCadastroNote] = useState(false);

  const valid = email.trim().length > 3 && senha.length >= 4;

  function submit(e) {
    e.preventDefault();
    setTouched(true);
    if (valid) onLogin(email.trim());
  }

  return (
    <div
      className="tv-root"
      style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: `radial-gradient(circle at 30% 20%, ${C.sidebarSoft} 0%, ${C.sidebar} 55%)`,
        padding: 24,
      }}
    >
      <form onSubmit={submit} className="tv-card" style={{ width: 380, maxWidth: "100%", padding: "34px 30px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 26 }}>
          <div
            style={{
              width: 52, height: 52, borderRadius: "50%", background: C.sidebar,
              display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14,
              overflow: "hidden",
            }}
          >
            <img
              src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSfGXjaZhtldcUfZFtIYOLeC6O-0SggF4qSA3fqNJ14G7NeWrsAUG0RrGHi&s=10"
              alt="Logo Escola Tom da Vida"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
          <h1 className="tv-serif" style={{ fontSize: 21, fontWeight: 600, color: C.ink, textAlign: "center", margin: 0 }}>
            Sistema de Planejamento de Aulas
          </h1>
          <p style={{ fontSize: 13, color: C.inkSoft, marginTop: 4 }}>Escola Tom da Vida</p>
        </div>

        <label style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>E-mail</label>
        <input
          className="tv-input"
          style={{ marginTop: 6, marginBottom: 16 }}
          type="email"
          placeholder="professor@escolatomdavida.com.br"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>Senha</label>
        <div style={{ position: "relative", marginTop: 6, marginBottom: 6 }}>
          <input
            className="tv-input"
            style={{ paddingRight: 40 }}
            type={showSenha ? "text" : "password"}
            placeholder="••••••••"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowSenha((s) => !s)}
            aria-label={showSenha ? "Ocultar senha" : "Mostrar senha"}
            style={{ position: "absolute", right: 10, top: 9, background: "none", border: "none", cursor: "pointer", color: C.inkSoft }}
          >
            {showSenha ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>

        {touched && !valid && (
          <p style={{ fontSize: 12.5, color: C.red, margin: "4px 0 8px" }}>
            Informe um e-mail válido e uma senha com pelo menos 4 caracteres.
          </p>
        )}

        <button type="submit" className="tv-btn tv-btn-primary" style={{ width: "100%", marginTop: 14, padding: "11px 16px" }}>
          Entrar
        </button>

        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button
            type="button"
            onClick={() => setShowCadastroNote((s) => !s)}
            style={{ background: "none", border: "none", fontSize: 13, color: C.inkSoft, cursor: "pointer", textDecoration: "underline" }}
          >
            Não tem conta? Cadastre-se
          </button>
          {showCadastroNote && (
            <p style={{ fontSize: 12, color: C.inkSoft, marginTop: 8 }}>
              O fluxo de cadastro fica pendente até a aprovação de um Diretor ou Coordenador (seção 3 da especificação).
            </p>
          )}
        </div>
      </form>
    </div>
  );
}

/* -------------------------------- App shell ------------------------------ */

function AppShell({ user, activePage, setActivePage, onLogout, turmas, setTurmas }) {
  const pageTitles = {
    "visao-geral": "Visão geral",
    turmas: "Turmas",
    professores: "Professores",
    solicitacoes: "Solicitações",
    prazos: "Prazos e ciclos",
    conteudo: "Conteúdo programático",
    banco: "Banco de atividades",
  };

  return (
    <div className="tv-root tv-app-shell" style={{ display: "flex", minHeight: "100vh" }}>
      <aside
        className="tv-sidebar"
        style={{
          width: 236, background: C.sidebar, padding: "22px 14px", display: "flex",
          flexDirection: "column", flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 12px 22px" }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: C.sidebarSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
            <img
              src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSfGXjaZhtldcUfZFtIYOLeC6O-0SggF4qSA3fqNJ14G7NeWrsAUG0RrGHi&s=10"
              alt="Logo Escola Tom da Vida"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
          <div style={{ minWidth: 0 }}>
            <p className="tv-serif" style={{ color: "#fff", fontSize: 15, fontWeight: 600, margin: 0, whiteSpace: "nowrap" }}>Tom da Vida</p>
            <p style={{ color: C.sideTextMuted, fontSize: 11.5, margin: 0 }}>Sistema de planejamento</p>
          </div>
        </div>

        <nav className="tv-sidebar-nav" style={{ display: "flex", flexDirection: "column", gap: 2, paddingLeft: 14 }}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`tv-nav-item ${activePage === item.id ? "active" : ""}`}
                onClick={() => setActivePage(item.id)}
              >
                <Icon size={16} strokeWidth={2} style={{ flexShrink: 0 }} />
                <span style={{ whiteSpace: "nowrap" }}>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="tv-sidebar-footer" style={{ marginTop: "auto", paddingTop: 18, borderTop: `1px solid ${C.sidebarSoft}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px" }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: C.gold, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
              {user?.name?.[0] ?? "?"}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ color: "#fff", fontSize: 13, fontWeight: 600, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                Adm. {user?.name}
              </p>
              <p style={{ color: C.sideTextMuted, fontSize: 11.5, margin: 0 }}>Administração</p>
            </div>
            <button onClick={onLogout} aria-label="Sair" style={{ background: "none", border: "none", color: C.sideTextMuted, cursor: "pointer", padding: 4 }}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className="tv-scroll" style={{ flex: 1, padding: "30px 36px", overflowY: "auto" }}>
        <h1 className="tv-serif" style={{ fontSize: 26, fontWeight: 600, color: C.ink, margin: "0 0 22px" }}>
          {pageTitles[activePage]}
        </h1>

        {activePage === "visao-geral" && <VisaoGeralPage turmas={turmas} setActivePage={setActivePage} />}
        {activePage === "turmas" && <TurmasPage turmas={turmas} setTurmas={setTurmas} />}
        {activePage === "professores" && <ProfessoresPage />}
        {activePage === "solicitacoes" && <SolicitacoesPage />}
        {activePage === "prazos" && <PrazosPage />}
        {activePage === "conteudo" && <ConteudoPage turmas={turmas} />}
        {activePage === "banco" && <BancoAtividadesPage turmas={turmas} />}
      </main>
    </div>
  );
}

/* ------------------------------ Visão geral ------------------------------ */

function VisaoGeralPage({ turmas, setActivePage }) {
  const etapaCounts = ETAPAS.map((etapa) => ({
    etapa,
    curto: etapa.replace("Ensino ", "").replace("Educação ", ""),
    count: turmas.filter((t) => t.etapa === etapa).length,
  }));
  const pendencias = SOLICITACOES_PENDENTES.length;
  const totalAtividades = totalAtividadesAprovadas();

  return (
    <div>
      <p style={{ fontSize: 14, color: C.inkSoft, margin: "-8px 0 22px", maxWidth: 560, lineHeight: 1.6 }}>
        Acompanhe suas turmas, sua equipe e o banco de atividades em um só lugar.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        <DashboardCard
          icon={GraduationCap}
          title="Turmas"
          description="Crie turmas e distribua professores entre elas."
          badge={pendencias > 0 ? `${pendencias} pendências` : null}
          onClick={() => setActivePage("turmas")}
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
          description="Atualizado hoje às 19:46"
          onClick={() => setActivePage("prazos")}
        >
          <p className="tv-serif" style={{ fontSize: 30, fontWeight: 600, color: C.ink, margin: "4px 0 8px" }}>78%</p>
          <div style={{ height: 6, borderRadius: 3, background: C.border, overflow: "hidden" }}>
            <div style={{ width: "78%", height: "100%", background: C.gold }} />
          </div>
          <p style={{ fontSize: 12.5, color: C.inkSoft, margin: "8px 0 0" }}>18 de 23 turmas com o planejamento em dia esta semana</p>
        </DashboardCard>

        <DashboardCard
          icon={Users}
          title="Equipe escolar"
          description={`${PROFESSORES.length} cadastros ativos`}
          onClick={() => setActivePage("professores")}
        />

        <DashboardCard
          icon={Archive}
          title="Banco de atividades"
          description={`${totalAtividades} atividades aprovadas`}
          onClick={() => setActivePage("banco")}
        />
      </div>
    </div>
  );
}

function DashboardCard({ icon: Icon, title, description, badge, onClick, children }) {
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

/* --------------------------------- Turmas -------------------------------- */

function TurmasPage({ turmas, setTurmas }) {
  const [expanded, setExpanded] = useState({ "Educação Infantil": true });
  const [modal, setModal] = useState(null); // { mode: 'create'|'edit', form: {...} }
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);

  function toggleEtapa(etapa) {
    setExpanded((e) => ({ ...e, [etapa]: !e[etapa] }));
  }

  function openCreate(etapa) {
    setModal({ mode: "create", form: { etapa: etapa || ETAPAS[0], nome: "", turno: "Matutino" } });
  }

  function openEdit(turma) {
    setModal({ mode: "edit", form: { ...turma } });
  }

  function saveModal(form) {
    if (modal.mode === "create") {
      const nextId = turmas.length ? Math.max(...turmas.map((t) => t.id)) + 1 : 1;
      setTurmas((prev) => [...prev, { id: nextId, professores: 0, ...form }]);
      setExpanded((e) => ({ ...e, [form.etapa]: true }));
    } else {
      setTurmas((prev) => prev.map((t) => (t.id === form.id ? { ...t, ...form } : t)));
    }
    setModal(null);
  }

  function removeTurma(id) {
    setTurmas((prev) => prev.filter((t) => t.id !== id));
    setConfirmRemoveId(null);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 18 }}>
        <button className="tv-btn tv-btn-primary" onClick={() => openCreate()}>
          <Plus size={16} /> Nova turma
        </button>
      </div>

      <div className="tv-card" style={{ padding: "6px 0", marginBottom: 22 }}>
        <p style={{ fontSize: 13, color: C.inkSoft, padding: "12px 20px 4px", margin: 0 }}>Estrutura organizacional</p>
        {ETAPAS.map((etapa, i) => {
          const turmasDaEtapa = turmas.filter((t) => t.etapa === etapa);
          const isOpen = !!expanded[etapa];
          return (
            <div key={etapa} style={{ borderTop: i === 0 ? "none" : `1px solid ${C.border}` }}>
              <button
                onClick={() => toggleEtapa(etapa)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "14px 20px", background: "none", border: "none", cursor: "pointer", textAlign: "left",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14.5, fontWeight: 600, color: C.ink }}>
                  {isOpen ? <ChevronDown size={16} color={C.inkSoft} /> : <ChevronRight size={16} color={C.inkSoft} />}
                  {etapa}
                </span>
                <span style={{ fontSize: 12.5, color: C.inkSoft }}>
                  {turmasDaEtapa.length} {turmasDaEtapa.length === 1 ? "turma ativa" : "turmas ativas"}
                </span>
              </button>

              {isOpen && (
                <div style={{ padding: "0 20px 20px", display: "flex", flexWrap: "wrap", gap: 12 }}>
                  {turmasDaEtapa.map((t) => (
                    <TurmaCard
                      key={t.id}
                      turma={t}
                      confirming={confirmRemoveId === t.id}
                      onEdit={() => openEdit(t)}
                      onAskRemove={() => setConfirmRemoveId(t.id)}
                      onCancelRemove={() => setConfirmRemoveId(null)}
                      onConfirmRemove={() => removeTurma(t.id)}
                    />
                  ))}
                  <button
                    onClick={() => openCreate(etapa)}
                    className="tv-card"
                    style={{
                      width: 180, minHeight: 96, display: "flex", flexDirection: "column", alignItems: "center",
                      justifyContent: "center", gap: 6, cursor: "pointer", borderStyle: "dashed", color: C.inkSoft,
                      background: "transparent",
                    }}
                  >
                    <Plus size={18} />
                    <span style={{ fontSize: 12.5 }}>Adicionar turma</span>
                  </button>
                  {turmasDaEtapa.length === 0 && (
                    <p style={{ fontSize: 13, color: C.inkSoft, alignSelf: "center", margin: 0 }}>
                      Nenhuma turma cadastrada nesta etapa ainda.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {modal && <TurmaModal modal={modal} onCancel={() => setModal(null)} onSave={saveModal} />}
    </div>
  );
}

function TurmaCard({ turma, confirming, onEdit, onAskRemove, onCancelRemove, onConfirmRemove }) {
  const isMatutino = turma.turno === "Matutino";
  return (
    <div className="tv-card" style={{ width: 180, padding: 14, borderTop: `3px solid ${isMatutino ? C.amber : C.sidebarSoft}`, borderTopLeftRadius: 10, borderTopRightRadius: 10 }}>
      <p style={{ fontSize: 14.5, fontWeight: 600, color: C.ink, margin: "0 0 4px" }}>{turma.nome}</p>
      <p style={{ fontSize: 12.5, color: C.inkSoft, margin: "0 0 2px", display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: isMatutino ? C.amber : C.sidebarSoft, display: "inline-block" }} />
        {turma.turno}
      </p>
      <p style={{ fontSize: 12.5, color: C.inkSoft, margin: "0 0 10px" }}>
        {turma.professores} {turma.professores === 1 ? "professor" : "professores"}
      </p>

      {confirming ? (
        <div>
          <p style={{ fontSize: 12, color: C.ink, margin: "0 0 8px" }}>Remover esta turma?</p>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="tv-btn-text-danger" onClick={onConfirmRemove} style={{ fontSize: 12.5, fontWeight: 600 }}>Confirmar</button>
            <button className="tv-btn-text" onClick={onCancelRemove} style={{ fontSize: 12.5, fontWeight: 600, color: C.inkSoft }}>Cancelar</button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 10, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
          <button className="tv-btn-text" onClick={onEdit} style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 4 }}>
            <Pencil size={12} /> Editar
          </button>
          <button className="tv-btn-text-danger" onClick={onAskRemove} style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 4 }}>
            <Trash2 size={12} /> Remover
          </button>
        </div>
      )}
    </div>
  );
}

function TurmaModal({ modal, onCancel, onSave }) {
  const [form, setForm] = useState(modal.form);
  const valid = form.nome.trim().length > 0;

  return (
    <div className="tv-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="tv-modal">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <h2 className="tv-serif" style={{ fontSize: 18, fontWeight: 600, color: C.ink, margin: 0 }}>
            {modal.mode === "create" ? "Cadastrar nova turma" : "Editar turma"}
          </h2>
          <button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkSoft }}>
            <X size={18} />
          </button>
        </div>
        <p style={{ fontSize: 12.5, color: C.inkSoft, margin: "0 0 18px" }}>
          {modal.mode === "create" ? "Defina as informações básicas para a nova turma." : "Atualize os dados da turma."}
        </p>

        <label style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>Etapa</label>
        <select
          className="tv-input"
          style={{ marginTop: 6, marginBottom: 14 }}
          value={form.etapa}
          onChange={(e) => setForm((f) => ({ ...f, etapa: e.target.value }))}
        >
          {ETAPAS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>

        <label style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>Nome da turma</label>
        <input
          className="tv-input"
          style={{ marginTop: 6, marginBottom: 14 }}
          placeholder="Ex: Jardim 1"
          value={form.nome}
          onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
        />

        <label style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>Turno</label>
        <div style={{ display: "flex", gap: 8, marginTop: 6, marginBottom: 22 }}>
          {["Matutino", "Vespertino"].map((turno) => (
            <button
              key={turno}
              type="button"
              onClick={() => setForm((f) => ({ ...f, turno }))}
              className="tv-btn"
              style={{
                flex: 1,
                background: form.turno === turno ? C.sidebar : "transparent",
                color: form.turno === turno ? "#fff" : C.ink,
                border: `1px solid ${form.turno === turno ? C.sidebar : C.border}`,
              }}
            >
              {turno}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button className="tv-btn tv-btn-secondary" onClick={onCancel}>Cancelar</button>
          <button className="tv-btn tv-btn-primary" disabled={!valid} onClick={() => onSave(form)}>
            Salvar turma
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Professores ------------------------------ */

function ProfessoresPage() {
  const professores = PROFESSORES;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 18 }}>
        <button className="tv-btn tv-btn-primary" disabled title="Disponível em uma próxima etapa">
          <Plus size={16} /> Cadastrar professor
        </button>
      </div>
      <div className="tv-card" style={{ overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
          <thead>
            <tr style={{ background: "#F4F1E6", textAlign: "left" }}>
              {["Nome", "Turmas", "E-mail"].map((h) => (
                <th key={h} style={{ padding: "12px 18px", fontWeight: 600, color: C.inkSoft, fontSize: 12.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {professores.map((p) => (
              <tr key={p.email} style={{ borderTop: `1px solid ${C.border}` }}>
                <td style={{ padding: "12px 18px", color: C.ink, fontWeight: 500 }}>{p.nome}</td>
                <td style={{ padding: "12px 18px", color: C.inkSoft }}>{p.turmas}</td>
                <td style={{ padding: "12px 18px", color: C.inkSoft }}>{p.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------ Solicitações ------------------------------ */

function SolicitacoesPage() {
  if (SOLICITACOES_PENDENTES.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="Nenhuma solicitação pendente."
        description="Novos cadastros de professores, coordenadores e diretores aparecerão aqui, dentro do seu escopo de autoridade, até serem aprovados ou recusados."
      />
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {SOLICITACOES_PENDENTES.map((s, i) => (
        <div key={i} className="tv-card" style={{ padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.ink, margin: "0 0 3px" }}>
              {s.nome}
              <span style={{ fontSize: 11.5, fontWeight: 600, color: C.goldDeep, background: "#F4E7CE", padding: "2px 8px", borderRadius: 999, marginLeft: 8 }}>
                {s.perfil}
              </span>
            </p>
            <p style={{ fontSize: 12.5, color: C.inkSoft, margin: 0 }}>{s.escopo} · solicitado em {s.data}</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="tv-btn tv-btn-secondary" disabled title="Disponível em uma próxima etapa">Recusar</button>
            <button className="tv-btn tv-btn-primary" disabled title="Disponível em uma próxima etapa">
              <Check size={14} /> Aprovar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------- Prazos ---------------------------------- */

function PrazosPage() {
  return (
    <div>
      <p style={{ fontSize: 13.5, color: C.inkSoft, marginBottom: 18, maxWidth: 640, lineHeight: 1.6 }}>
        Cada etapa (ou turma específica) tem seu próprio calendário de prazos. Escolha um dos dois modos
        de configuração abaixo para cada etapa ou turma sob seu escopo.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
        <div className="tv-card" style={{ padding: 18 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: C.ink, margin: "0 0 6px" }}>Modo 1 — Periodicidade automática</p>
          <p style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.6, margin: "0 0 16px" }}>
            Defina um intervalo (semanal, quinzenal ou mensal) e uma data-base; o sistema calcula os
            próximos ciclos automaticamente. Indicado para etapas com calendário estável.
          </p>
          <button className="tv-btn tv-btn-secondary" disabled title="Disponível em uma próxima etapa">Configurar</button>
        </div>
        <div className="tv-card" style={{ padding: 18 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: C.ink, margin: "0 0 6px" }}>Modo 2 — Calendário manual de ciclos</p>
          <p style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.6, margin: "0 0 16px" }}>
            Cadastre manualmente cada ciclo, informando a data-limite de entrega e o período do
            planejamento coberto. Indicado quando o calendário é definido caso a caso.
          </p>
          <button className="tv-btn tv-btn-secondary" disabled title="Disponível em uma próxima etapa">Configurar</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- Conteúdo --------------------------------- */

function ConteudoPage({ turmas }) {
  return (
    <EmptyState
      icon={BookOpen}
      title="Selecione uma turma para ver o conteúdo programático."
      description="Ao final de cada mês ou bimestre, o sistema reúne os campos “Conteúdo” e “Objetivos de Aprendizagem” de todos os planejamentos da turma em uma agregação somente leitura, pronta para impressão ou exportação."
    >
      <select className="tv-input" style={{ maxWidth: 260, marginTop: 14 }} disabled>
        <option>{turmas[0]?.nome ?? "Nenhuma turma cadastrada"}</option>
      </select>
    </EmptyState>
  );
}

/* --------------------------- Banco de atividades --------------------------- */

function BancoAtividadesPage({ turmas }) {
  const [turmaId, setTurmaId] = useState("");
  const [tema, setTema] = useState(null);

  const turma = turmas.find((t) => String(t.id) === String(turmaId));
  const dados = turmaId ? ATIVIDADES_POR_TURMA[turmaId] : null;
  const pastaAtual = dados?.pastas.find((p) => p.tema === tema);

  function selectTurma(id) {
    setTurmaId(id);
    setTema(null);
  }

  return (
    <div>
      <div className="tv-card" style={{ padding: 16, marginBottom: 20 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>Turma</label>
        <select
          className="tv-input"
          style={{ maxWidth: 280, marginTop: 6 }}
          value={turmaId}
          onChange={(e) => selectTurma(e.target.value)}
        >
          <option value="">Selecione uma turma</option>
          {turmas.map((t) => (
            <option key={t.id} value={t.id}>{t.nome} — {t.etapa}</option>
          ))}
        </select>
        <p style={{ fontSize: 12, color: C.inkSoft, margin: "8px 0 0" }}>
          Como Diretor(a), você vê todas as turmas. Professores veem apenas as turmas às quais têm acesso.
        </p>
      </div>

      {!turmaId && (
        <EmptyState
          icon={Archive}
          title="Selecione uma turma para ver o banco de atividades."
          description="Cada turma mantém seu próprio repositório de atividades já aprovadas, organizado em pastas por tema, disponíveis para reaproveitamento em novos planejamentos."
        />
      )}

      {turmaId && !tema && (
        <>
          {!dados || dados.pastas.length === 0 ? (
            <EmptyState
              icon={Folder}
              title={`Nenhuma atividade aprovada ainda em ${turma?.nome}.`}
              description="Quando um professor enviar uma atividade proposta e ela for aprovada pela coordenação ou direção, ela aparecerá aqui, organizada por tema."
            />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
              {dados.pastas.map((p) => (
                <button
                  key={p.tema}
                  onClick={() => setTema(p.tema)}
                  className="tv-card"
                  style={{ padding: 18, textAlign: "left", cursor: "pointer" }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 9, background: "#F4E7CE", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Folder size={18} color={C.goldDeep} />
                    </div>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: C.inkSoft, background: "#EFEAD9", padding: "3px 9px", borderRadius: 999 }}>
                      {p.atividades.length} {p.atividades.length === 1 ? "atividade" : "atividades"}
                    </span>
                  </div>
                  <p style={{ fontSize: 14.5, fontWeight: 600, color: C.ink, margin: 0 }}>{p.tema}</p>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {turmaId && tema && (
        <div>
          <button
            onClick={() => setTema(null)}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: C.inkSoft, fontSize: 13, marginBottom: 14, padding: 0 }}
          >
            <ArrowLeft size={15} /> {turma?.nome} <ArrowRight size={12} /> {tema}
          </button>

          {pastaAtual.atividades.length === 0 ? (
            <EmptyState icon={Folder} title="Nenhuma atividade aprovada nesta pasta ainda." description="Atividades enviadas por professores e aprovadas pela coordenação para este tema aparecerão aqui." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {pastaAtual.atividades.map((a, i) => (
                <div key={i} className="tv-card" style={{ padding: 16 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: C.ink, margin: "0 0 6px" }}>{a.titulo}</p>
                  <p style={{ fontSize: 12.5, color: C.inkSoft, margin: 0 }}>
                    Proposta por {a.propostaPor} · aprovada por {a.aprovadaPor} em {a.data}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------- Empty state ------------------------------ */

function EmptyState({ icon: Icon, title, description, children }) {
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
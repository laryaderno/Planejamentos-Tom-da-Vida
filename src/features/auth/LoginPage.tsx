import { Eye, EyeOff } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router";
import { LOGO_URL } from "@/app/marca";
import { C } from "@/styles/tokens";
import { useAuth } from "./AuthContext";

export function LoginPage() {
  const { usuario, entrar } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [touched, setTouched] = useState(false);
  const [showCadastroNote, setShowCadastroNote] = useState(false);

  const valid = email.trim().length > 3 && senha.length >= 4;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    await entrar(email.trim(), senha);
    navigate("/turmas", { replace: true });
  }

  if (usuario) return <Navigate to="/turmas" replace />;

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
              src={LOGO_URL}
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

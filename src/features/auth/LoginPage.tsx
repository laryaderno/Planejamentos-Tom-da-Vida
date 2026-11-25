import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router";
import { Aviso } from "@/components/Aviso";
import { TelaCarregando } from "@/components/TelaCarregando";
import { mensagemDeErro } from "@/lib/erros";
import { useAuth } from "./AuthContext";
import { Splash, splashJaVista } from "./Splash";
import { Campo, CampoSenha, TelaAuth, estiloLink } from "./TelaAuth";

export function LoginPage() {
  const { carregando, sessao, entrar } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [splash, setSplash] = useState(() => !splashJaVista());

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !senha) {
      setErro("Informe e-mail e senha.");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      await entrar(email.trim(), senha);
    } catch (err) {
      setErro(mensagemDeErro(err));
      setEnviando(false);
    }
  }

  if (carregando) return <TelaCarregando />;
  if (sessao) return <Navigate to="/" replace />;
  if (splash) return <Splash aoEntrar={() => setSplash(false)} />;

  return (
    <TelaAuth onSubmit={submit}>
      <Campo rotulo="E-mail">
        <input
          className="tv-input"
          type="email"
          autoComplete="email"
          placeholder="professor@escolatomdavida.com.br"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Campo>
      <Campo rotulo="Senha">
        <CampoSenha valor={senha} onChange={setSenha} />
      </Campo>

      {erro && <Aviso>{erro}</Aviso>}

      <button type="submit" className="tv-btn tv-btn-primary" disabled={enviando} style={{ width: "100%", marginTop: 14, padding: "11px 16px" }}>
        {enviando ? "Entrando…" : "Entrar"}
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
        <Link to="/esqueci-senha" style={estiloLink}>Esqueci minha senha</Link>
        <Link to="/cadastro" style={estiloLink}>Não tem conta? Cadastre-se</Link>
      </div>
    </TelaAuth>
  );
}

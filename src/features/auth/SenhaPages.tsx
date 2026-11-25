import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Aviso } from "@/components/Aviso";
import { TelaCarregando } from "@/components/TelaCarregando";
import { mensagemDeErro } from "@/lib/erros";
import { useAuth } from "./AuthContext";
import { Campo, CampoSenha, TelaAuth, estiloLink } from "./TelaAuth";

export function EsqueciSenhaPage() {
  const { enviarRedefinicao } = useAuth();
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<"inicio" | "enviando" | "enviado">("inicio");
  const [erro, setErro] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return setErro("Informe seu e-mail.");
    setEstado("enviando");
    setErro(null);
    try {
      await enviarRedefinicao(email.trim());
      setEstado("enviado");
    } catch (err) {
      setErro(mensagemDeErro(err));
      setEstado("inicio");
    }
  }

  return (
    <TelaAuth onSubmit={submit} subtitulo="Redefinir senha">
      {estado === "enviado" ? (
        <Aviso tipo="sucesso">
          Se houver um cadastro com <strong>{email}</strong>, você vai receber um e-mail com o link para criar uma nova senha.
        </Aviso>
      ) : (
        <>
          <Campo rotulo="E-mail do cadastro">
            <input className="tv-input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Campo>
          {erro && <Aviso>{erro}</Aviso>}
          <button type="submit" className="tv-btn tv-btn-primary" disabled={estado === "enviando"} style={{ width: "100%", marginTop: 14 }}>
            {estado === "enviando" ? "Enviando…" : "Enviar link"}
          </button>
        </>
      )}
      <div style={{ textAlign: "center", marginTop: 16 }}>
        <Link to="/login" style={estiloLink}>Voltar ao login</Link>
      </div>
    </TelaAuth>
  );
}

/** Aberta pelo link do e-mail de redefinição (o Supabase cria a sessão de recuperação). */
export function RedefinirSenhaPage() {
  const { carregando, sessao, definirNovaSenha } = useAuth();
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (senha.length < 8) return setErro("A senha precisa ter pelo menos 8 caracteres.");
    if (senha !== confirmacao) return setErro("As senhas não conferem.");
    setEnviando(true);
    setErro(null);
    try {
      await definirNovaSenha(senha);
      navigate("/", { replace: true });
    } catch (err) {
      setErro(mensagemDeErro(err));
      setEnviando(false);
    }
  }

  if (carregando) return <TelaCarregando />;

  if (!sessao) {
    return (
      <TelaAuth subtitulo="Redefinir senha">
        <Aviso>Este link expirou ou já foi usado. Peça um novo link de redefinição.</Aviso>
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <Link to="/esqueci-senha" style={estiloLink}>Pedir novo link</Link>
        </div>
      </TelaAuth>
    );
  }

  return (
    <TelaAuth onSubmit={submit} subtitulo="Crie sua nova senha">
      <Campo rotulo="Nova senha (mínimo 8 caracteres)">
        <CampoSenha valor={senha} onChange={setSenha} autoComplete="new-password" />
      </Campo>
      <Campo rotulo="Repita a nova senha">
        <CampoSenha valor={confirmacao} onChange={setConfirmacao} autoComplete="new-password" />
      </Campo>
      {erro && <Aviso>{erro}</Aviso>}
      <button type="submit" className="tv-btn tv-btn-primary" disabled={enviando} style={{ width: "100%", marginTop: 14 }}>
        {enviando ? "Salvando…" : "Salvar nova senha"}
      </button>
    </TelaAuth>
  );
}

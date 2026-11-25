import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router";
import { Aviso } from "@/components/Aviso";
import { useEtapas } from "@/lib/consultas";
import { mensagemDeErro } from "@/lib/erros";
import { PAPEIS_SOLICITAVEIS, ROTULO_PAPEL, type Papel } from "@/lib/papeis";
import { useAuth } from "./AuthContext";
import { Campo, CampoSenha, TelaAuth, estiloLink } from "./TelaAuth";

export function CadastroPage() {
  const { sessao, cadastrar } = useAuth();
  const etapas = useEtapas();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [papel, setPapel] = useState<Papel>("professor");
  const [etapaId, setEtapaId] = useState<number | "">("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const precisaEtapa = papel === "professor" || papel === "coordenador";

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !email.trim()) return setErro("Preencha nome e e-mail.");
    if (senha.length < 8) return setErro("A senha precisa ter pelo menos 8 caracteres.");
    if (precisaEtapa && etapaId === "") return setErro("Escolha a etapa em que você vai atuar.");
    setEnviando(true);
    setErro(null);
    try {
      await cadastrar({ nome: nome.trim(), email: email.trim(), senha, papel, etapaId: precisaEtapa ? Number(etapaId) : null });
    } catch (err) {
      setErro(mensagemDeErro(err));
      setEnviando(false);
    }
  }

  // Após o cadastro há sessão, mas o perfil está pendente: a rota mostra a tela de espera.
  if (sessao) return <Navigate to="/aguardando" replace />;

  return (
    <TelaAuth onSubmit={submit} subtitulo="Solicitar acesso" largura={420}>
      <Campo rotulo="Nome completo">
        <input className="tv-input" autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} />
      </Campo>
      <Campo rotulo="E-mail">
        <input className="tv-input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Campo>
      <Campo rotulo="Senha (mínimo 8 caracteres)">
        <CampoSenha valor={senha} onChange={setSenha} autoComplete="new-password" />
      </Campo>
      <Campo rotulo="Função na escola">
        <select className="tv-input" value={papel} onChange={(e) => setPapel(e.target.value as Papel)}>
          {PAPEIS_SOLICITAVEIS.map((p) => (
            <option key={p} value={p}>{ROTULO_PAPEL[p]}</option>
          ))}
        </select>
      </Campo>
      {precisaEtapa && (
        <Campo rotulo="Etapa">
          <select className="tv-input" value={etapaId} onChange={(e) => setEtapaId(e.target.value === "" ? "" : Number(e.target.value))}>
            <option value="">Selecione</option>
            {(etapas.data ?? []).map((e) => (
              <option key={e.id} value={e.id}>{e.nome}</option>
            ))}
          </select>
        </Campo>
      )}

      {erro && <Aviso>{erro}</Aviso>}

      <button type="submit" className="tv-btn tv-btn-primary" disabled={enviando} style={{ width: "100%", marginTop: 14, padding: "11px 16px" }}>
        {enviando ? "Enviando…" : "Solicitar acesso"}
      </button>
      <p style={{ fontSize: 12.5, color: "#54615C", textAlign: "center", margin: "12px 0 0", lineHeight: 1.5 }}>
        Seu acesso fica pendente até ser aprovado por alguém da coordenação ou direção.
      </p>
      <div style={{ textAlign: "center", marginTop: 12 }}>
        <Link to="/login" style={estiloLink}>Já tenho conta</Link>
      </div>
    </TelaAuth>
  );
}

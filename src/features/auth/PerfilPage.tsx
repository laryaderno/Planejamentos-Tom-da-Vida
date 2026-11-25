import { KeyRound, LogOut } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Aviso } from "@/components/Aviso";
import { formatarData, paraEntrada, useCatalogo, useVinculos } from "@/lib/consultas";
import { mensagemDeErro } from "@/lib/erros";
import { ROTULO_PAPEL } from "@/lib/papeis";
import { C } from "@/styles/tokens";
import { descrever, resumoTurmas } from "@/features/usuarios/vinculos";
import { useAuth, useUsuario } from "./AuthContext";
import { CampoSenha } from "./TelaAuth";
import { useSair } from "@/lib/offline/useSair";

/** Minhas informações, troca de senha e saída da conta. */
export function PerfilPage() {
  const eu = useUsuario();
  const { sessao, definirNovaSenha } = useAuth();
  const { pedirSaida, modal: modalSaida } = useSair();
  const vinculos = useVinculos();
  const { catalogo } = useCatalogo();

  const meus = (vinculos.data ?? []).filter((v) => v.usuario_id === eu.id).map(paraEntrada);
  const escopo = !catalogo
    ? "…"
    : eu.papel === "professor"
      ? resumoTurmas(meus, catalogo) || "Nenhuma turma vinculada"
      : eu.papel === "coordenador"
        ? meus.map((v) => descrever(v, catalogo)).join(", ") || "Nenhuma etapa vinculada"
        : "Toda a escola";

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 640 }}>
      <section className="tv-card" style={{ padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: C.gold, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, flexShrink: 0 }}>
            {eu.nome[0] ?? "?"}
          </div>
          <div style={{ minWidth: 0 }}>
            <p className="tv-serif" style={{ fontSize: 19, fontWeight: 600, color: C.ink, margin: 0 }}>{eu.nome}</p>
            <p style={{ fontSize: 13, color: C.inkSoft, margin: "2px 0 0" }}>{ROTULO_PAPEL[eu.papel]}</p>
          </div>
        </div>
        <dl style={{ display: "grid", gridTemplateColumns: "max-content 1fr", gap: "10px 18px", margin: 0, fontSize: 13.5 }}>
          <Item rotulo="E-mail">{eu.email}</Item>
          <Item rotulo="Papel">{ROTULO_PAPEL[eu.papel]}</Item>
          <Item rotulo={eu.papel === "professor" ? "Turmas" : "Escopo"}>{escopo}</Item>
          <Item rotulo="Último acesso">{formatarData(sessao?.user.last_sign_in_at, true)}</Item>
        </dl>
      </section>

      <TrocarSenha onTrocar={definirNovaSenha} />

      <section className="tv-card" style={{ padding: 22, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <p style={{ fontSize: 14.5, fontWeight: 600, color: C.ink, margin: "0 0 3px" }}>Sair da conta</p>
          <p style={{ fontSize: 12.5, color: C.inkSoft, margin: 0 }}>Encerra a sessão neste navegador.</p>
        </div>
        <button className="tv-btn tv-btn-secondary" onClick={pedirSaida}>
          <LogOut size={15} /> Sair
        </button>
      </section>
      {modalSaida}
    </div>
  );
}

function Item({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <>
      <dt style={{ color: C.inkSoft }}>{rotulo}</dt>
      <dd style={{ margin: 0, color: C.ink, wordBreak: "break-word" }}>{children}</dd>
    </>
  );
}

function TrocarSenha({ onTrocar }: { onTrocar: (senha: string) => Promise<void> }) {
  const [aberto, setAberto] = useState(false);
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (senha.length < 8) return setErro("A senha precisa ter pelo menos 8 caracteres.");
    if (senha !== confirmacao) return setErro("As senhas não conferem.");
    setEnviando(true);
    setErro(null);
    try {
      await onTrocar(senha);
      setOk(true);
      setAberto(false);
      setSenha("");
      setConfirmacao("");
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="tv-card" style={{ padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <p style={{ fontSize: 14.5, fontWeight: 600, color: C.ink, margin: "0 0 3px" }}>Senha</p>
          <p style={{ fontSize: 12.5, color: C.inkSoft, margin: 0 }}>Troque a senha que você usa para entrar.</p>
        </div>
        {!aberto && (
          <button className="tv-btn tv-btn-secondary" onClick={() => { setAberto(true); setOk(false); }}>
            <KeyRound size={15} /> Alterar senha
          </button>
        )}
      </div>
      {ok && <div style={{ marginTop: 14 }}><Aviso tipo="sucesso">Senha alterada.</Aviso></div>}
      {aberto && (
        <form onSubmit={submit} style={{ marginTop: 16, display: "grid", gap: 12, maxWidth: 360 }}>
          <label>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Nova senha (mínimo 8 caracteres)</span>
            <div style={{ marginTop: 6 }}><CampoSenha valor={senha} onChange={setSenha} autoComplete="new-password" /></div>
          </label>
          <label>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Repita a nova senha</span>
            <div style={{ marginTop: 6 }}><CampoSenha valor={confirmacao} onChange={setConfirmacao} autoComplete="new-password" /></div>
          </label>
          {erro && <Aviso>{erro}</Aviso>}
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="tv-btn tv-btn-secondary" onClick={() => { setAberto(false); setErro(null); }} disabled={enviando}>
              Cancelar
            </button>
            <button type="submit" className="tv-btn tv-btn-primary" disabled={enviando}>{enviando ? "Salvando…" : "Salvar senha"}</button>
          </div>
        </form>
      )}
    </section>
  );
}

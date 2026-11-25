import { useState } from "react";
import { Aviso } from "@/components/Aviso";
import { Modal } from "@/components/Modal";
import { useRecarregar, type Perfil, type VinculoEntrada } from "@/lib/consultas";
import { mensagemDeErro, verificar } from "@/lib/erros";
import { NIVEL, papeisAprovaveis, ROTULO_PAPEL, type Papel } from "@/lib/papeis";
import { supabase } from "@/lib/supabase";
import { useUsuario } from "@/features/auth/AuthContext";
import { ListaVinculos } from "./ListaVinculos";
import { VinculosEditor } from "./VinculosEditor";
import type { Catalogo } from "./vinculos";

interface Props {
  perfil: Perfil;
  catalogo: Catalogo;
  onFechar: () => void;
}

/** Aprovação de cadastro: papel, vínculos (§4.2) e confirmação detalhada (§3.2). */
export function AprovarModal({ perfil, catalogo, onFechar }: Props) {
  const eu = useUsuario();
  const recarregar = useRecarregar();
  const opcoes = papeisAprovaveis(eu);
  const [papel, setPapel] = useState<Papel>(opcoes.includes(perfil.papel) ? perfil.papel : opcoes[opcoes.length - 1]!);
  const [vinculos, setVinculos] = useState<VinculoEntrada[]>(() =>
    perfil.papel === "coordenador" && perfil.etapa_solicitada_id ? [{ etapa_id: perfil.etapa_solicitada_id }] : [],
  );
  const [passo, setPasso] = useState<"editar" | "confirmar">("editar");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const etapasEditaveis = NIVEL[eu.papel] >= NIVEL.secretaria ? catalogo.etapas.map((e) => e.id) : eu.etapasCoordenadas;
  const precisaVinculo = papel === "professor" || papel === "coordenador";
  const pronto = !precisaVinculo || vinculos.length > 0;

  function trocarPapel(p: Papel) {
    setPapel(p);
    setVinculos([]);
  }

  async function aprovar() {
    setEnviando(true);
    setErro(null);
    try {
      verificar(
        await supabase.rpc("aprovar_usuario", {
          p_usuario: perfil.id,
          p_papel: papel,
          p_vinculos: (precisaVinculo ? vinculos : []) as never,
        }),
      );
      await recarregar();
      onFechar();
    } catch (e) {
      setErro(mensagemDeErro(e));
      setEnviando(false);
    }
  }

  if (passo === "confirmar") {
    return (
      <Modal
        titulo="Confirmar aprovação"
        largura={480}
        onFechar={onFechar}
        rodape={
          <>
            <button className="tv-btn tv-btn-secondary" onClick={() => setPasso("editar")} disabled={enviando}>Voltar</button>
            <button className="tv-btn tv-btn-primary" onClick={aprovar} disabled={enviando}>{enviando ? "Aprovando…" : "Aprovar acesso"}</button>
          </>
        }
      >
        <p style={{ fontSize: 13.5, lineHeight: 1.55, margin: "0 0 14px" }}>
          Você está prestes a liberar o acesso de <strong>{perfil.nome}</strong> ({perfil.email}) como{" "}
          <strong>{ROTULO_PAPEL[papel]}</strong>
          {papel !== perfil.papel && <> (o pedido era para {ROTULO_PAPEL[perfil.papel]})</>}.
        </p>
        <ListaVinculos titulo="Acesso concedido" itens={vinculos} catalogo={catalogo} sinal="+" />
        {!precisaVinculo && (
          <p style={{ fontSize: 13, color: "#54615C", margin: "0 0 12px" }}>
            {ROTULO_PAPEL[papel]} tem acesso a todas as etapas e turmas da escola.
          </p>
        )}
        {erro && <Aviso>{erro}</Aviso>}
      </Modal>
    );
  }

  return (
    <Modal
      titulo={`Aprovar ${perfil.nome}`}
      subtitulo={perfil.email}
      largura={560}
      onFechar={onFechar}
      rodape={
        <>
          <button className="tv-btn tv-btn-secondary" onClick={onFechar}>Cancelar</button>
          <button className="tv-btn tv-btn-primary" disabled={!pronto} onClick={() => setPasso("confirmar")}>Revisar e aprovar</button>
        </>
      }
    >
      <label style={{ display: "block", marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Papel</span>
        <select className="tv-input" style={{ marginTop: 6 }} value={papel} onChange={(e) => trocarPapel(e.target.value as Papel)}>
          {opcoes.map((p) => <option key={p} value={p}>{ROTULO_PAPEL[p]}</option>)}
        </select>
      </label>
      {precisaVinculo && (
        <>
          <p style={{ fontSize: 13, fontWeight: 600, margin: "0 0 8px" }}>
            {papel === "professor" ? "Turmas, disciplinas e regência" : "Etapas que vai coordenar"}
          </p>
          <VinculosEditor papel={papel} valor={vinculos} onChange={setVinculos} catalogo={catalogo} etapasEditaveis={etapasEditaveis} />
          {!pronto && (
            <p style={{ fontSize: 12.5, color: "#54615C", margin: "8px 0 0" }}>
              {papel === "professor" ? "Escolha ao menos uma disciplina em uma turma." : "Escolha ao menos uma etapa."}
            </p>
          )}
        </>
      )}
    </Modal>
  );
}

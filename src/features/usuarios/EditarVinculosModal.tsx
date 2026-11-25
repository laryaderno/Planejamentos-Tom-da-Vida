import { useState } from "react";
import { Aviso } from "@/components/Aviso";
import { Modal } from "@/components/Modal";
import { paraEntrada, useRecarregar, type Perfil, type Vinculo, type VinculoEntrada } from "@/lib/consultas";
import { mensagemDeErro, verificar } from "@/lib/erros";
import { NIVEL, ROTULO_PAPEL } from "@/lib/papeis";
import { supabase } from "@/lib/supabase";
import { useUsuario } from "@/features/auth/AuthContext";
import { ListaVinculos } from "./ListaVinculos";
import { VinculosEditor } from "./VinculosEditor";
import { diferenca, type Catalogo } from "./vinculos";

interface Props {
  perfil: Perfil;
  vinculosAtuais: Vinculo[];
  catalogo: Catalogo;
  onFechar: () => void;
}

/** Alterar permissões de um professor ou coordenador, com confirmação detalhada (§3.2). */
export function EditarVinculosModal({ perfil, vinculosAtuais, catalogo, onFechar }: Props) {
  const eu = useUsuario();
  const recarregar = useRecarregar();
  const atual = vinculosAtuais.map(paraEntrada);
  const [novo, setNovo] = useState<VinculoEntrada[]>(atual);
  const [etapa, setEtapa] = useState<"editar" | "confirmar">("editar");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const etapasEditaveis = NIVEL[eu.papel] >= NIVEL.secretaria ? catalogo.etapas.map((e) => e.id) : eu.etapasCoordenadas;
  const dif = diferenca(atual, novo);
  const semMudanca = dif.adicionados.length + dif.removidos.length + dif.regenciaAlterada.length === 0;

  async function salvar() {
    setEnviando(true);
    setErro(null);
    try {
      verificar(await supabase.rpc("alterar_vinculos", { p_usuario: perfil.id, p_vinculos: novo as never }));
      await recarregar();
      onFechar();
    } catch (e) {
      setErro(mensagemDeErro(e));
      setEnviando(false);
    }
  }

  const titulo = `Permissões de ${perfil.nome}`;

  if (etapa === "confirmar") {
    return (
      <Modal
        titulo="Confirmar alteração de permissões"
        largura={480}
        onFechar={onFechar}
        rodape={
          <>
            <button className="tv-btn tv-btn-secondary" onClick={() => setEtapa("editar")} disabled={enviando}>Voltar</button>
            <button className="tv-btn tv-btn-primary" onClick={salvar} disabled={enviando}>{enviando ? "Salvando…" : "Confirmar"}</button>
          </>
        }
      >
        <p style={{ fontSize: 13.5, lineHeight: 1.55, margin: "0 0 14px" }}>
          Você está prestes a alterar o acesso de <strong>{perfil.nome}</strong> ({ROTULO_PAPEL[perfil.papel]}):
        </p>
        <ListaVinculos titulo="Acesso que será concedido" itens={dif.adicionados} catalogo={catalogo} sinal="+" />
        <ListaVinculos titulo="Acesso que será removido" itens={dif.removidos} catalogo={catalogo} sinal="−" />
        <ListaVinculos titulo="Regência alterada" itens={dif.regenciaAlterada} catalogo={catalogo} />
        {dif.removidos.length > 0 && (
          <p style={{ fontSize: 12.5, color: "#54615C", margin: "0 0 8px" }}>
            A remoção de acesso não pode ser desfeita automaticamente; para devolver, será preciso conceder de novo.
          </p>
        )}
        {erro && <Aviso>{erro}</Aviso>}
      </Modal>
    );
  }

  return (
    <Modal
      titulo={titulo}
      subtitulo={perfil.papel === "professor" ? "Turmas, disciplinas e regência" : "Etapas coordenadas"}
      largura={560}
      onFechar={onFechar}
      rodape={
        <>
          <button className="tv-btn tv-btn-secondary" onClick={onFechar}>Cancelar</button>
          <button className="tv-btn tv-btn-primary" disabled={semMudanca} onClick={() => setEtapa("confirmar")}>Revisar alterações</button>
        </>
      }
    >
      <VinculosEditor papel={perfil.papel} valor={novo} onChange={setNovo} catalogo={catalogo} etapasEditaveis={etapasEditaveis} />
    </Modal>
  );
}

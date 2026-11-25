import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bancoLocal, chavePendencia } from "./banco-local";
import { lerPendencia, pendenciasDoUsuario, registrarAlteracao } from "./fila";
import { criarSincronizador, type RespostaEnvio } from "./sincronizador";

const EU = "usuario-1";
const OUTRO = "usuario-2";

function criar(enviar: (b: number, v: number, c: Record<string, unknown>) => Promise<RespostaEnvio>) {
  return criarSincronizador({
    enviar,
    erroDeRede: (e) => e instanceof TypeError,
    mensagemDeErro: (e) => (e instanceof Error ? e.message : "erro"),
  });
}

const ok = (versao: number): RespostaEnvio => ({ versao, atualizado_em: "2026-11-25T10:00:00Z", conflito: false });

beforeEach(async () => {
  await bancoLocal.pendencias.clear();
});

describe("fila de alterações", () => {
  it("acumula campos do mesmo bloco e guarda a versão de quando a edição começou", async () => {
    await registrarAlteracao(EU, 10, 3, { conteudo: "A" });
    await registrarAlteracao(EU, 10, 99, { recursos: "B" });
    await registrarAlteracao(EU, 10, 99, { conteudo: "A2" });
    const p = await lerPendencia(EU, 10);
    expect(p?.campos).toEqual({ conteudo: "A2", recursos: "B" });
    expect(p?.versaoBase).toBe(3);
  });

  it("separa a fila por usuário (outra pessoa no mesmo computador)", async () => {
    await registrarAlteracao(EU, 10, 1, { conteudo: "meu" });
    await registrarAlteracao(OUTRO, 10, 1, { conteudo: "dela" });
    expect(await pendenciasDoUsuario(EU)).toHaveLength(1);
    expect(await pendenciasDoUsuario(OUTRO)).toHaveLength(1);
  });
});

describe("sincronizador", () => {
  it("envia e limpa a fila quando o servidor confirma", async () => {
    const enviar = vi.fn(async () => ok(4));
    const s = criar(enviar);
    await registrarAlteracao(EU, 10, 3, { conteudo: "A" });
    const r = await s.sincronizar(chavePendencia(EU, 10), 10);
    expect(r.tipo).toBe("enviado");
    expect(enviar).toHaveBeenCalledWith(10, 3, { conteudo: "A" });
    expect(await lerPendencia(EU, 10)).toBeUndefined();
  });

  it("sem conexão: mantém tudo na fila para tentar depois", async () => {
    const s = criar(async () => {
      throw new TypeError("Failed to fetch");
    });
    await registrarAlteracao(EU, 10, 3, { conteudo: "A" });
    expect((await s.sincronizar(chavePendencia(EU, 10), 10)).tipo).toBe("sem-conexao");
    const p = await lerPendencia(EU, 10);
    expect(p?.campos).toEqual({ conteudo: "A" });
    expect(p?.tentativas).toBe(1);
    expect(p?.erro).toBeUndefined();
  });

  it("o que foi digitado durante o envio continua na fila", async () => {
    let liberar!: () => void;
    const s = criar(
      () =>
        new Promise<RespostaEnvio>((res) => {
          liberar = () => res(ok(4));
        }),
    );
    await registrarAlteracao(EU, 10, 3, { conteudo: "A" });
    const envio = s.sincronizar(chavePendencia(EU, 10), 10);
    await new Promise((r) => setTimeout(r, 10));
    await registrarAlteracao(EU, 10, 3, { conteudo: "AB", recursos: "R" });
    liberar();
    await envio;
    const p = await lerPendencia(EU, 10);
    expect(p?.campos).toEqual({ conteudo: "AB", recursos: "R" });
    expect(p?.versaoBase).toBe(4);
  });

  it("erro de regra fica marcado e não é reenviado sozinho; nova edição tenta de novo", async () => {
    const enviar = vi.fn(async () => {
      throw new Error("Este planejamento está arquivado e não pode ser editado.");
    });
    const s = criar(enviar);
    await registrarAlteracao(EU, 10, 3, { conteudo: "A" });
    await s.sincronizarTudo(EU);
    expect((await lerPendencia(EU, 10))?.erro).toMatch(/arquivado/);
    await s.sincronizarTudo(EU);
    expect(enviar).toHaveBeenCalledTimes(1);
    await registrarAlteracao(EU, 10, 3, { conteudo: "B" });
    expect((await lerPendencia(EU, 10))?.erro).toBeUndefined();
  });

  it("dois pedidos de envio do mesmo bloco não correm ao mesmo tempo", async () => {
    let simultaneos = 0;
    let maximo = 0;
    const s = criar(async () => {
      simultaneos++;
      maximo = Math.max(maximo, simultaneos);
      await new Promise((r) => setTimeout(r, 20));
      simultaneos--;
      return ok(5);
    });
    await registrarAlteracao(EU, 10, 3, { conteudo: "A" });
    const chave = chavePendencia(EU, 10);
    await Promise.all([s.sincronizar(chave, 10), s.sincronizar(chave, 10), s.sincronizar(chave, 10)]);
    expect(maximo).toBe(1);
  });

  it("sincronizarTudo envia só a fila do usuário logado", async () => {
    const enviar = vi.fn(async () => ok(2));
    const s = criar(enviar);
    await registrarAlteracao(EU, 10, 1, { conteudo: "meu" });
    await registrarAlteracao(OUTRO, 11, 1, { conteudo: "dela" });
    await s.sincronizarTudo(EU);
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(await pendenciasDoUsuario(OUTRO)).toHaveLength(1);
  });
});

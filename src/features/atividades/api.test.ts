import { describe, expect, it } from "vitest";
import { nomeSeguro, tamanhoLegivel, tipoDoArquivo, tituloDoArquivo } from "./api";

describe("arquivos de atividades", () => {
  it("reconhece o tipo pela extensão quando o navegador não informa", () => {
    expect(tipoDoArquivo("Atividade.PDF", "")).toBe("application/pdf");
    expect(tipoDoArquivo("musica.m4a", "audio/x-m4a")).toBe("audio/mp4");
    expect(tipoDoArquivo("programa.exe", "application/x-msdownload")).toBeNull();
  });

  it("gera nome seguro sem acentos e espaços", () => {
    expect(nomeSeguro("Caça às formas (versão 2).pdf")).toBe("Caca-as-formas-versao-2-.pdf");
  });

  it("sugere título a partir do nome do arquivo", () => {
    expect(tituloDoArquivo("caca_as-formas.pdf")).toBe("caca as formas");
  });

  it("mostra o tamanho em KB ou MB", () => {
    expect(tamanhoLegivel(2048)).toBe("2 KB");
    expect(tamanhoLegivel(3.5 * 1024 * 1024)).toBe("3,5 MB");
  });
});

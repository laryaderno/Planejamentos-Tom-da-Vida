import { useEffect, useRef, useState, type ComponentProps } from "react";
import { LOGO_URL } from "@/app/marca";
import "./splash.css";

/** Versículos (NVT). O primeiro abre sempre; depois troca a cada 45 segundos. */
const VERSICULOS: { texto: string; referencia: string }[] = [
  { texto: "Confie ao SENHOR tudo que você faz, e seus planos serão bem-sucedidos.", referencia: "Provérbios 16:3 NVT" },
  { texto: "Em tudo que fizerem, trabalhem de bom ânimo, como se fosse para o Senhor, e não para os homens.", referencia: "Colossenses 3:23 NVT" },
  { texto: "Com bons conselhos os planos são bem-sucedidos; não saia para a guerra sem boas orientações.", referencia: "Provérbios 20:18 NVT" },
];
const TROCA_MS = 45_000;
const SAIDA_MS = 700;
const CHAVE = "tv-splash-vista";
const ATRASO_PALAVRA = 0.11; // segundos entre uma palavra e a próxima

/** Fundo verde animado (quadriculado, granulado e luz de folhas), usado na splash e nas telas de acesso. */
export function FundoVerde({ className = "", children, ...resto }: ComponentProps<"div">) {
  return (
    <div className={`tv-fundo-verde ${className}`} {...resto}>
      <span className="tv-luz tv-luz-1" />
      <span className="tv-sombra" />
      <span className="tv-luz tv-luz-2" />
      {children}
    </div>
  );
}

/** Mostrar a splash só uma vez por sessão do navegador. */
export function splashJaVista(): boolean {
  try {
    return sessionStorage.getItem(CHAVE) === "1";
  } catch {
    return false;
  }
}

/** Tela de abertura com o versículo; um clique (ou tecla) leva ao login. */
export function Splash({ aoEntrar }: { aoEntrar: () => void }) {
  const [saindo, setSaindo] = useState(false);
  const [indice, setIndice] = useState(0);
  const [trocando, setTrocando] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const atual = VERSICULOS[indice]!;
  const palavras = atual.texto.split(" ");
  const fimPalavras = 0.5 + palavras.length * ATRASO_PALAVRA;
  const fimPrimeiro = 0.5 + VERSICULOS[0]!.texto.split(" ").length * ATRASO_PALAVRA;

  function entrar() {
    if (saindo) return;
    setSaindo(true);
    try {
      sessionStorage.setItem(CHAVE, "1");
    } catch {
      /* navegação privada: tudo bem mostrar de novo */
    }
    setTimeout(aoEntrar, 550);
  }

  useEffect(() => {
    ref.current?.focus();
  }, []);

  // A cada 45 s: some o versículo atual e o próximo entra palavra por palavra.
  useEffect(() => {
    if (VERSICULOS.length < 2) return;
    let saida: ReturnType<typeof setTimeout>;
    const troca = setInterval(() => {
      setTrocando(true);
      saida = setTimeout(() => {
        setIndice((i) => (i + 1) % VERSICULOS.length);
        setTrocando(false);
      }, SAIDA_MS);
    }, TROCA_MS);
    return () => {
      clearInterval(troca);
      clearTimeout(saida);
    };
  }, []);

  return (
    <FundoVerde
      ref={ref}
      className={`tv-splash ${saindo ? "saindo" : ""}`}
      role="button"
      tabIndex={0}
      aria-label="Clique em qualquer lugar da tela para começar"
      onClick={entrar}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && entrar()}
    >
      <div className="tv-splash-logo">
        <img src={LOGO_URL} alt="Escola Tom da Vida" />
      </div>
      <div key={indice} className={`tv-splash-bloco ${trocando ? "trocando" : ""}`} aria-live="polite">
        <p className="tv-splash-versiculo">
          <span aria-hidden="true">
            “
            {palavras.map((p, i) => (
              <span key={i}>
                <span className="tv-splash-palavra" style={{ animationDelay: `${0.5 + i * ATRASO_PALAVRA}s` }}>{p}</span>
                {i < palavras.length - 1 && " "}
              </span>
            ))}
            ”
          </span>
          <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>{atual.texto}</span>
        </p>
        <p className="tv-splash-referencia" style={{ animationDelay: `${fimPalavras + 0.1}s` }}>{atual.referencia}</p>
      </div>
      <p className="tv-splash-convite" style={{ animationDelay: `${fimPrimeiro + 0.6}s` }}>clique em qualquer lugar da tela para começar</p>
    </FundoVerde>
  );
}

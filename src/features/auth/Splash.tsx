import { useEffect, useRef, useState, type ComponentProps } from "react";
import { LOGO_URL } from "@/app/marca";
import "./splash.css";

const VERSICULO = "Confie ao Senhor tudo que você faz, e seus planos serão bem-sucedidos.";
const REFERENCIA = "Provérbios 16:3 NVT";
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
  const ref = useRef<HTMLDivElement>(null);
  const palavras = VERSICULO.split(" ");
  const fimPalavras = 0.5 + palavras.length * ATRASO_PALAVRA;

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
        <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>{VERSICULO}</span>
      </p>
      <p className="tv-splash-referencia" style={{ animationDelay: `${fimPalavras + 0.1}s` }}>{REFERENCIA}</p>
      <p className="tv-splash-convite" style={{ animationDelay: `${fimPalavras + 0.6}s` }}>clique em qualquer lugar da tela para começar</p>
    </FundoVerde>
  );
}

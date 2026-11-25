import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { ConfiguracaoAusente } from "./app/ConfiguracaoAusente";
import { supabaseConfigurado } from "./lib/supabase";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {supabaseConfigurado ? <App /> : <ConfiguracaoAusente />}
  </StrictMode>,
);

/** Mostrada quando o .env.local não tem as variáveis do Supabase. */
export function ConfiguracaoAusente() {
  return (
    <div className="tv-root" style={{ maxWidth: 560, margin: "80px auto", padding: 24, fontSize: 14, lineHeight: 1.6 }}>
      <h1 className="tv-serif" style={{ fontSize: 22 }}>Supabase não configurado</h1>
      <p>
        Crie o arquivo <code>.env.local</code> a partir de <code>.env.example</code> com <code>VITE_SUPABASE_URL</code> e{" "}
        <code>VITE_SUPABASE_ANON_KEY</code>, e reinicie o <code>npm run dev</code>. O passo a passo está no README.
      </p>
    </div>
  );
}

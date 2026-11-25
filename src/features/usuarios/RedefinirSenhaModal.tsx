import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import type { Perfil } from "@/lib/consultas";
import { useAuth } from "@/features/auth/AuthContext";

/** Administrador envia o link de redefinição de senha (§5.1). */
export function RedefinirSenhaModal({ perfil, onFechar }: { perfil: Perfil; onFechar: () => void }) {
  const { enviarRedefinicao } = useAuth();
  return (
    <ConfirmarAcao
      titulo="Redefinir senha"
      mensagem={
        <>
          Será enviado para <strong>{perfil.email}</strong> um link para <strong>{perfil.nome}</strong> criar uma nova
          senha. A senha atual continua valendo até a pessoa usar o link.
        </>
      }
      rotuloConfirmar="Enviar link"
      onCancelar={onFechar}
      onConfirmar={async () => {
        await enviarRedefinicao(perfil.email);
        onFechar();
      }}
    />
  );
}

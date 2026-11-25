
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "disciplinas": {
                  Row: {
                    "id": number,"nome": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: never,"nome": string
                  }
                  Update: {
                    "id"?: never,"nome"?: string
                  }
                  Relationships: [
                    
                  ]
                },"etapas": {
                  Row: {
                    "exige_linguagem_amor": boolean,"id": number,"nome": string,"ordem": number
                  }
                  ComputedFields: never
                  Insert: {
                    "exige_linguagem_amor"?: boolean,"id"?: never,"nome": string,"ordem": number
                  }
                  Update: {
                    "exige_linguagem_amor"?: boolean,"id"?: never,"nome"?: string,"ordem"?: number
                  }
                  Relationships: [
                    
                  ]
                },"log_auditoria": {
                  Row: {
                    "acao": string,"antes": Json | null,"ator_id": string | null,"ator_nivel": number | null,"depois": Json | null,"em": string,"id": number,"registro_id": string | null,"tabela": string
                  }
                  ComputedFields: never
                  Insert: {
                    "acao": string,"antes"?: Json | null,"ator_id"?: string | null,"ator_nivel"?: number | null,"depois"?: Json | null,"em"?: string,"id"?: never,"registro_id"?: string | null,"tabela": string
                  }
                  Update: {
                    "acao"?: string,"antes"?: Json | null,"ator_id"?: string | null,"ator_nivel"?: number | null,"depois"?: Json | null,"em"?: string,"id"?: never,"registro_id"?: string | null,"tabela"?: string
                  }
                  Relationships: [
                    
                  ]
                },"perfis": {
                  Row: {
                    "aprovado_em": string | null,"aprovado_por": string | null,"criado_em": string,"destino_planejamentos": string | null,"email": string,"etapa_solicitada_id": number | null,"id": string,"nome": string,"papel": Database["public"]['Enums']["papel"],"removido_em": string | null,"removido_por": string | null,"status": Database["public"]['Enums']["status_usuario"]
                  }
                  ComputedFields: never
                  Insert: {
                    "aprovado_em"?: string | null,"aprovado_por"?: string | null,"criado_em"?: string,"destino_planejamentos"?: string | null,"email": string,"etapa_solicitada_id"?: number | null,"id": string,"nome": string,"papel"?: Database["public"]['Enums']["papel"],"removido_em"?: string | null,"removido_por"?: string | null,"status"?: Database["public"]['Enums']["status_usuario"]
                  }
                  Update: {
                    "aprovado_em"?: string | null,"aprovado_por"?: string | null,"criado_em"?: string,"destino_planejamentos"?: string | null,"email"?: string,"etapa_solicitada_id"?: number | null,"id"?: string,"nome"?: string,"papel"?: Database["public"]['Enums']["papel"],"removido_em"?: string | null,"removido_por"?: string | null,"status"?: Database["public"]['Enums']["status_usuario"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "perfis_aprovado_por_fkey"
      columns: ["aprovado_por"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "perfis_etapa_solicitada_id_fkey"
      columns: ["etapa_solicitada_id"]
isOneToOne: false
      referencedRelation: "etapas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "perfis_removido_por_fkey"
      columns: ["removido_por"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    }
                  ]
                },"turmas": {
                  Row: {
                    "ano_letivo": number,"ativa": boolean,"definido_em": string,"definido_por_id": string | null,"definido_por_nivel": number,"etapa_id": number,"id": number,"nome": string,"turno_padrao": Database["public"]['Enums']["turno"]
                  }
                  ComputedFields: never
                  Insert: {
                    "ano_letivo"?: number,"ativa"?: boolean,"definido_em"?: string,"definido_por_id"?: string | null,"definido_por_nivel"?: number,"etapa_id": number,"id"?: never,"nome": string,"turno_padrao"?: Database["public"]['Enums']["turno"]
                  }
                  Update: {
                    "ano_letivo"?: number,"ativa"?: boolean,"definido_em"?: string,"definido_por_id"?: string | null,"definido_por_nivel"?: number,"etapa_id"?: number,"id"?: never,"nome"?: string,"turno_padrao"?: Database["public"]['Enums']["turno"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "turmas_definido_por_id_fkey"
      columns: ["definido_por_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "turmas_etapa_id_fkey"
      columns: ["etapa_id"]
isOneToOne: false
      referencedRelation: "etapas"
      referencedColumns: ["id"]
    }
                  ]
                },"vinculos": {
                  Row: {
                    "ativo": boolean,"definido_em": string,"definido_por_id": string | null,"definido_por_nivel": number,"disciplina_id": number | null,"etapa_id": number,"id": number,"regente": boolean,"turma_id": number | null,"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ativo"?: boolean,"definido_em"?: string,"definido_por_id"?: string | null,"definido_por_nivel"?: number,"disciplina_id"?: number | null,"etapa_id": number,"id"?: never,"regente"?: boolean,"turma_id"?: number | null,"usuario_id": string
                  }
                  Update: {
                    "ativo"?: boolean,"definido_em"?: string,"definido_por_id"?: string | null,"definido_por_nivel"?: number,"disciplina_id"?: number | null,"etapa_id"?: number,"id"?: never,"regente"?: boolean,"turma_id"?: number | null,"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vinculos_definido_por_id_fkey"
      columns: ["definido_por_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vinculos_disciplina_id_fkey"
      columns: ["disciplina_id"]
isOneToOne: false
      referencedRelation: "disciplinas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vinculos_etapa_id_fkey"
      columns: ["etapa_id"]
isOneToOne: false
      referencedRelation: "etapas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vinculos_turma_id_fkey"
      columns: ["turma_id"]
isOneToOne: false
      referencedRelation: "turmas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vinculos_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "alterar_vinculos":
{ Args: { "p_usuario": string,"p_vinculos": Json }; Returns: undefined
                           },
"aprovar_usuario":
{ Args: { "p_papel": Database["public"]['Enums']["papel"],"p_usuario": string,"p_vinculos"?: Json }; Returns: undefined
                           },
"coordena_usuario":
{ Args: { "p_alvo": string }; Returns: boolean
                           },
"desativar_turma":
{ Args: { "p_id": number }; Returns: undefined
                           },
"gravar_vinculos":
{ Args: { "p_usuario": string,"p_vinculos": Json }; Returns: undefined
                           },
"meu_nivel":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"meu_papel":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["papel"]
                           },
"meu_perfil_ativo":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"minhas_etapas":
{ Args: Record<PropertyKey, never>; Returns: (number)[]
                           },
"nivel_papel":
{ Args: { "p": Database["public"]['Enums']["papel"] }; Returns: number
                           },
"pode_aprovar":
{ Args: { "p_etapa": number,"p_papel": Database["public"]['Enums']["papel"] }; Returns: boolean
                           },
"pode_editar_etapa":
{ Args: { "p_etapa": number }; Returns: boolean
                           },
"pode_gerenciar":
{ Args: { "p_alvo": string }; Returns: boolean
                           },
"recusar_usuario":
{ Args: { "p_usuario": string }; Returns: undefined
                           },
"remover_usuario":
{ Args: { "p_destino"?: string,"p_usuario": string }; Returns: undefined
                           },
"rotulo_nivel":
{ Args: { "nivel": number }; Returns: string
                           },
"rotulo_nivel_com_artigo":
{ Args: { "nivel": number }; Returns: string
                           },
"salvar_turma":
{ Args: { "p_etapa": number,"p_id": number,"p_nome": string,"p_turno": Database["public"]['Enums']["turno"] }; Returns: number
                           },
"validar_vinculos":
{ Args: { "p_papel": Database["public"]['Enums']["papel"],"p_vinculos": Json }; Returns: undefined
                           }
          }
          Enums: {
            "papel": "administrador"|"diretor"|"secretaria"|"coordenador"|"professor","status_usuario": "pendente"|"ativo"|"recusado"|"removido","turno": "matutino"|"vespertino"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "papel": ["administrador", "diretor", "secretaria", "coordenador", "professor"],"status_usuario": ["pendente", "ativo", "recusado", "removido"],"turno": ["matutino", "vespertino"]
          }
        }
} as const

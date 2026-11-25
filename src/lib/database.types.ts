
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
            "atividades": {
                  Row: {
                    "arquivo_caminho": string,"arquivo_nome": string,"arquivo_tamanho": number,"arquivo_tipo": string,"avaliada_em": string | null,"avaliada_por": string | null,"bloco_id": number | null,"disciplina_id": number,"etapa_id": number,"id": number,"motivo_recusa": string | null,"proposta_em": string,"proposta_por": string,"status": Database["public"]['Enums']["status_atividade"],"tema": string,"titulo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "arquivo_caminho": string,"arquivo_nome": string,"arquivo_tamanho": number,"arquivo_tipo": string,"avaliada_em"?: string | null,"avaliada_por"?: string | null,"bloco_id"?: number | null,"disciplina_id": number,"etapa_id": number,"id"?: never,"motivo_recusa"?: string | null,"proposta_em"?: string,"proposta_por": string,"status"?: Database["public"]['Enums']["status_atividade"],"tema": string,"titulo": string
                  }
                  Update: {
                    "arquivo_caminho"?: string,"arquivo_nome"?: string,"arquivo_tamanho"?: number,"arquivo_tipo"?: string,"avaliada_em"?: string | null,"avaliada_por"?: string | null,"bloco_id"?: number | null,"disciplina_id"?: number,"etapa_id"?: number,"id"?: never,"motivo_recusa"?: string | null,"proposta_em"?: string,"proposta_por"?: string,"status"?: Database["public"]['Enums']["status_atividade"],"tema"?: string,"titulo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "atividades_avaliada_por_fkey"
      columns: ["avaliada_por"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "atividades_bloco_id_fkey"
      columns: ["bloco_id"]
isOneToOne: false
      referencedRelation: "blocos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "atividades_disciplina_id_fkey"
      columns: ["disciplina_id"]
isOneToOne: false
      referencedRelation: "disciplinas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "atividades_etapa_id_fkey"
      columns: ["etapa_id"]
isOneToOne: false
      referencedRelation: "etapas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "atividades_proposta_por_fkey"
      columns: ["proposta_por"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    }
                  ]
                },"blocos": {
                  Row: {
                    "arquivado_em": string | null,"atividades": string,"atualizado_em": string,"atualizado_por": string | null,"avaliacao": string,"conteudo": string,"criado_em": string,"disciplina_id": number,"estrategias": string,"excluido_em": string | null,"habilidades": (Database["public"]['Enums']["inteligencia"])[],"hora_fim": string,"hora_inicio": string,"id": number,"linguagens_amor": (Database["public"]['Enums']["linguagem_amor"])[],"objetivos": string,"planejamento_id": number,"professor_id": string,"recursos": string,"status": Database["public"]['Enums']["status_bloco"],"versao": number
                  }
                  ComputedFields: never
                  Insert: {
                    "arquivado_em"?: string | null,"atividades"?: string,"atualizado_em"?: string,"atualizado_por"?: string | null,"avaliacao"?: string,"conteudo"?: string,"criado_em"?: string,"disciplina_id": number,"estrategias"?: string,"excluido_em"?: string | null,"habilidades"?: (Database["public"]['Enums']["inteligencia"])[],"hora_fim": string,"hora_inicio": string,"id"?: never,"linguagens_amor"?: (Database["public"]['Enums']["linguagem_amor"])[],"objetivos"?: string,"planejamento_id": number,"professor_id": string,"recursos"?: string,"status"?: Database["public"]['Enums']["status_bloco"],"versao"?: number
                  }
                  Update: {
                    "arquivado_em"?: string | null,"atividades"?: string,"atualizado_em"?: string,"atualizado_por"?: string | null,"avaliacao"?: string,"conteudo"?: string,"criado_em"?: string,"disciplina_id"?: number,"estrategias"?: string,"excluido_em"?: string | null,"habilidades"?: (Database["public"]['Enums']["inteligencia"])[],"hora_fim"?: string,"hora_inicio"?: string,"id"?: never,"linguagens_amor"?: (Database["public"]['Enums']["linguagem_amor"])[],"objetivos"?: string,"planejamento_id"?: number,"professor_id"?: string,"recursos"?: string,"status"?: Database["public"]['Enums']["status_bloco"],"versao"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "blocos_atualizado_por_fkey"
      columns: ["atualizado_por"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "blocos_disciplina_id_fkey"
      columns: ["disciplina_id"]
isOneToOne: false
      referencedRelation: "disciplinas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "blocos_planejamento_id_fkey"
      columns: ["planejamento_id"]
isOneToOne: false
      referencedRelation: "planejamentos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "blocos_professor_id_fkey"
      columns: ["professor_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    }
                  ]
                },"dias_sem_aula": {
                  Row: {
                    "data": string,"definido_em": string,"definido_por_id": string | null,"definido_por_nivel": number,"descricao": string,"etapa_id": number | null,"id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "data": string,"definido_em"?: string,"definido_por_id"?: string | null,"definido_por_nivel"?: number,"descricao": string,"etapa_id"?: number | null,"id"?: never
                  }
                  Update: {
                    "data"?: string,"definido_em"?: string,"definido_por_id"?: string | null,"definido_por_nivel"?: number,"descricao"?: string,"etapa_id"?: number | null,"id"?: never
                  }
                  Relationships: [
                    {
      foreignKeyName: "dias_sem_aula_definido_por_id_fkey"
      columns: ["definido_por_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dias_sem_aula_etapa_id_fkey"
      columns: ["etapa_id"]
isOneToOne: false
      referencedRelation: "etapas"
      referencedColumns: ["id"]
    }
                  ]
                },"disciplinas": {
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
                },"entregas": {
                  Row: {
                    "entregue_em": string,"id": number,"periodo_id": number,"professor_id": string,"situacao": Database["public"]['Enums']["situacao_entrega"],"turma_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "entregue_em": string,"id"?: never,"periodo_id": number,"professor_id": string,"situacao": Database["public"]['Enums']["situacao_entrega"],"turma_id": number
                  }
                  Update: {
                    "entregue_em"?: string,"id"?: never,"periodo_id"?: number,"professor_id"?: string,"situacao"?: Database["public"]['Enums']["situacao_entrega"],"turma_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "entregas_periodo_id_fkey"
      columns: ["periodo_id"]
isOneToOne: false
      referencedRelation: "periodos_entrega"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "entregas_professor_id_fkey"
      columns: ["professor_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "entregas_turma_id_fkey"
      columns: ["turma_id"]
isOneToOne: false
      referencedRelation: "turmas"
      referencedColumns: ["id"]
    }
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
                },"historico_blocos": {
                  Row: {
                    "autor_id": string | null,"bloco_id": number,"campo": string,"em": string,"id": number,"valor_anterior": string | null,"valor_novo": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "autor_id"?: string | null,"bloco_id": number,"campo": string,"em"?: string,"id"?: never,"valor_anterior"?: string | null,"valor_novo"?: string | null
                  }
                  Update: {
                    "autor_id"?: string | null,"bloco_id"?: number,"campo"?: string,"em"?: string,"id"?: never,"valor_anterior"?: string | null,"valor_novo"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "historico_blocos_bloco_id_fkey"
      columns: ["bloco_id"]
isOneToOne: false
      referencedRelation: "blocos"
      referencedColumns: ["id"]
    }
                  ]
                },"horarios": {
                  Row: {
                    "definido_em": string,"definido_por_id": string | null,"definido_por_nivel": number,"dia_semana": number,"disciplina_id": number,"hora_fim": string,"hora_inicio": string,"id": number,"professor_id": string,"turma_id": number,"vigente_ate": string | null,"vigente_desde": string
                  }
                  ComputedFields: never
                  Insert: {
                    "definido_em"?: string,"definido_por_id"?: string | null,"definido_por_nivel"?: number,"dia_semana": number,"disciplina_id": number,"hora_fim": string,"hora_inicio": string,"id"?: never,"professor_id": string,"turma_id": number,"vigente_ate"?: string | null,"vigente_desde": string
                  }
                  Update: {
                    "definido_em"?: string,"definido_por_id"?: string | null,"definido_por_nivel"?: number,"dia_semana"?: number,"disciplina_id"?: number,"hora_fim"?: string,"hora_inicio"?: string,"id"?: never,"professor_id"?: string,"turma_id"?: number,"vigente_ate"?: string | null,"vigente_desde"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "horarios_definido_por_id_fkey"
      columns: ["definido_por_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "horarios_disciplina_id_fkey"
      columns: ["disciplina_id"]
isOneToOne: false
      referencedRelation: "disciplinas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "horarios_professor_id_fkey"
      columns: ["professor_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "horarios_turma_id_fkey"
      columns: ["turma_id"]
isOneToOne: false
      referencedRelation: "turmas"
      referencedColumns: ["id"]
    }
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
                },"notas": {
                  Row: {
                    "autor_id": string,"criado_em": string,"id": number,"planejamento_id": number,"texto": string
                  }
                  ComputedFields: never
                  Insert: {
                    "autor_id"?: string,"criado_em"?: string,"id"?: never,"planejamento_id": number,"texto": string
                  }
                  Update: {
                    "autor_id"?: string,"criado_em"?: string,"id"?: never,"planejamento_id"?: number,"texto"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notas_autor_id_fkey"
      columns: ["autor_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notas_planejamento_id_fkey"
      columns: ["planejamento_id"]
isOneToOne: false
      referencedRelation: "planejamentos"
      referencedColumns: ["id"]
    }
                  ]
                },"notificacoes": {
                  Row: {
                    "criada_em": string,"entrega_id": number | null,"id": number,"lida_em": string | null,"link": string | null,"mensagem": string,"tipo": string,"titulo": string,"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "criada_em"?: string,"entrega_id"?: number | null,"id"?: never,"lida_em"?: string | null,"link"?: string | null,"mensagem": string,"tipo": string,"titulo": string,"usuario_id": string
                  }
                  Update: {
                    "criada_em"?: string,"entrega_id"?: number | null,"id"?: never,"lida_em"?: string | null,"link"?: string | null,"mensagem"?: string,"tipo"?: string,"titulo"?: string,"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notificacoes_entrega_id_fkey"
      columns: ["entrega_id"]
isOneToOne: false
      referencedRelation: "entregas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notificacoes_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    }
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
                },"periodos_entrega": {
                  Row: {
                    "definido_em": string,"definido_por_id": string | null,"definido_por_nivel": number,"fim": string,"id": number,"inicio": string,"prazo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "definido_em"?: string,"definido_por_id"?: string | null,"definido_por_nivel"?: number,"fim": string,"id"?: never,"inicio": string,"prazo": string
                  }
                  Update: {
                    "definido_em"?: string,"definido_por_id"?: string | null,"definido_por_nivel"?: number,"fim"?: string,"id"?: never,"inicio"?: string,"prazo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "periodos_entrega_definido_por_id_fkey"
      columns: ["definido_por_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    }
                  ]
                },"planejamentos": {
                  Row: {
                    "atualizado_em": string,"criado_em": string,"criado_por": string | null,"data": string,"id": number,"turma_id": number,"turno": Database["public"]['Enums']["turno"]
                  }
                  ComputedFields: never
                  Insert: {
                    "atualizado_em"?: string,"criado_em"?: string,"criado_por"?: string | null,"data": string,"id"?: never,"turma_id": number,"turno": Database["public"]['Enums']["turno"]
                  }
                  Update: {
                    "atualizado_em"?: string,"criado_em"?: string,"criado_por"?: string | null,"data"?: string,"id"?: never,"turma_id"?: number,"turno"?: Database["public"]['Enums']["turno"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "planejamentos_criado_por_fkey"
      columns: ["criado_por"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "planejamentos_turma_id_fkey"
      columns: ["turma_id"]
isOneToOne: false
      referencedRelation: "turmas"
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
            "abrir_planejamento":
{ Args: { "p_data": string,"p_turma": number,"p_turno": Database["public"]['Enums']["turno"] }; Returns: number
                           },
"alterar_vinculos":
{ Args: { "p_usuario": string,"p_vinculos": Json }; Returns: undefined
                           },
"aprovar_usuario":
{ Args: { "p_papel": Database["public"]['Enums']["papel"],"p_usuario": string,"p_vinculos"?: Json }; Returns: undefined
                           },
"avaliar_atividade":
{ Args: { "p_aprovar": boolean,"p_id": number,"p_motivo"?: string,"p_tema"?: string,"p_titulo"?: string }; Returns: undefined
                           },
"avaliar_entregas_do_periodo":
{ Args: { "p_periodo": number }; Returns: undefined
                           },
"coordena_usuario":
{ Args: { "p_alvo": string }; Returns: boolean
                           },
"criar_bloco":
{ Args: { "p_disciplina": number,"p_fim": string,"p_inicio": string,"p_planejamento": number }; Returns: number
                           },
"desativar_turma":
{ Args: { "p_id": number }; Returns: undefined
                           },
"dias_uteis_entre":
{ Args: { "a": string,"b": string,"p_etapa"?: number }; Returns: number
                           },
"exigir_direcao_ou_secretaria":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"feriados_nacionais":
{ Args: { "p_ano": number }; Returns: {
              "data": string,"descricao": string
            }[]
                           },
"gravar_vinculos":
{ Args: { "p_usuario": string,"p_vinculos": Json }; Returns: undefined
                           },
"ha_aula":
{ Args: { "p_data": string,"p_etapa"?: number }; Returns: boolean
                           },
"horario_vigente":
{ Args: { "h": Omit<Database["public"]['Tables']["horarios"]['Row'], Database["public"]['Tables']["horarios"]['ComputedFields']>,"p_data": string }; Returns: boolean
                           },
"importar_feriados_nacionais":
{ Args: { "p_ano": number }; Returns: number
                           },
"leciona":
{ Args: { "p_disciplina": number,"p_turma": number }; Returns: boolean
                           },
"limite_arquivo":
{ Args: { "p_tipo": string }; Returns: number
                           },
"marcar_notificacoes_lidas":
{ Args: { "p_ids"?: (number)[] }; Returns: undefined
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
"nomes_usuarios":
{ Args: { "p_ids": (string)[] }; Returns: {
              "id": string,"nome": string
            }[]
                           },
"notificar":
{ Args: { "p_link": string,"p_mensagem": string,"p_tipo": string,"p_titulo": string,"p_usuario": string }; Returns: undefined
                           },
"pascoa":
{ Args: { "p_ano": number }; Returns: string
                           },
"periodo_concluido":
{ Args: { "p_periodo": number,"p_professor": string,"p_turma": number }; Returns: boolean
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
"pode_ver_etapa":
{ Args: { "p_etapa": number }; Returns: boolean
                           },
"pode_ver_planejamento":
{ Args: { "p_planejamento": number }; Returns: boolean
                           },
"pode_ver_turma":
{ Args: { "p_turma": number }; Returns: boolean
                           },
"propor_atividade":
{ Args: { "p_bloco": number,"p_caminho": string,"p_nome": string,"p_tamanho": number,"p_tema": string,"p_tipo": string,"p_titulo": string }; Returns: number
                           },
"reavaliar_periodos_da_data":
{ Args: { "p_data": string }; Returns: undefined
                           },
"recusar_usuario":
{ Args: { "p_usuario": string }; Returns: undefined
                           },
"registrar_entrega":
{ Args: { "p_entregue_em": string,"p_notificar": boolean,"p_periodo": number,"p_professor": string,"p_turma": number }; Returns: undefined
                           },
"remover_atividade":
{ Args: { "p_id": number }; Returns: undefined
                           },
"remover_bloco":
{ Args: { "p_id": number }; Returns: undefined
                           },
"remover_dia_sem_aula":
{ Args: { "p_id": number }; Returns: undefined
                           },
"remover_periodo":
{ Args: { "p_id": number }; Returns: undefined
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
"rotulo_situacao":
{ Args: { "s": Database["public"]['Enums']["situacao_entrega"] }; Returns: string
                           },
"salvar_bloco":
{ Args: { "p_campos": Json,"p_id": number,"p_versao": number }; Returns: Json
                           },
"salvar_dia_sem_aula":
{ Args: { "p_data": string,"p_descricao": string,"p_etapa"?: number,"p_id": number }; Returns: number
                           },
"salvar_grade":
{ Args: { "p_aulas": Json,"p_turma": number,"p_vigente_desde": string }; Returns: undefined
                           },
"salvar_periodo":
{ Args: { "p_fim": string,"p_id": number,"p_inicio": string,"p_prazo": string }; Returns: number
                           },
"salvar_turma":
{ Args: { "p_etapa": number,"p_id": number,"p_nome": string,"p_turno": Database["public"]['Enums']["turno"] }; Returns: number
                           },
"situacao_da_entrega":
{ Args: { "p_entregue": string,"p_etapa"?: number,"p_prazo": string }; Returns: Database["public"]['Enums']["situacao_entrega"]
                           },
"validar_vinculos":
{ Args: { "p_papel": Database["public"]['Enums']["papel"],"p_vinculos": Json }; Returns: undefined
                           }
          }
          Enums: {
            "inteligencia": "linguistica"|"logico_matematica"|"espacial"|"corporal_cinestesica"|"musical"|"interpessoal"|"intrapessoal"|"naturalista","linguagem_amor": "palavras_afirmacao"|"tempo_qualidade"|"presentes"|"atos_servico"|"toque_fisico","papel": "administrador"|"diretor"|"secretaria"|"coordenador"|"professor","situacao_entrega": "antecipado"|"no_prazo"|"atrasado","status_atividade": "pendente"|"aprovada"|"recusada","status_bloco": "cinza"|"amarelo"|"verde","status_usuario": "pendente"|"ativo"|"recusado"|"removido","turno": "matutino"|"vespertino"
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
            "inteligencia": ["linguistica", "logico_matematica", "espacial", "corporal_cinestesica", "musical", "interpessoal", "intrapessoal", "naturalista"],"linguagem_amor": ["palavras_afirmacao", "tempo_qualidade", "presentes", "atos_servico", "toque_fisico"],"papel": ["administrador", "diretor", "secretaria", "coordenador", "professor"],"situacao_entrega": ["antecipado", "no_prazo", "atrasado"],"status_atividade": ["pendente", "aprovada", "recusada"],"status_bloco": ["cinza", "amarelo", "verde"],"status_usuario": ["pendente", "ativo", "recusado", "removido"],"turno": ["matutino", "vespertino"]
          }
        }
} as const

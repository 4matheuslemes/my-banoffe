# DECISIONS.md — Decisões Técnicas e de Arquitetura do Banoffe Bot

Este documento registra as decisões tomadas durante a implementação do **Banoffe Bot**, de acordo com as diretrizes do projeto.

---

### 1. Modelo de IA e Provedor
- **Modelo Padrão:** `gemini-3.8-flash` (configurável via variável `GEMINI_MODEL`).
- **SDK:** `@google/genai` (SDK oficial unificado do Google AI Studio).
- **Function Calling:** As ferramentas foram mapeadas diretamente para `functionDeclarations` utilizando `parametersJsonSchema: t.input_schema`. Assegurou-se tipagem segura e compatibilidade com o formato esperado pelo Gemini.
- **Tratamento de Limite de Taxa (Rate Limit / 429):** O webhook captura exceções e retorna uma mensagem amigável ("Deu um erro aqui. Tenta de novo em instantes.") sem entrar em loops de retentativa que poderiam agravar o bloqueio ou consumir cotas.

---

### 2. Idempotência e Segurança no Webhook
- **Idempotência do Telegram:** O Telegram reenvia requisições se a resposta demorar mais de alguns segundos. Inserimos `update_id` na tabela `telegram_updates` logo no início. Se a inserção falhar por chave duplicada (`dupErr`), o webhook retorna `{ ok: true }` imediatamente sem reprocessar o pedido.
- **Segredo do Webhook:** Validação rigorosa via header `x-telegram-bot-api-secret-token` contra `TELEGRAM_WEBHOOK_SECRET`. Requisições inválidas recebem HTTP 403 `forbidden`.
- **Lista de IDs Autorizados (`ALLOWED_TELEGRAM_IDS`):** Compara `String(msg.from?.id)` com os IDs numéricos permitidos. Mensagens de usuários não autorizados são ignoradas silenciosamente retornando `{ ok: true }`, evitando vazamento de informações ou custos desnecessários com tokens de IA.

---

### 3. Fuso Horário e Datas
- **Fuso Horário:** Fixo em `America/Campo_Grande` (UTC-4, sem horário de verão).
- **Cálculo de Períodos:** A semana se inicia na segunda-feira (`(dow + 6) % 7`).
- **Armazenamento de Gastos:** A tabela `gastos` utiliza `(now() at time zone 'America/Campo_Grande')::date` por padrão para refletir o dia fiscal correto no fuso de Campo Grande.

---

### 4. Desambiguação de Pedidos e Ações Críticas
- **Desambiguação em `marcar_pago` e `marcar_entregue`:** Quando houver mais de um pedido em aberto para o cliente (ou nomes com busca ambígua) e `todos` não for especificado, a ferramenta retorna `{ ambiguo: true, opcoes: [...] }` para que o bot pergunte ao usuário qual pedido deve ser atualizado.
- **Cancelamento:** A ferramenta `cancelar_pedido` só é disparada pelo agente após confirmação explícita da usuária, conforme instrução do sistema.

---

### 5. Supabase e Políticas de Acesso
- **Row Level Security (RLS):** RLS está habilitado em todas as tabelas (`pedidos`, `gastos`, `mensagens`, `telegram_updates`, `config`).
- **Sem policies públicas:** O acesso é exclusivo do backend Next.js através do `SUPABASE_SERVICE_ROLE_KEY`. Nenhuma chave pública ou acesso direto de cliente é exposto.

---

### 6. Endpoint de Healthcheck e Interface Web
- **GET /api/telegram:** Adicionada resposta `{ status: "online", bot: "Banoffe Bot" }` para facilitar a validação do deploy na Vercel e healthchecks.
- **Landing Page (`/`):** Criada uma página elegante de status e apresentação com visual refinado, exibindo a arquitetura, status do webhook e instruções de operação.

---

### 7. Resiliência no Build do Next.js
- **Fallbacks em tempo de build:** `src/lib/supabase.ts` conta com fallbacks seguros de inicialização para permitir que `npm run build` execute sem falhar mesmo antes de as variáveis de ambiente estarem configuradas localmente ou durante fases de compilação estática do Next.js.
- **Rota Dinâmica:** `src/app/api/telegram/route.ts` declara `export const dynamic = "force-dynamic"`, garantindo execução serverless em tempo real sem pré-renderização estática.

---

### 8. Migração para Bot Sem IA (Motor Determinístico por Regras/Regex)
- **Motivação:** Fim de cotas (429) e instabilidade de latência/serviço (503) em APIs de IA gratuitas.
- **Arquitetura:** `src/lib/agent.ts` agora utiliza um interpretador baseado em expressões regulares e regras semânticas determinísticas em português, com latência zero e custo 100% gratuito.
- **Desambiguação Aprimorada:** Em `src/lib/tools.ts`, `acharPedidos` prioriza correspondência exata de nomes de clientes (ex.: "Ana" não coincide com "Mariana").
- **Remoção de Pacotes:** `@google/genai` foi completamente desinstalado e as variáveis `GEMINI_API_KEY` e `GEMINI_MODEL` foram removidas.


# Banoffe Bot 🍌🥧

Assistente inteligente no Telegram com IA (Google Gemini) para gestão de vendas caseiras de **banoffe no pote**, controlando pedidos, pagamentos, entregas, gastos e relatórios financeiros em linguagem natural.

---

## 🚀 Tecnologias

- **Framework:** Next.js (App Router) + TypeScript
- **Hospedagem:** Vercel (Serverless Functions)
- **Banco de Dados:** Supabase (PostgreSQL) com Service Role Key e RLS
- **IA:** Google Gemini (`gemini-3.8-flash` ou outro modelo gratuito do Google AI Studio) via `@google/genai`
- **Mensageria:** Telegram Bot API (Webhook)

---

## 📂 Estrutura de Arquivos

```
src/
  app/
    api/telegram/route.ts   # Webhook do Telegram (POST) e Healthcheck (GET)
    page.tsx                # Interface visual de status do sistema
    layout.tsx              # Layout base do Next.js
    globals.css             # Estilos modernos da landing page
  lib/
    supabase.ts             # Cliente Supabase com Service Role
    telegram.ts             # Funções de envio de mensagem e typing
    dates.ts                # Utilitários de fuso horário (America/Campo_Grande)
    tools.ts                # Definição e execução de ferramentas (Function Calling)
    agent.ts                # Integração com Gemini, histórico e loop de agente
supabase/
  schema.sql                # Tabelas, índices e RLS
.env.example                # Modelo de variáveis de ambiente
DECISIONS.md                # Registro de decisões técnicas tomadas
README.md                   # Documentação completa
```

---

## ⚙️ Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz (e configure na Vercel):

```env
GEMINI_API_KEY=sua_chave_do_google_ai_studio
GEMINI_MODEL=gemini-3.8-flash
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
TELEGRAM_BOT_TOKEN=token_do_botfather
TELEGRAM_WEBHOOK_SECRET=string_secreta_longa_e_aleatoria
ALLOWED_TELEGRAM_IDS=11111111,22222222
```

> **Atenção:** `SUPABASE_SERVICE_ROLE_KEY` nunca deve ser compartilhada publicamente ou exposta no cliente.

---

## 🛠️ Passo a Passo de Configuração

### 1. Telegram
1. Abra o Telegram e converse com o [@BotFather](https://t.me/BotFather).
2. Envie `/newbot`, escolha um nome e um username para o bot.
3. Copie o **Token HTTP API** gerado e guarde para `TELEGRAM_BOT_TOKEN`.
4. Para saber o ID numérico dos usuários autorizados, cada pessoa deve mandar uma mensagem para [@userinfobot](https://t.me/userinfobot) e anotar o `Id`. Insira esses números separados por vírgula em `ALLOWED_TELEGRAM_IDS`.

### 2. Supabase
1. Crie um projeto gratuito em [supabase.com](https://supabase.com).
2. Abra o **SQL Editor** do projeto.
3. Cole e execute todo o conteúdo de `supabase/schema.sql`.
4. Em **Project Settings > API**, copie a **Project URL** (`SUPABASE_URL`) e a chave `service_role` secreta (`SUPABASE_SERVICE_ROLE_KEY`).
5. (Opcional) Ajuste o preço padrão do pote na tabela `config` caso não seja R$ 12,00.

### 3. Google Gemini (Google AI Studio - Plano Gratuito)
1. Acesse [aistudio.google.com/apikey](https://aistudio.google.com/apikey) com sua conta Google.
2. Clique em **Create API key** e copie o valor para `GEMINI_API_KEY`.
3. Certifique-se de que o billing não está ativado e que você está usando o plano gratuito.
4. Mantenha `GEMINI_MODEL=gemini-3.8-flash` ou altere para outro modelo gratuito disponível.

### 4. Deploy na Vercel
1. Envie o projeto para seu repositório no GitHub/GitLab.
2. Importe o repositório na [Vercel](https://vercel.com).
3. Em **Settings > Environment Variables**, adicione todas as 7 variáveis listadas acima.
4. Clique em **Deploy**.

### 5. Registrar o Webhook do Telegram
Após a conclusão do deploy na Vercel, execute o seguinte comando no seu terminal (substituindo `<TOKEN>`, `<SEU-DOMINIO>` e `<SECRET>`):

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://<SEU-DOMINIO>.vercel.app/api/telegram" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

Para verificar o status do webhook configurado:

```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

---

## 🧪 Testes de Aceitação

Abra seu bot no Telegram e teste os seguintes comandos em linguagem natural:

1. **Criar pedido simples:**
   - Envie: *"Ana pediu 3 banoffes"*
   - Esperado: Confirmação com cliente, 3 potes, valor total calculado (ex: R$ 36,00) e status não pago.
2. **Registrar pagamento:**
   - Envie: *"Ana pagou"*
   - Esperado: Confirmação de que o pedido da Ana foi marcado como pago.
3. **Desambiguação de pedidos:**
   - Envie: *"Ana pediu mais 2"* e depois *"Ana pagou"*.
   - Esperado: Se houver apenas um não pago, marca diretamente. Se houver mais de um em aberto, apresenta as opções para escolher.
4. **Data de entrega relativa:**
   - Envie: *"Bia pediu 2 pra sexta"*
   - Esperado: Registra o pedido com `data_entrega` na próxima sexta-feira.
5. **Filtrar por data de entrega:**
   - Envie: *"o que tenho pra entregar sexta?"*
   - Esperado: Lista apenas os pedidos agendados para aquela data.
6. **Registrar despesa:**
   - Envie: *"comprei leite condensado 28"*
   - Esperado: Confirmação do gasto de R$ 28,00 registrado com a data de hoje.
7. **Consultar inadimplentes:**
   - Envie: *"quem ainda não pagou?"*
   - Esperado: Lista com todos os pedidos em aberto com `pago = false`.
8. **Relatório financeiro do período:**
   - Envie: *"quanto vendi essa semana?"*
   - Esperado: Resumo detalhado contendo vendido, recebido, a receber, gastos e lucro estimado.
9. **Segurança de cancelamento:**
   - Envie: *"cancela o pedido da Bia"*
   - Esperado: O bot solicita confirmação explícita antes de efetuar o cancelamento.
10. **Proteção de acesso:**
    - Mensagem vinda de um ID que não consta em `ALLOWED_TELEGRAM_IDS` é ignorada sem resposta.
11. **Idempotência:**
    - Repetição de um mesmo update pelo Telegram não duplica registros.

---

## 📄 Licença

Projeto desenvolvido sob a licença MIT.

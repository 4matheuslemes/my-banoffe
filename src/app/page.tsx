export default function Home() {
  return (
    <main className="container">
      <header>
        <div className="badge">
          <span className="badge-dot" />
          Webhook do Telegram Ativo
        </div>
        <h1>Banoffe Bot 🍌🥧</h1>
        <p className="subtitle">
          Assistente inteligente com IA no Telegram para controle ágil de pedidos,
          entregas, pagamentos e finanças de banoffe caseiro no pote.
        </p>
      </header>

      <div className="grid">
        <div className="card">
          <h2 className="card-title">📦 Gestão de Pedidos</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: "14px" }}>
            Linguagem natural para cadastrar, desambiguar e acompanhar entregas.
          </p>
          <div className="prompt-list">
            <div className="prompt-item">
              <span>&ldquo;Ana pediu 3 banoffes&rdquo;</span>
              <code>Novo pedido</code>
            </div>
            <div className="prompt-item">
              <span>&ldquo;Bia pediu 2 pra sexta&rdquo;</span>
              <code>Entrega agendada</code>
            </div>
            <div className="prompt-item">
              <span>&ldquo;O que tenho pra entregar sexta?&rdquo;</span>
              <code>Filtro data</code>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">💳 Pagamentos & Cobrança</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: "14px" }}>
            Baixas automáticas e controle de quem está devendo.
          </p>
          <div className="prompt-list">
            <div className="prompt-item">
              <span>&ldquo;Ana pagou&rdquo;</span>
              <code>Baixa de pagamento</code>
            </div>
            <div className="prompt-item">
              <span>&ldquo;Quem ainda não me pagou?&rdquo;</span>
              <code>Lista devedores</code>
            </div>
            <div className="prompt-item">
              <span>&ldquo;Cancela o pedido da Bia&rdquo;</span>
              <code>Confirmação segura</code>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">📊 Gastos & Lucratividade</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: "14px" }}>
            Registro de insumos e balanço de lucros por período.
          </p>
          <div className="prompt-list">
            <div className="prompt-item">
              <span>&ldquo;Comprei leite condensado 28&rdquo;</span>
              <code>Novo gasto</code>
            </div>
            <div className="prompt-item">
              <span>&ldquo;Quanto vendi essa semana?&rdquo;</span>
              <code>Resumo semanal</code>
            </div>
            <div className="prompt-item">
              <span>&ldquo;Resumo do mês&rdquo;</span>
              <code>Lucro e caixa</code>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">⚙️ Arquitetura Integrada</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: "14px" }}>
            Tecnologias modernas sem nenhum custo fixo (Free Tier).
          </p>
          <div style={{ marginTop: "10px" }}>
            <span className="tech-tag">Next.js 15 (App Router)</span>
            <span className="tech-tag">Supabase (PostgreSQL + RLS)</span>
            <span className="tech-tag">Google Gemini (Free AI Studio)</span>
            <span className="tech-tag">Telegram Bot API</span>
            <span className="tech-tag">Vercel Serverless</span>
          </div>
        </div>
      </div>

      <footer>
        <p>Banoffe Bot &bull; Operando no fuso horário de Campo Grande (America/Campo_Grande)</p>
      </footer>
    </main>
  );
}

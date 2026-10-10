// Versão SEM IA: interpreta frases por regras. Gratuito, instantâneo, sem cotas.
import { runTool, getPreco } from "./tools";
import { todayStr, addDays } from "./dates";

type Modo = "auto" | "tudo" | "primeiro" | "ultimo";
type Periodo = "hoje" | "semana" | "mes" | "tudo";

const PALAVRAS: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, doze: 12,
};

const AJUDA = `Oi! Eu anoto os pedidos de banoffe. Exemplos:

📝 Pedidos
• Ana pediu 3 banoffes
• Ana pediu 2 pra sexta
• Bia pediu 4 a R$ 15 cada
• Ana pagou  (ou: Ana pagou tudo)
• Ana recebeu  (ou: entreguei Ana)

📋 Consultas
• quem não pagou
• o que tenho pra entregar amanhã
• pedidos  (ou: pedidos da Ana)

💸 Gastos
• comprei leite condensado 28
• gastos mês

📊 Resumo
• resumo  (ou: resumo hoje, resumo mês)

💰 Preço do pote
• preço 12

🗑️ Cancelar
• cancelar Ana`;

const NAO_ENTENDI =
  'Não entendi 🤔. Exemplos: "Ana pediu 3", "Ana pagou", "quem não pagou", "resumo". Mande "ajuda" para ver tudo.';

// ---------- utilidades ----------
const semAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const toNum = (s: string) => Number(s.replace(",", "."));
const brl = (n: number) => "R$ " + Number(n).toFixed(2).replace(".", ",");
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const potes = (n: number) => `${n} ${n === 1 ? "pote" : "potes"}`;

function toInt(s: string): number {
  return /^\d+$/.test(s) ? Number(s) : PALAVRAS[semAcento(s.toLowerCase())] ?? 0;
}

function limparNome(s: string): string {
  const pequenas = new Set(["da", "de", "do", "das", "dos", "e"]);
  const base = s
    .trim()
    .replace(/^(?:a|o|da|do|de)\s+/i, "")
    .replace(/[?!.,:;]+$/g, "")
    .trim();
  return base
    .split(/\s+/)
    .map((w, i) => {
      const x = w.toLowerCase();
      return i > 0 && pequenas.has(x) ? x : x.charAt(0).toUpperCase() + x.slice(1);
    })
    .join(" ");
}

function dataValida(iso: string): string | null {
  const d = new Date(`${iso}T12:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : null;
}

function parseData(texto: string): string | null {
  const t = texto.toLowerCase();
  const hoje = todayStr();
  if (/depois\s+de\s+amanh[ãa]/.test(t)) return addDays(hoje, 2);
  if (/amanh[ãa]/.test(t)) return addDays(hoje, 1);
  if (/\bhoje\b/.test(t)) return hoje;

  const sem = t.match(/\b(domingo|segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado)\b/);
  if (sem) {
    const mapa: Record<string, number> = {
      domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6,
    };
    const alvo = mapa[semAcento(sem[1])];
    const dow = new Date(`${hoje}T12:00:00Z`).getUTCDay();
    let diff = (alvo - dow + 7) % 7;
    if (diff === 0) diff = 7;
    return addDays(hoje, diff);
  }

  const barra = t.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (barra) {
    const iso = `${hoje.slice(0, 4)}-${barra[2].padStart(2, "0")}-${barra[1].padStart(2, "0")}`;
    return dataValida(iso);
  }

  const dia = t.match(/\bdia\s+(\d{1,2})\b/);
  if (dia) {
    const n = Number(dia[1]);
    let ano = Number(hoje.slice(0, 4));
    let mes = Number(hoje.slice(5, 7));
    if (n < Number(hoje.slice(8, 10))) {
      mes += 1;
      if (mes > 12) { mes = 1; ano += 1; }
    }
    return dataValida(`${ano}-${String(mes).padStart(2, "0")}-${String(n).padStart(2, "0")}`);
  }
  return null;
}

function achaPeriodo(t: string): Periodo | null {
  if (/\bhoje\b/i.test(t)) return "hoje";
  if (/\bsemana\b/i.test(t)) return "semana";
  if (/\bm[eê]s\b/i.test(t)) return "mes";
  if (/\b(tudo|total|geral|sempre)\b/i.test(t)) return "tudo";
  return null;
}

const NOME_PERIODO: Record<Periodo, string> = {
  hoje: "de hoje",
  semana: "desta semana",
  mes: "deste mês",
  tudo: "total",
};

function modoDe(s?: string): Modo {
  if (!s) return "auto";
  const x = s.toLowerCase();
  if (x === "primeiro") return "primeiro";
  if (x.startsWith("tud") || x === "todos") return "tudo";
  return "ultimo";
}

function linhaPedido(p: any): string {
  const entrega = p.data_entrega && !p.entregue ? ` (${dm(p.data_entrega)})` : "";
  return `• ${p.cliente}: ${potes(p.quantidade)}, ${brl(p.valor_total)}, ${p.pago ? "pago" : "não pago"
    }, ${p.entregue ? "entregue" : "a entregar"}${entrega}`;
}

// Evita que "Ana" pegue também "Mariana": prefere nome exato quando existe
function filtraCliente(pedidos: any[], nome: string): any[] {
  const exatos = pedidos.filter(
    (p) => p.cliente.trim().toLowerCase() === nome.toLowerCase()
  );
  return exatos.length ? exatos : pedidos;
}

// ---------- ações ----------
async function novoPedido(nomeRaw: string, qtd: number, resto: string): Promise<string> {
  const nome = limparNome(nomeRaw);
  if (!nome || qtd < 1) return NAO_ENTENDI;

  const preco = resto.match(
    /\b(?:a|por)\s*(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)(?:\s*(?:reais|cada))?/i
  );
  const jaPago = /\bpag(?:o|ou)\b/i.test(resto);
  const entrega = parseData(resto);

  const r: any = await runTool("criar_pedido", {
    cliente: nome,
    quantidade: qtd,
    valor_unitario: preco ? toNum(preco[1]) : undefined,
    data_entrega: entrega ?? undefined,
    ja_pago: jaPago,
  });
  if (r.erro) return `⚠️ ${r.erro}`;
  const p = r.pedido;
  return `✅ ${p.cliente}: ${potes(p.quantidade)}, ${brl(p.valor_total)}, ${p.pago ? "pago" : "não pago"
    }${p.data_entrega ? `, entrega ${dm(p.data_entrega)}` : ""}.`;
}

async function marcar(
  tool: "marcar_pago" | "marcar_entregue",
  nomeRaw: string,
  modo: Modo
): Promise<string> {
  const nome = limparNome(nomeRaw);
  const input: any = { cliente: nome };
  if (modo === "tudo") input.todos = true;

  let r: any = await runTool(tool, input);

  if (r.ambiguo && (modo === "primeiro" || modo === "ultimo")) {
    const nomes = new Set<string>(r.opcoes.map((p: any) => p.cliente.trim().toLowerCase()));
    if (nomes.size === 1) {
      const ops = r.opcoes;
      const alvo = modo === "primeiro" ? ops[0] : ops[ops.length - 1];
      r = await runTool(tool, { pedido_id: alvo.id });
    }
  }

  if (r.erro) {
    return /Nenhum pedido/.test(r.erro)
      ? `⚠️ Não achei pedido em aberto de ${nome}.`
      : `⚠️ ${r.erro}`;
  }

  if (r.ambiguo) {
    const nomes = Array.from(new Set<string>(r.opcoes.map((p: any) => p.cliente)));
    if (nomes.length > 1) {
      return `Achei mais de um cliente parecido: ${nomes.join(", ")}. Escreva o nome completo.`;
    }
    const verbo = tool === "marcar_pago" ? "pagou" : "recebeu";
    const linhas = r.opcoes
      .map((p: any, i: number) => `${i + 1}. ${potes(p.quantidade)}, ${brl(p.valor_total)} (${dm(p.criado_em.slice(0, 10))})`)
      .join("\n");
    return `${nomes[0]} tem mais de um pedido em aberto:\n${linhas}\nEscreva: "${nomes[0]} ${verbo} tudo", "${nomes[0]} ${verbo} o primeiro" ou "${nomes[0]} ${verbo} o último".`;
  }

  const lista = r.atualizados
    .map((p: any) => `• ${p.cliente}: ${potes(p.quantidade)}, ${brl(p.valor_total)}`)
    .join("\n");
  return `✅ ${tool === "marcar_pago" ? "Pago" : "Entregue"}:\n${lista}`;
}

async function listar(
  filtro: string,
  extra: Record<string, unknown>,
  vazio: string,
  titulo?: string
): Promise<string> {
  const r: any = await runTool("listar_pedidos", { filtro, ...extra });
  if (r.erro) return `⚠️ ${r.erro}`;
  let pedidos: any[] = r.pedidos;
  if (typeof extra.cliente === "string") pedidos = filtraCliente(pedidos, extra.cliente);
  if (!pedidos.length) return vazio;
  const total = pedidos.reduce((s, p) => s + Number(p.valor_total), 0);
  const rodape = filtro === "nao_pagos" ? `\nTotal a receber: ${brl(total)}` : "";
  return `${titulo ? titulo + "\n" : ""}${pedidos.map(linhaPedido).join("\n")}${rodape}`;
}

async function resumo(periodo: Periodo): Promise<string> {
  const r: any = await runTool("resumo", { periodo });
  if (r.erro) return `⚠️ ${r.erro}`;

  // Quem ainda não pagou (no mesmo período do resumo)
  const np: any = await runTool("listar_pedidos", { filtro: "nao_pagos", periodo });
  const devedores = new Map<string, { nome: string; total: number }>();
  for (const p of np.pedidos ?? []) {
    const chave = String(p.cliente).trim().toLowerCase();
    const atual = devedores.get(chave) ?? { nome: p.cliente, total: 0 };
    atual.total += Number(p.valor_total);
    devedores.set(chave, atual);
  }
  const linhasDevedores = Array.from(devedores.values())
    .sort((a, b) => b.total - a.total)
    .map((d) => `   • ${d.nome}: ${brl(d.total)}`);

  return [
    `📊 Resumo ${NOME_PERIODO[periodo]}`,
    `Banoffes vendidos: ${r.potes} em ${r.pedidos} pedidos`,
    `Vendido: ${brl(r.vendido)}`,
    `Recebido: ${brl(r.recebido)}`,
    `A receber: ${brl(r.a_receber)}`,
    ...linhasDevedores,
    `Gastos: ${brl(r.gastos)}`,
    `Lucro estimado: ${brl(r.lucro_estimado)} (vendido − gastos)`,
    `Lucro em caixa: ${brl(r.lucro_em_caixa)} (recebido − gastos)`,
  ].join("\n");
}

async function listaGastos(periodo: Periodo): Promise<string> {
  const r: any = await runTool("listar_gastos", { periodo });
  if (r.erro) return `⚠️ ${r.erro}`;
  if (!r.gastos.length) return `Nenhum gasto ${NOME_PERIODO[periodo]}.`;
  const total = r.gastos.reduce((s: number, g: any) => s + Number(g.valor), 0);
  const linhas = r.gastos
    .map((g: any) => `• ${dm(g.data)} ${g.descricao}: ${brl(g.valor)}`)
    .join("\n");
  return `💸 Gastos ${NOME_PERIODO[periodo]}\n${linhas}\nTotal: ${brl(total)}`;
}

async function gasto(descricao: string, valor: number): Promise<string> {
  const desc = descricao.trim().replace(/[?!.,:;]+$/g, "");
  if (!desc || !(valor >= 0)) return NAO_ENTENDI;
  const r: any = await runTool("registrar_gasto", { descricao: desc, valor });
  if (r.erro) return `⚠️ ${r.erro}`;
  return `✅ Gasto registrado: ${r.gasto.descricao}, ${brl(r.gasto.valor)}.`;
}

async function cancelar(nomeRaw: string, confirmado: boolean): Promise<string> {
  const nome = limparNome(nomeRaw);
  const r: any = await runTool("listar_pedidos", { filtro: "todos", cliente: nome });
  if (r.erro) return `⚠️ ${r.erro}`;
  const pedidos = filtraCliente(r.pedidos, nome);
  if (!pedidos.length) return `Não achei pedido de ${nome}.`;
  const nomes = Array.from(new Set<string>(pedidos.map((p: any) => p.cliente)));
  if (nomes.length > 1) {
    return `Achei mais de um cliente parecido: ${nomes.join(", ")}. Escreva o nome completo.`;
  }
  const alvo = pedidos[0]; // o mais recente
  const desc = `${potes(alvo.quantidade)} de ${alvo.cliente} (${brl(alvo.valor_total)})`;
  if (!confirmado) {
    return `Cancelar o pedido mais recente: ${desc}?\nPara confirmar, escreva: cancelar ${alvo.cliente} sim`;
  }
  const c: any = await runTool("cancelar_pedido", { pedido_id: alvo.id });
  if (c.erro) return `⚠️ ${c.erro}`;
  return `🗑️ Pedido cancelado: ${desc}.`;
}

// ---------- roteador ----------
export async function runAgent(_chatId: number, texto: string): Promise<string> {
  const t = texto.trim().replace(/^(\/\w+)@\w+/, "$1");
  let m: RegExpMatchArray | null;

  // Ajuda
  if (/^\/?(?:start|ajuda|help|menu|comandos)\b/i.test(t)) return AJUDA;

  // Novo pedido: "Ana pediu 3 banoffes pra sexta a 15"
  m = t.match(
    /^([^\d,;:]{1,40}?)\s+(?:pediu|quer|vai querer|encomendou|comprou|levou)\s+(\d+|um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez|doze)(?=\s|$|[.,!])(?:\s+(?:potes?|banoffes?|unidades?))?(.*)$/i
  );
  if (m) return novoPedido(m[1], toInt(m[2]), m[3] ?? "");

  // Novo pedido: "pedido Ana 3"
  m = t.match(/^\/?pedido\s+([^\d]+?)\s+(\d+)(.*)$/i);
  if (m) return novoPedido(m[1], Number(m[2]), m[3] ?? "");

  // Resumo
  if (
    /^(?:\/?resumo|\/?balan[cç]o|quanto\s+(?:eu\s+)?(?:vendi|ganhei|lucrei|recebi)|lucro|faturamento)/i.test(t)
  ) {
    return resumo(achaPeriodo(t) ?? "semana");
  }

  // Quem não pagou
  if (
    /^(?:\/?naopagos|\/?pendentes?|quem\b.*\b(?:n[aã]o\s+pagou|n[aã]o\s+pagaram|deve|devendo|falta\s+pagar)|n[aã]o\s+pagos|a\s+receber|fiado)/i.test(t)
  ) {
    return listar("nao_pagos", {}, "🎉 Ninguém devendo!", "Ainda não pagaram:");
  }

  // Entregas
  if (/(?:entregar|entregas)/i.test(t)) {
    const data = parseData(t);
    return listar(
      "a_entregar",
      data ? { data_entrega: data } : {},
      data ? `Nada para entregar em ${dm(data)}.` : "Nada para entregar 🎉",
      data ? `Para entregar em ${dm(data)}:` : "Para entregar:"
    );
  }

  // Lista de pedidos
  m = t.match(/^(?:\/?pedidos|\/?abertos|em\s+aberto)(?:\s+(?:d[aeo]s?\s+)?(.+))?$/i);
  if (m) {
    const resto = (m[1] ?? "").trim();
    if (!resto) return listar("abertos", {}, "Nenhum pedido em aberto 🎉", "Pedidos em aberto:");
    const per = achaPeriodo(resto);
    if (per) return listar("todos", { periodo: per }, `Nenhum pedido ${NOME_PERIODO[per]}.`, `Pedidos ${NOME_PERIODO[per]}:`);
    const nome = limparNome(resto);
    return listar("todos", { cliente: nome }, `Não achei pedidos de ${nome}.`, `Pedidos de ${nome}:`);
  }

  // Lista de gastos
  m = t.match(/^\/?gastos(?:\s+(.*))?$/i);
  if (m) return listaGastos(achaPeriodo(m[1] ?? "") ?? "mes");

  // Preço do pote
  if (/^\/?pre[cç]o$/i.test(t)) {
    return `Preço atual: ${brl(await getPreco())} por pote. Para mudar, escreva: preço 15`;
  }
  m = t.match(/^\/?(?:definir\s+|mudar\s+)?pre[cç]o(?:\s+do\s+pote)?\s+(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)/i);
  if (m) {
    const r: any = await runTool("definir_preco", { valor: toNum(m[1]) });
    return r.erro ? `⚠️ ${r.erro}` : `✅ Preço do pote agora é ${brl(toNum(m[1]))}.`;
  }

  // Cancelar
  m = t.match(
    /^\/?cancel(?:a|ar|e)\s+(?:(?:o\s+)?pedido\s+(?:d[ao]\s+)?)?(.+?)(?:\s+(sim|confirmo))?$/i
  );
  if (m) return cancelar(m[1], !!m[2]);

  // Gasto: "gastei 28 com leite"
  m = t.match(
    /^\/?(?:gastei|paguei)\s+(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)(?:\s*reais)?\s+(?:com|em|de|no|na|nos|nas)\s+(.+)$/i
  );
  if (m) return gasto(m[2], toNum(m[1]));

  // Gasto: "comprei leite condensado 28"
  m = t.match(
    /^\/?(?:gasto|gastei|comprei|paguei)\s+(.+?)\s+(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)(?:\s*(?:reais|r\$))?[.!]?$/i
  );
  if (m) return gasto(m[1], toNum(m[2]));

  // Pagou: "/pagou Ana" ou "Ana pagou", "Ana pagou tudo"
  m = t.match(
    /^\/?pagou\s+([^\d,;:]{1,40}?)(?:\s+(?:o\s+)?(tudo|tudinho|todos|primeiro|[uú]ltimo))?[.!]?$/i
  );
  if (m) return marcar("marcar_pago", m[1], modoDe(m[2]));
  m = t.match(
    /^([^\d,;:]{1,40}?)\s+(?:j[aá]\s+)?(?:pagou|pago|fez\s+(?:o\s+)?pix|mandou\s+(?:o\s+)?pix|transferiu)(?:\s+(?:o\s+)?(tudo|tudinho|todos|primeiro|[uú]ltimo))?[.!]?$/i
  );
  if (m) return marcar("marcar_pago", m[1], modoDe(m[2]));

  // Entregue: "entreguei Ana", "Ana recebeu"
  m = t.match(
    /^(?:\/?entregue|entreguei)\s+(?:(?:pra|para|pro|a|o|ao|d[ao])\s+)?([^\d,;:]{1,40}?)(?:\s+(?:o\s+)?(tudo|tudinho|todos|primeiro|[uú]ltimo))?[.!]?$/i
  );
  if (m) return marcar("marcar_entregue", m[1], modoDe(m[2]));
  m = t.match(
    /^([^\d,;:]{1,40}?)\s+(?:j[aá]\s+)?(?:recebeu|buscou|pegou)(?:\s+(?:o\s+)?(tudo|tudinho|todos|primeiro|[uú]ltimo))?[.!]?$/i
  );
  if (m) return marcar("marcar_entregue", m[1], modoDe(m[2]));

  return NAO_ENTENDI;
}
import { supabase } from "./supabase";
import { periodRange, todayStr, type Periodo } from "./dates";

const periodoSchema = {
  type: "string",
  enum: ["hoje", "semana", "mes", "tudo"],
} as const;

export type ToolDef = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

export const tools: ToolDef[] = [
  {
    name: "criar_pedido",
    description:
      "Registra um novo pedido de banoffe. Se valor_unitario não for informado, usa o preço padrão.",
    input_schema: {
      type: "object",
      properties: {
        cliente: { type: "string" },
        quantidade: { type: "integer", minimum: 1 },
        valor_unitario: { type: "number", description: "Preço por pote, se diferente do padrão" },
        data_entrega: { type: "string", description: "YYYY-MM-DD, se mencionada" },
        obs: { type: "string" },
        ja_pago: { type: "boolean", description: "true se já pagou no ato do pedido" },
      },
      required: ["cliente", "quantidade"],
    },
  },
  {
    name: "marcar_pago",
    description:
      "Marca pedido(s) como pago. Se houver mais de um pedido em aberto do cliente, devolve opções; então chame de novo com pedido_id ou todos=true.",
    input_schema: {
      type: "object",
      properties: {
        cliente: { type: "string" },
        pedido_id: { type: "string" },
        todos: { type: "boolean", description: "Marcar todos os pedidos não pagos do cliente" },
      },
    },
  },
  {
    name: "marcar_entregue",
    description:
      "Marca pedido(s) como entregue. Mesma lógica de desambiguação do marcar_pago.",
    input_schema: {
      type: "object",
      properties: {
        cliente: { type: "string" },
        pedido_id: { type: "string" },
        todos: { type: "boolean" },
      },
    },
  },
  {
    name: "cancelar_pedido",
    description: "Cancela um pedido. Só use depois de confirmação explícita da usuária.",
    input_schema: {
      type: "object",
      properties: { pedido_id: { type: "string" } },
      required: ["pedido_id"],
    },
  },
  {
    name: "listar_pedidos",
    description: "Lista pedidos (máx. 50), do mais recente ao mais antigo.",
    input_schema: {
      type: "object",
      properties: {
        filtro: {
          type: "string",
          enum: ["abertos", "nao_pagos", "a_entregar", "todos"],
          description: "abertos = não pagos OU não entregues",
        },
        cliente: { type: "string" },
        periodo: periodoSchema,
        data_entrega: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["filtro"],
    },
  },
  {
    name: "resumo",
    description:
      "Totais do período: vendido, recebido, a receber, gastos e lucro.",
    input_schema: {
      type: "object",
      properties: { periodo: periodoSchema },
      required: ["periodo"],
    },
  },
  {
    name: "registrar_gasto",
    description: "Registra um gasto (ingredientes, embalagem, etc.).",
    input_schema: {
      type: "object",
      properties: {
        descricao: { type: "string" },
        valor: { type: "number" },
        data: { type: "string", description: "YYYY-MM-DD; padrão hoje" },
      },
      required: ["descricao", "valor"],
    },
  },
  {
    name: "listar_gastos",
    description: "Lista os gastos de um período.",
    input_schema: {
      type: "object",
      properties: { periodo: periodoSchema },
      required: ["periodo"],
    },
  },
  {
    name: "definir_preco",
    description: "Altera o preço padrão do pote.",
    input_schema: {
      type: "object",
      properties: { valor: { type: "number" } },
      required: ["valor"],
    },
  },
];

export async function getPreco(): Promise<number> {
  const { data } = await supabase
    .from("config")
    .select("valor")
    .eq("chave", "preco_pote")
    .single();
  return Number(data?.valor ?? 0);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

async function acharPedidos(
  campo: "pago" | "entregue",
  input: { cliente?: string; pedido_id?: string; todos?: boolean }
) {
  let q = supabase
    .from("pedidos")
    .select("id, cliente, quantidade, valor_total, criado_em, pago, entregue")
    .eq("cancelado", false)
    .eq(campo, false)
    .order("criado_em", { ascending: true });

  if (input.pedido_id) q = q.eq("id", input.pedido_id);
  else if (input.cliente) q = q.ilike("cliente", `%${input.cliente}%`);
  else return { erro: "Informe cliente ou pedido_id." };

  const { data: found, error } = await q;
  if (error) return { erro: error.message };
  if (!found?.length) return { erro: "Nenhum pedido em aberto encontrado." };

  // Prefere nome exato (evita "Ana" pegar "Mariana")
  let data = found;
  if (input.cliente && !input.pedido_id) {
    const alvo = input.cliente.trim().toLowerCase();
    const exatos = found.filter((p) => p.cliente.trim().toLowerCase() === alvo);
    if (exatos.length) data = exatos;
  }

  const nomes = new Set(data.map((p) => p.cliente.trim().toLowerCase()));
  if (!input.pedido_id) {
    if (nomes.size > 1) return { ambiguo: true, opcoes: data };
    if (data.length > 1 && !input.todos) return { ambiguo: true, opcoes: data };
  }
  return { pedidos: data };
}

async function marcar(
  campo: "pago" | "entregue",
  input: { cliente?: string; pedido_id?: string; todos?: boolean }
) {
  const found = await acharPedidos(campo, input);
  if (!("pedidos" in found) || !found.pedidos) return found;
  const ids = found.pedidos.map((p) => p.id);
  const patch =
    campo === "pago"
      ? { pago: true, pago_em: new Date().toISOString() }
      : { entregue: true, entregue_em: new Date().toISOString() };
  const { error } = await supabase.from("pedidos").update(patch).in("id", ids);
  if (error) return { erro: error.message };
  return { ok: true, atualizados: found.pedidos };
}

export async function runTool(name: string, input: any): Promise<unknown> {
  switch (name) {
    case "criar_pedido": {
      const unit = input.valor_unitario ?? (await getPreco());
      if (!unit) return { erro: "Preço padrão não definido. Pergunte o valor do pote." };
      const row = {
        cliente: String(input.cliente).trim(),
        quantidade: input.quantidade,
        valor_total: round2(unit * input.quantidade),
        data_entrega: input.data_entrega ?? null,
        obs: input.obs ?? null,
        pago: !!input.ja_pago,
        pago_em: input.ja_pago ? new Date().toISOString() : null,
      };
      const { data, error } = await supabase.from("pedidos").insert(row).select().single();
      if (error) return { erro: error.message };
      return { ok: true, pedido: data };
    }
    case "marcar_pago":
      return marcar("pago", input);
    case "marcar_entregue":
      return marcar("entregue", input);
    case "cancelar_pedido": {
      const { data, error } = await supabase
        .from("pedidos")
        .update({ cancelado: true })
        .eq("id", input.pedido_id)
        .select()
        .single();
      if (error) return { erro: error.message };
      return { ok: true, pedido: data };
    }
    case "listar_pedidos": {
      let q = supabase
        .from("pedidos")
        .select("id, cliente, quantidade, valor_total, pago, entregue, data_entrega, obs, criado_em")
        .eq("cancelado", false)
        .order("criado_em", { ascending: false })
        .limit(50);
      if (input.filtro === "nao_pagos") q = q.eq("pago", false);
      if (input.filtro === "a_entregar") q = q.eq("entregue", false);
      if (input.filtro === "abertos") q = q.or("pago.eq.false,entregue.eq.false");
      if (input.cliente) q = q.ilike("cliente", `%${input.cliente}%`);
      if (input.data_entrega) q = q.eq("data_entrega", input.data_entrega);
      if (input.periodo) {
        const r = periodRange(input.periodo as Periodo);
        q = q.gte("criado_em", r.from).lt("criado_em", r.to);
      }
      const { data, error } = await q;
      if (error) return { erro: error.message };
      return { total: data.length, pedidos: data };
    }
    case "resumo": {
      const r = periodRange(input.periodo as Periodo);
      const { data: peds, error: e1 } = await supabase
        .from("pedidos")
        .select("quantidade, valor_total, pago")
        .eq("cancelado", false)
        .gte("criado_em", r.from)
        .lt("criado_em", r.to);
      const { data: gs, error: e2 } = await supabase
        .from("gastos")
        .select("valor")
        .gte("data", r.fromDate)
        .lte("data", r.toDate);
      if (e1 || e2) return { erro: (e1 || e2)!.message };
      const vendido = peds.reduce((s, p) => s + Number(p.valor_total), 0);
      const recebido = peds.filter((p) => p.pago).reduce((s, p) => s + Number(p.valor_total), 0);
      const gastos = gs.reduce((s, g) => s + Number(g.valor), 0);
      return {
        periodo: input.periodo,
        potes: peds.reduce((s, p) => s + p.quantidade, 0),
        pedidos: peds.length,
        vendido: round2(vendido),
        recebido: round2(recebido),
        a_receber: round2(vendido - recebido),
        gastos: round2(gastos),
        lucro_estimado: round2(vendido - gastos),
        lucro_em_caixa: round2(recebido - gastos),
      };
    }
    case "registrar_gasto": {
      const { data, error } = await supabase
        .from("gastos")
        .insert({
          descricao: input.descricao,
          valor: input.valor,
          data: input.data ?? todayStr(),
        })
        .select()
        .single();
      if (error) return { erro: error.message };
      return { ok: true, gasto: data };
    }
    case "listar_gastos": {
      const r = periodRange(input.periodo as Periodo);
      const { data, error } = await supabase
        .from("gastos")
        .select("data, descricao, valor")
        .gte("data", r.fromDate)
        .lte("data", r.toDate)
        .order("data", { ascending: false })
        .limit(50);
      if (error) return { erro: error.message };
      return { gastos: data };
    }
    case "definir_preco": {
      const { error } = await supabase
        .from("config")
        .upsert({ chave: "preco_pote", valor: String(input.valor) });
      if (error) return { erro: error.message };
      return { ok: true, preco_pote: input.valor };
    }
    default:
      return { erro: `Ferramenta desconhecida: ${name}` };
  }
}

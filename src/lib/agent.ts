import { GoogleGenAI, type Content, type Part } from "@google/genai";
import { supabase } from "./supabase";
import { tools, runTool, getPreco } from "./tools";
import { todayStr } from "./dates";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "placeholder-key" });
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";

// Converte as ferramentas (JSON Schema) para o formato do Gemini.
const functionDeclarations = tools.map((t) => ({
  name: t.name,
  description: t.description,
  parametersJsonSchema: t.input_schema,
}));

async function buildSystem(): Promise<string> {
  const preco = await getPreco();
  return `Você é o assistente de uma venda caseira de banoffe no pote. Ajuda a controlar pedidos, pagamentos, entregas e gastos.

Hoje é ${todayStr()} (fuso de Campo Grande, MS). Preço padrão: R$ ${preco.toFixed(2)} por pote.

Regras:
- Interprete mensagens informais em português e use as ferramentas para registrar ou consultar. Nunca invente dados: tudo vem das ferramentas.
- Se faltar informação essencial (ex.: quantidade), pergunte em uma frase curta.
- Se uma ferramenta devolver "ambiguo", mostre as opções numeradas e pergunte qual.
- Antes de cancelar qualquer pedido, peça confirmação explícita.
- Datas relativas ("amanhã", "sexta") devem virar YYYY-MM-DD com base em hoje.
- Responda curto e sempre confirme o que foi registrado, no formato:
  ✅ Ana: 3 potes, R$ 36,00, não pago.
- Valores em reais com vírgula (R$ 36,00).
- Listas: uma linha por item. Sem markdown, sem asteriscos, sem tabelas.
- Em resumos, mostre: vendido, recebido, a receber, gastos e lucro.`;
}

export async function runAgent(chatId: number, userText: string): Promise<string> {
  const { data: hist } = await supabase
    .from("mensagens")
    .select("role, content")
    .eq("chat_id", chatId)
    .order("id", { ascending: false })
    .limit(12);

  const contents: Content[] = (hist ?? []).reverse().map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  while (contents.length && contents[0].role !== "user") contents.shift();
  contents.push({ role: "user", parts: [{ text: userText }] });

  const system = await buildSystem();
  let finalText = "";

  for (let i = 0; i < 6; i++) {
    const res = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction: system,
        tools: [{ functionDeclarations: functionDeclarations as any }],
      },
    });

    const calls = res.functionCalls ?? [];
    if (!calls.length) {
      finalText = (res.text ?? "").trim();
      break;
    }

    // Guarda o turno do modelo (com as chamadas de ferramenta) no histórico
    const modelContent = res.candidates?.[0]?.content;
    if (modelContent) contents.push(modelContent);

    const parts: Part[] = [];
    for (const call of calls) {
      let out: unknown;
      try {
        out = await runTool(call.name!, call.args ?? {});
      } catch (e: any) {
        out = { erro: e?.message ?? "erro desconhecido" };
      }
      parts.push({
        functionResponse: { name: call.name!, response: { result: out } },
      });
    }
    contents.push({ role: "user", parts });
  }

  if (!finalText) finalText = "Não consegui concluir isso. Pode tentar de novo?";

  await supabase.from("mensagens").insert([
    { chat_id: chatId, role: "user", content: userText },
    { chat_id: chatId, role: "assistant", content: finalText },
  ]);

  return finalText;
}

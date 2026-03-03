import { GoogleGenAI, Type } from "@google/genai";
import { ClassificationResult, Lawyer } from "../types";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("A chave da API do Gemini (GEMINI_API_KEY) não foi configurada. Por favor, adicione-a nas variáveis de ambiente.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

const classificationSchema = {
// ... (rest of the schema)
  type: Type.OBJECT,
  properties: {
    acts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Título curto e descritivo do ato" },
          type: { type: Type.STRING, description: "Tipo do ato processual (ex: Petição Inicial, Contestação, Acórdão, Sentença, Alvará)" },
          court: { type: Type.STRING, description: "Tribunal onde tramita o processo (ex: TJSP, TRT2, STJ)" },
          chamber: { type: Type.STRING, description: "Vara ou Câmara onde tramita o processo (ex: 2ª Vara Cível, 5ª Vara do Trabalho)" },
          caseNumber: { type: Type.STRING, description: "Número do processo (formato CNJ se disponível)" },
          parties: { type: Type.STRING, description: "Nome das partes envolvidas (ex: João da Silva vs. Empresa X)" },
          date: { type: Type.STRING, description: "Data do ato ou do andamento (formato DD/MM/AAAA)" },
          lawyer: { 
            type: Type.STRING, 
            description: "Nome do advogado responsável baseado nas regras: Cível (incluindo sentenças e alvarás cíveis) -> Dr. Alexsander, Cálculos -> Dra. Pabliny, Defesa de empresa trabalhista -> Dr. Gabriel, Sentenças/Acórdãos não cíveis ou Outros -> Dr. Matheus" 
          },
          summary: { type: Type.STRING, description: "Resumo conciso do conteúdo do ato" },
          originalTextSnippet: { type: Type.STRING, description: "Um pequeno trecho do texto original para referência" }
        },
        required: ["title", "type", "court", "chamber", "caseNumber", "parties", "date", "lawyer", "summary", "originalTextSnippet"]
      }
    }
  },
  required: ["acts"]
};

export async function classifyProceduralActs(text: string): Promise<ClassificationResult> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Analise o texto abaixo, que foi extraído de um ÚNICO documento PDF contendo VÁRIOS atos processuais compilados.
            
            Sua tarefa é:
            1. IDENTIFICAR EXAUSTIVAMENTE onde termina um ato e começa o outro. NÃO DEIXE NENHUM ATO DE FORA.
            2. SEGMENTAR o documento em atos individuais, garantindo que 100% do conteúdo relevante seja processado.
            3. EXTRAIR o Tribunal, a VARA/CÂMARA, o Número do Processo, o NOME DAS PARTES e a DATA do ato/andamento para cada ato.
            4. CLASSIFICAR cada ato identificado de acordo com as regras de distribuição da Justo - Soluções Tecnológicas.
            5. RESUMIR cada ato de forma precisa.
            6. EVITAR DUPLICIDADE: Se o mesmo ato/andamento aparecer repetido no texto (mesmo número de processo, data e conteúdo), extraia-o apenas uma vez.

            REGRAS DE DISTRIBUIÇÃO (CRÍTICO):
            - DR. ALEXSANDER: ABSOLUTAMENTE TUDO que for Cível (Direito Civil, Contratos, Família, Sucessões, etc.), INCLUINDO sentenças e alvarás que sejam de natureza cível.
            - DRA. PABLINY: Cálculos (Planilhas de liquidação, impugnação de cálculos, perícias contábeis, etc.).
            - DR. GABRIEL: Defesa de Empresa Trabalhista (Contestações, Recursos e manifestações onde a empresa é a reclamada no âmbito trabalhista).
            - DR. MATHEUS: Sentenças e Acórdãos que NÃO sejam cíveis, e todo o restante (Criminal, Administrativo, Tributário, ou qualquer outro não listado acima).
            
            OBSERVAÇÃO ESPECIAL:
            - RIGOR TOTAL NA COMPLETUDE: É imperativo que nenhum andamento seja ignorado. Se o texto contém 10 atos, você deve retornar exatamente 10 objetos no JSON.
            - Atos do tipo "Alvará" devem ser identificados claramente no campo "type".
            - Se o ato for Cível, o responsável é SEMPRE o DR. ALEXSANDER, mesmo que seja Sentença ou Alvará.

            TEXTO DO DOCUMENTO COMPILADO:
            --- INÍCIO DO TEXTO ---
            ${text}
            --- FIM DO TEXTO ---
            
            Retorne a lista de todos os atos encontrados no formato JSON.`
          }
        ]
      }
    ],
    config: {
      systemInstruction: "Você é um especialista jurídico sênior da Justo - Soluções Tecnológicas. Sua especialidade é analisar documentos compilados e separar cada ato processual individualmente para distribuição correta na equipe. Você deve ser EXAUSTIVO e garantir que nenhum andamento ou ato presente no texto seja deixado de fora da classificação.",
      responseMimeType: "application/json",
      responseSchema: classificationSchema
    }
  });

  try {
    const result = JSON.parse(response.text || "{}");
    const rawActs = result.acts || [];
    
    // Deduplication logic: filter out acts with same caseNumber, date and summary
    const seen = new Set<string>();
    const uniqueActs = rawActs.filter((act: any) => {
      const key = `${act.caseNumber}-${act.date}-${act.summary?.substring(0, 50)}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return {
      acts: uniqueActs.map((act: any, index: number) => ({
        ...act,
        id: `act-${Date.now()}-${index}`,
        isFulfilled: false,
        // Ensure lawyer matches enum if possible, or fallback
        lawyer: Object.values(Lawyer).find(l => l.includes(act.lawyer)) || Lawyer.MATHEUS
      })),
      totalActs: uniqueActs.length
    };
  } catch (error) {
    console.error("Error parsing Gemini response:", error);
    throw new Error("Falha ao processar a classificação dos atos.");
  }
}

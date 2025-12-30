import { GoogleGenAI, Type, Schema } from '@google/genai';
import { AppState, PartitionResult } from '@/types';
import { NextRequest, NextResponse } from 'next/server';

const partitionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    totalEstateValue: { type: Type.NUMBER, description: "El valor total de todos los activos combinados." },
    idealShare: { type: Type.NUMBER, description: "El valor objetivo que cada heredero debe recibir." },
    allocations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          heirId: { type: Type.INTEGER },
          heirName: { type: Type.STRING },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                assetName: { type: Type.STRING },
                description: { type: Type.STRING },
                value: { type: Type.NUMBER },
              },
            },
          },
          totalAllocatedValue: { type: Type.NUMBER },
          balanceDifference: { type: Type.NUMBER, description: "Diferencia con respecto a la cuota ideal." },
        },
      },
    },
    compensations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          from: { type: Type.STRING, description: "Heredero que debe pagar." },
          to: { type: Type.STRING, description: "Heredero que debe recibir." },
          amount: { type: Type.NUMBER, description: "Cantidad de la compensación." },
        },
      },
    },
    explanation: { type: Type.STRING, description: "Breve explicación de la lógica aplicada en español." },
  },
  required: ["totalEstateValue", "idealShare", "allocations", "compensations", "explanation"],
};

export async function POST(req: NextRequest) {
  try {
    const state: AppState = await req.json();
    
    // Check for API key (Serverside)
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API Key not configured" }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });

    const inputPayload = {
      configuracion: {
        numero_herederos: state.config.numberOfHeirs,
        moneda: state.config.currency,
      },
      activos: state.assets.map(asset => ({
        nombre: asset.name,
        divisible: asset.divisible,
        sub_partidas: asset.subItems.map(sub => ({
          concepto: sub.concept,
          cantidad: sub.quantity,
          unidad: sub.unit,
          valor_unitario: sub.unitValue,
        })),
      })),
    };

    const systemInstruction = `Eres un "Asistente Experto en Partición de Herencias y Optimización de Lotes". Tu objetivo es calcular el reparto equitativo de un patrimonio entre un número determinado de herederos.
    
    REGLAS DE PROCESAMIENTO:
    1. VALORACIÓN: Calcula el valor de cada activo sumando sus sub-partidas.
    2. CAUDAL RELICTO: Suma el valor de todos los activos para obtener el patrimonio neto total.
    3. CUOTA IDEAL: Divide el patrimonio total por el número de herederos.
    4. ASIGNACIÓN DE LOTES (OPTIMIZACIÓN): Minimiza la fragmentación. Asigna activos indivisibles a un solo heredero.
    5. COMPENSACIONES: Calcula quién debe pagar a quién para que al final todos reciban exactamente el mismo valor neto.`;

    const prompt = JSON.stringify(inputPayload, null, 2);

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp', // Use a stable flash model or experiment
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: partitionSchema,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    const result = JSON.parse(text) as PartitionResult;
    return NextResponse.json(result);

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

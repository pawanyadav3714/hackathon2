import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function getDisasterAdvice(prompt: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "You are an AI Disaster Response Assistant for Disaster Management. Provide concise, actionable advice for people in disaster zones. Focus on safety, resource finding, and psychological support. Keep responses under 150 words.",
      },
    });
    return response.text;
  } catch (error) {
    console.error("AI Error:", error);
    return "I'm having trouble connecting to my intelligence core right now. Please follow local emergency protocols.";
  }
}

export async function analyzeNeeds(needs: any[]) {
  try {
    const needsSummary = needs.map(n => `${n.type}: ${n.description}`).join('\n');
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze these reported needs and provide 3 strategic recommendations for resource allocation:\n${needsSummary}`,
      config: {
        systemInstruction: "You are a Strategic Disaster Coordinator. Analyze data and provide high-level resource allocation strategies. Return a JSON array of 3 strings.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      },
    });
    return JSON.parse(response.text || '[]');
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return ["Prioritize medical emergencies in high-density areas.", "Coordinate with local food banks for immediate supply.", "Establish temporary educational shelters."];
  }
}

export interface SlipAnalysisResult {
  is_slip: boolean;
  amount: number;
  date_time: string;
  sender: string;
  receiver: string;
  receiver_matches: boolean;
  ref_no: string;
}

export async function verifySlip(
  base64Data: string,
  mimeType: string,
  expectedReceiver: string
): Promise<SlipAnalysisResult> {
  let apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not defined.');
  }

  // Clean the API key (remove literal quotes, spaces, etc.)
  apiKey = apiKey.trim().replace(/^["']|["']$/g, '');

  // Remove the data prefix if present (e.g., "data:image/png;base64,")
  const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');

  const prompt = `Analyze this Thai bank transfer slip image. Check if it is a valid bank transfer slip. You must extract the transaction details accurately.
For the receiver name, search for the account holder name that received the money.
For the reference number, search for the Transaction Reference Number, Ref No., or เลขที่อ้างอิง/เลขที่รายการ.
Additionally, check if the recipient of the money (receiver name) matches the expected receiver name: "${expectedReceiver}".
Note that the slip receiver name and the expected name can be in different languages (Thai vs English transliteration), have prefixes (Mr., Mrs., นาย, นาง, นางสาว, บจก., Co., Ltd.), or have spacing differences. Perform a smart match and set "receiver_matches" to true if they refer to the same person/company, and false otherwise.`;

  // We use gemini-3.1-flash-lite as the stable model for structured JSON slip extraction.
  const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: cleanBase64
              }
            },
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            is_slip: { type: 'BOOLEAN', description: 'True if it is a valid bank transfer slip image, false otherwise.' },
            amount: { type: 'NUMBER', description: 'The total amount transferred (decimal).' },
            date_time: { type: 'STRING', description: 'The transfer date and time from the slip (e.g. 2026-07-14 23:55:00).' },
            sender: { type: 'STRING', description: 'Name of the sender.' },
            receiver: { type: 'STRING', description: 'Name of the receiver / recipient of the money.' },
            receiver_matches: { type: 'BOOLEAN', description: 'True if the slip recipient matches the expected receiver name, false otherwise.' },
            ref_no: { type: 'STRING', description: 'Transaction Reference Number / Ref. No. / เลขที่อ้างอิง / เลขที่รายการ. If not found, output empty string.' }
          },
          required: ['is_slip', 'amount', 'date_time', 'sender', 'receiver', 'receiver_matches', 'ref_no']
        }
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API Error (status ${response.status}): ${errorText}`);
  }

  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Failed to retrieve analysis from Gemini API response.');
  }

  try {
    return JSON.parse(text) as SlipAnalysisResult;
  } catch (parseError) {
    console.error('Failed to parse Gemini response text as JSON:', text);
    throw new Error('Invalid JSON format returned from Gemini API.');
  }
}

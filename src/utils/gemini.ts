import axios from "axios";

type GeminiExtract = {
  registrationNo: string | null;
  policyNumber: string | null;
  invoiceDate: string | null;
  vendorName: string | null;
  serviceType: string | null;
  oilChangeRecord: boolean | null;
  invoiceMileage: number | null;
};

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

const EXTRACTION_PROMPT = `You are a document extractor.
Return JSON only.

Extract these fields:
- registrationNo
- policyNumber
- invoiceDate
- vendorName
- serviceType
- oilChangeRecord
- invoiceMileage

If missing, set null.`;

const safeJsonParse = (text: string): GeminiExtract | null => {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const jsonString = text.slice(start, end + 1);
  try {
    return JSON.parse(jsonString);
  } catch {
    return null;
  }
};

const toBase64 = (buffer: ArrayBuffer) =>
  Buffer.from(buffer).toString("base64");

export const extractGeminiFields = async (
  fileUrl: string,
  fileType: string
): Promise<GeminiExtract | null> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const fileResp = await axios.get(fileUrl, { responseType: "arraybuffer" });
  const base64Data = toBase64(fileResp.data);

  const response = await axios.post(
    `${GEMINI_ENDPOINT}?key=${apiKey}`,
    {
      contents: [
        {
          role: "user",
          parts: [
            { text: EXTRACTION_PROMPT },
            {
              inline_data: {
                mime_type: fileType || "application/pdf",
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
      },
    },
    {
      timeout: 30000,
    }
  );

  const text =
    response.data?.candidates?.[0]?.content?.parts
      ?.map((p: any) => p.text)
      .filter(Boolean)
      .join("\n") || "";

  return safeJsonParse(text);
};

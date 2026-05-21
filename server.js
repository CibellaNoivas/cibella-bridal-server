const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8080;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-image";

const RESULTS_DIR = path.join(__dirname, "results");

if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });

  res.end(JSON.stringify(data, null, 2));
}

function getBaseUrl(req) {
  const host = req.headers.host || `127.0.0.1:${PORT}`;
  const protocol =
    host.includes("127.0.0.1") || host.includes("localhost")
      ? "http"
      : "https";

  return `${protocol}://${host}`;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", chunk => {
      body += chunk.toString();
    });

    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("JSON body hatalı"));
      }
    });

    req.on("error", reject);
  });
}

async function imageInputToInlineData(input) {
  if (!input || typeof input !== "string") {
    throw new Error("Fotoğraf boş veya hatalı");
  }

  if (input.startsWith("data:image/")) {
    const match = input.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

    if (!match) {
      throw new Error("Base64 fotoğraf formatı hatalı");
    }

    return {
      inlineData: {
        mimeType: match[1],
        data: match[2]
      }
    };
  }

  const response = await fetch(input);

  if (!response.ok) {
    throw new Error("Foto indirilemedi: " + input);
  }

  let mimeType = response.headers.get("content-type") || "image/jpeg";

  if (!mimeType.startsWith("image/")) {
    mimeType = "image/jpeg";
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  return {
    inlineData: {
      mimeType,
      data: base64
    }
  };
}

function buildPrompt() {
  return `
THIS IS AN EXACT FASHION GARMENT VIRTUAL TRY-ON TASK.

IMAGE 1 = the customer/person photo.
IMAGE 2 = the exact clothing/garment reference.

MAIN TASK:
Create one realistic, premium, full-body virtual fitting preview where the person from IMAGE 1 is wearing the EXACT garment from IMAGE 2.

VERY IMPORTANT:
This is NOT a redesign task.
This is NOT a recoloring task.
This is NOT a wedding-dress conversion task.
This is NOT an inspiration task.
This is NOT a new-clothing generation task.
This is an EXACT GARMENT TRANSFER task.

THE GARMENT MAY BE:
- a wedding dress
- a bridal gown
- an evening gown
- an abiye / formal evening dress
- a party dress
- a bridesmaid dress
- a prom dress
- a luxury fashion dress
- a white gown
- a colored gown
- a green dress
- a black dress
- a red dress
- a blue dress
- a champagne dress
- a satin dress
- a lace dress
- any elegant formal garment

DO NOT ASSUME THE GARMENT IS WHITE.
DO NOT ASSUME THE GARMENT IS BRIDAL.
DO NOT TURN A COLORED DRESS INTO A WHITE GOWN.
DO NOT TURN AN EVENING DRESS INTO A BRIDAL DRESS.
DO NOT MAKE THE GARMENT MORE BRIDAL UNLESS THE REFERENCE GARMENT IS CLEARLY BRIDAL.

ABSOLUTE GARMENT FIDELITY RULES:
- Preserve the exact garment from IMAGE 2.
- Preserve the exact color of the garment.
- Preserve the exact silhouette.
- Preserve the exact neckline.
- Preserve the exact bodice structure.
- Preserve the exact straps, sleeves, off-shoulder details, shoulder shape, sleeve length, and arm details.
- Preserve the exact corset, waistline, draping, pleats, folds, seams, and construction details.
- Preserve the exact fabric look: satin, lace, chiffon, tulle, mikado, organza, crepe, beading, embroidery, appliqué, pearls, sequins, stones, transparency, lining, texture and sheen if present.
- Preserve the exact skirt shape, skirt volume, hemline and total length.
- Preserve the exact back design if it affects the visible shape.
- Preserve the exact dress category and mood.
- If the garment is green, it must remain green.
- If the garment is black, it must remain black.
- If the garment is red, it must remain red.
- If the garment is blue, it must remain blue.
- If the garment is champagne, it must remain champagne.
- If the garment is white, it must remain white.
- Never change the garment color.
- Never simplify the garment.
- Never remove major details.
- Never invent extra details that do not exist in IMAGE 2.
- Never create a different gown or a different dress.

TRAIN AND LENGTH RULES:
- If the dress has a train, preserve the train clearly.
- If the dress has a long train, show the full train.
- If the dress has a short train, preserve that short train.
- If the dress has no train, do not invent one.
- If the dress is floor-length, keep it floor-length.
- If it is midi or short, keep the same length.
- Do not crop out the hem.
- Do not hide the lower part of the garment.
- Show the full garment from head to toe.

BRIDAL RULES:
- If IMAGE 2 is clearly a wedding dress or bridal gown, preserve it exactly as bridal.
- Preserve bridal elegance, train, lace, embellishments, bodice details and volume.
- Do not redesign the bridal gown.
- Do not turn one bridal gown into another bridal gown style.
- Transfer the exact bridal gown only.

EVENING / ABIYE RULES:
- If IMAGE 2 is an evening gown, abiye, prom dress or party dress, keep it exactly as that type of dress.
- Do not convert it into a wedding dress.
- Do not whiten it.
- Do not add bridal lace, bridal train or bridal styling unless already present.
- Preserve the original eveningwear identity exactly.

PERSON IDENTITY RULES:
- Preserve the person from IMAGE 1.
- Preserve the face, identity, skin tone, hair, expression and overall recognizability.
- Preserve natural body proportions as much as possible.
- Do not replace the person with a different model.
- Do not change ethnicity.
- Do not change age.
- Do not make the person much thinner or much larger.
- Do not heavily reshape the body.
- Keep the result realistic and recognizable.

FIT AND REALISM RULES:
- Fit the garment naturally onto the person's body.
- Make the fabric follow gravity and body shape realistically.
- Add realistic folds, shadows and highlights.
- The dress should look like it is actually worn by the person.
- Avoid pasted-on appearance.
- Avoid deformed anatomy.
- Avoid distorted lace.
- Avoid broken hands, fingers, arms, legs, shoulders or neck.
- Avoid broken seams, melting fabric, unnatural stretching or strange distortions.
- Avoid fake mannequin-like body shapes unless the person already looks like that.
- Keep the try-on premium, realistic and elegant.

COMPOSITION RULES:
- Output a vertical full-body image.
- Show the person from head to toe.
- Show the entire garment clearly.
- Use a clean, elegant, premium background suitable for a boutique, showroom or fashion studio.
- Neutral, soft luxury tones are acceptable.
- Do not add text.
- Do not add logos.
- Do not add watermark.
- Do not add extra people.
- Do not create a collage.
- Output one final polished try-on image only.

QUALITY RULES:
- High realism.
- Premium fashion editorial quality.
- Elegant and commercial.
- Suitable for bridal stores, abiye stores, boutiques and luxury fashion shops.
- Clear dress details.
- Natural lighting.
- Clean presentation.

FINAL PRIORITIES IN ORDER:
1. Preserve the exact garment from IMAGE 2.
2. Preserve the exact garment color.
3. Preserve the exact garment silhouette and all important details.
4. Preserve the person's identity from IMAGE 1.
5. Make the result realistic and premium.
6. Do not redesign, recolor, simplify or convert the garment into another category.

If there is any uncertainty, prioritize exact garment fidelity over creativity.
The garment in IMAGE 2 must remain the same garment.
`;
}

function saveResultImage(base64Image, baseUrl) {
  const fileName = `result-${Date.now()}-${Math.round(Math.random() * 999999)}.png`;
  const filePath = path.join(RESULTS_DIR, fileName);

  fs.writeFileSync(filePath, Buffer.from(base64Image, "base64"));

  return {
    fileName,
    imageUrl: `${baseUrl}/results/${fileName}`
  };
}

function extractImageBase64FromGeminiResponse(data) {
  const candidates = data?.candidates || [];

  for (const candidate of candidates) {
    const parts = candidate?.content?.parts || [];

    for (const part of parts) {
      if (part?.inlineData?.data) {
        return part.inlineData.data;
      }
    }
  }

  return null;
}

async function generateGeminiTryOn({ personImage, dressImage, baseUrl }) {
  const personPart = await imageInputToInlineData(personImage);
  const dressPart = await imageInputToInlineData(dressImage);

  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          { text: buildPrompt() },
          personPart,
          dressPart
        ]
      }
    ],
    generationConfig: {
      responseModalities: ["IMAGE"]
    }
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      data
    };
  }

  const imageBase64 = extractImageBase64FromGeminiResponse(data);

  if (!imageBase64) {
    return {
      ok: false,
      status: 500,
      data: {
        error: "Gemini sonuç görseli bulunamadı",
        raw: data
      }
    };
  }

  const saved = saveResultImage(imageBase64, baseUrl);

  return {
    ok: true,
    status: 200,
    data: {
      ...saved,
      image: "data:image/png;base64," + imageBase64
    }
  };
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "GET" && req.url === "/") {
      return sendJson(res, 200, {
        ok: true,
        message: "Cibella Bridal Gemini backend çalışıyor",
        model: GEMINI_MODEL,
        hasKey: !!GEMINI_API_KEY,
        keyStart: GEMINI_API_KEY ? GEMINI_API_KEY.slice(0, 6) : "",
        keyEnd: GEMINI_API_KEY ? GEMINI_API_KEY.slice(-6) : ""
      });
    }

    if (req.method === "GET" && req.url === "/health") {
      return sendJson(res, 200, {
        ok: true,
        status: "healthy"
      });
    }

    if (req.method === "GET" && req.url.startsWith("/results/")) {
      const fileName = decodeURIComponent(req.url.replace("/results/", ""));
      const filePath = path.join(RESULTS_DIR, fileName);

      if (!fs.existsSync(filePath)) {
        return sendJson(res, 404, {
          ok: false,
          error: "Görsel bulunamadı"
        });
      }

      const img = fs.readFileSync(filePath);

      res.writeHead(200, {
        "Content-Type": "image/png",
        "Cache-Control": "no-store"
      });

      return res.end(img);
    }

    if (req.method === "POST" && req.url === "/bridal-gemini") {
      if (!GEMINI_API_KEY) {
        return sendJson(res, 500, {
          ok: false,
          error: "GEMINI_API_KEY tanımlı değil"
        });
      }

      const body = await readBody(req);

      if (!body.personImage || !body.dressImage) {
        return sendJson(res, 400, {
          ok: false,
          error: "personImage ve dressImage gerekli"
        });
      }

      const result = await generateGeminiTryOn({
        personImage: body.personImage,
        dressImage: body.dressImage,
        baseUrl: getBaseUrl(req)
      });

      return sendJson(res, result.status, {
        ok: result.ok,
        ...result.data
      });
    }

    return sendJson(res, 404, {
      ok: false,
      error: "Route bulunamadı"
    });
  } catch (err) {
    return sendJson(res, 500, {
      ok: false,
      error: err.message
    });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("Cibella Bridal Gemini backend çalışıyor: http://0.0.0.0:" + PORT);
});

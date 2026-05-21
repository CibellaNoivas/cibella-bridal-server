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
THIS IS AN EXACT GARMENT-ONLY VIRTUAL TRY-ON TASK.

IMAGE 1 = the customer/person who must appear in the final result.
IMAGE 2 = the garment reference. IMAGE 2 may show the garment on another model, mannequin, hanger, product photo, catalog photo or boutique background.

MAIN TASK:
Create one realistic, premium, full-body virtual try-on image where the PERSON FROM IMAGE 1 is wearing ONLY THE GARMENT FROM IMAGE 2.

ABSOLUTE MOST IMPORTANT RULE:
- Use IMAGE 1 as the only person in the final result.
- Do NOT copy the person/model/mannequin from IMAGE 2.
- Do NOT copy the face, head, hair, skin, pose, arms, legs, body, shoes or background from IMAGE 2.
- Extract ONLY the garment from IMAGE 2.
- Transfer ONLY the garment onto the person from IMAGE 1.
- The final image must show the person from IMAGE 1, not the model from IMAGE 2.

VERY IMPORTANT:
This is NOT a collage.
This is NOT placing one image over another.
This is NOT copying the model from the dress photo.
This is NOT a redesign task.
This is NOT a recoloring task.
This is NOT a wedding dress conversion task.
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
- a colored gown
- a white gown
- a green dress
- a black dress
- a red dress
- a blue dress
- any elegant formal garment

GARMENT EXTRACTION RULES:
- From IMAGE 2, identify the clothing item only.
- Ignore the model wearing it.
- Ignore the model's face.
- Ignore the model's hair.
- Ignore the model's skin.
- Ignore the model's body shape.
- Ignore the model's pose.
- Ignore the model's background.
- Ignore the model's shoes unless they are part of the garment styling.
- Transfer only the dress / gown / garment.

ABSOLUTE GARMENT FIDELITY RULES:
- Preserve the exact garment from IMAGE 2.
- Preserve the exact color of the garment.
- Preserve the exact silhouette.
- Preserve the exact neckline.
- Preserve the exact bodice structure.
- Preserve straps, sleeves, off-shoulder details, shoulder shape, sleeve length and arm details if present.
- Preserve corset, waistline, draping, pleats, folds, seams and construction details.
- Preserve fabric look: satin, lace, chiffon, tulle, mikado, organza, crepe, beading, embroidery, appliqué, pearls, sequins, stones, transparency, lining, texture and sheen if present.
- Preserve skirt shape, skirt volume, hemline and total length.
- Preserve the original garment category.
- If the garment is green, it must remain green.
- If the garment is black, it must remain black.
- If the garment is red, it must remain red.
- If the garment is blue, it must remain blue.
- If the garment is champagne, it must remain champagne.
- If the garment is white, it must remain white.
- Never change the garment color.
- Never turn a colored dress into a white bridal gown.
- Never turn an evening dress into a wedding dress.
- Never simplify the garment.
- Never remove major details.
- Never invent extra details.
- Never create a different dress.

TRAIN AND LENGTH RULES:
- If the garment has a train, preserve the train clearly.
- If the garment has no train, do not invent one.
- If the garment is floor-length, keep it floor-length.
- If it is midi or short, keep the same length.
- Show the full garment clearly.
- Do not crop the hem.
- Do not hide the lower part of the garment.

PERSON IDENTITY RULES:
- Preserve the person from IMAGE 1.
- Preserve IMAGE 1 face, identity, hair, skin tone, expression and natural body proportions.
- Do not replace the person with the model from IMAGE 2.
- Do not use the face from IMAGE 2.
- Do not use the body from IMAGE 2.
- Do not change the person's age or ethnicity.
- Do not make the person much thinner or larger.
- Keep the person realistic and recognizable.

CLOTHING REPLACEMENT RULES:
- Replace the original clothing worn by the person in IMAGE 1 with the garment from IMAGE 2.
- The original clothing from IMAGE 1 should not remain visible unless naturally hidden under the new garment.
- The garment from IMAGE 2 must be fitted onto the body of the person from IMAGE 1.
- Do not place the garment model in front of the person.
- Do not create two people.
- Do not keep the original model from IMAGE 2 in the final image.
- The final image must contain only one person.

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
- Keep the try-on premium, realistic and elegant.

COMPOSITION RULES:
- Output one vertical full-body image.
- Show the person from IMAGE 1 from head to toe.
- Show the entire garment clearly.
- Use a clean, elegant, premium boutique, showroom or fashion studio background.
- Do not add text.
- Do not add logos.
- Do not add watermarks.
- Do not add extra people.
- Do not create a collage.
- Output only the final polished try-on image.

FINAL PRIORITIES IN ORDER:
1. Use only the person from IMAGE 1.
2. Extract only the garment from IMAGE 2.
3. Preserve the exact garment design and color.
4. Fit it realistically onto the person from IMAGE 1.
5. Do not copy the model/person from IMAGE 2.
6. Do not create two people.
7. Do not redesign, recolor or convert the garment.

If there is any uncertainty, prioritize garment-only transfer.
The final result must show the IMAGE 1 person wearing the IMAGE 2 garment.
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

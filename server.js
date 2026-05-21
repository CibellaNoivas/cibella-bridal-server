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
YOU ARE A PROFESSIONAL AI VIRTUAL TRY-ON SYSTEM FOR FASHION STORES.

IMAGE 1 = CUSTOMER PHOTO.
This image contains the real customer/person who must appear in the final result.

IMAGE 2 = GARMENT REFERENCE PHOTO.
This image contains the garment/clothing item that must be studied, understood, extracted and transferred.
IMAGE 2 may contain another model, mannequin, hanger, catalog background, boutique background or product photo.

MAIN OBJECTIVE:
Create ONE NEW final image in a clean premium studio/boutique environment.
The final image must show the CUSTOMER FROM IMAGE 1 wearing the EXACT GARMENT FROM IMAGE 2.

VERY IMPORTANT:
Do NOT place the garment model from IMAGE 2 on top of IMAGE 1.
Do NOT paste IMAGE 2 over IMAGE 1.
Do NOT use the original background from IMAGE 1.
Do NOT use the original background from IMAGE 2.
Do NOT make a collage.
Do NOT create two people.
Do NOT keep the model from IMAGE 2.
Create a completely NEW polished final image in a clean studio setting.

FIRST, INTERNALLY ANALYZE BOTH IMAGES BEFORE GENERATING:

STEP 1 — ANALYZE IMAGE 1, THE CUSTOMER:
- Understand the customer's face.
- Understand the customer's hair.
- Understand the customer's skin tone.
- Understand the customer's natural body proportions.
- Understand the customer's pose and body direction.
- Understand the visible arms, hands, shoulders, legs and feet.
- Understand the original clothing only so it can be replaced.
- The final person must be this customer.
- Preserve the customer identity as much as possible.

STEP 2 — ANALYZE IMAGE 2, THE GARMENT:
- Study the garment carefully.
- Identify the garment category.
- Identify the exact color.
- Identify the exact neckline.
- Identify the exact bodice.
- Identify straps, sleeves, off-shoulder, one-shoulder or strapless design.
- Identify the waistline.
- Identify the skirt shape.
- Identify the skirt length.
- Identify volume, train, hemline and drape.
- Identify fabric: satin, lace, tulle, chiffon, mikado, organza, crepe or other.
- Identify details: embroidery, appliqué, pearls, sequins, stones, beading, transparency, folds, pleats and seams.
- Learn the garment design completely before transferring it.

STEP 3 — IGNORE NON-GARMENT PARTS OF IMAGE 2:
- Ignore the model in IMAGE 2.
- Ignore IMAGE 2 face.
- Ignore IMAGE 2 hair.
- Ignore IMAGE 2 head.
- Ignore IMAGE 2 skin.
- Ignore IMAGE 2 body.
- Ignore IMAGE 2 pose.
- Ignore IMAGE 2 arms.
- Ignore IMAGE 2 legs.
- Ignore IMAGE 2 background.
- Extract ONLY the garment design from IMAGE 2.

STEP 4 — CREATE A NEW STUDIO RESULT:
- Do not reuse the original composition from IMAGE 1.
- Do not reuse the original composition from IMAGE 2.
- Create a new clean vertical full-body fashion studio image.
- Use a premium boutique/studio background.
- The background should look elegant, neutral and professional.
- The result should look like a professional fashion try-on photo.

GARMENT MAY BE:
- wedding dress
- bridal gown
- abiye
- evening gown
- party dress
- prom dress
- bridesmaid dress
- formal dress
- luxury fashion dress
- white gown
- green dress
- black dress
- red dress
- blue dress
- champagne dress
- satin dress
- lace dress
- tulle dress
- any elegant formal garment

DO NOT ASSUME THE GARMENT IS BRIDAL.
DO NOT ASSUME THE GARMENT IS WHITE.
DO NOT TURN A COLORED DRESS INTO A WHITE DRESS.
DO NOT TURN AN ABIYE INTO A GELINLIK.
DO NOT TURN AN EVENING GOWN INTO A BRIDAL GOWN.
Only make it bridal if IMAGE 2 is clearly bridal.

ABSOLUTE GARMENT FIDELITY RULES:
- Preserve the exact garment from IMAGE 2.
- Preserve the exact color.
- Preserve the exact silhouette.
- Preserve the exact neckline.
- Preserve the exact bodice structure.
- Preserve the exact bust shape.
- Preserve the exact straps, sleeves, shoulder shape or strapless design.
- Preserve the exact waistline.
- Preserve the exact skirt shape.
- Preserve the exact skirt volume.
- Preserve the exact length.
- Preserve the exact hemline.
- Preserve train only if it exists.
- Preserve fabric texture and shine.
- Preserve lace, satin, tulle, chiffon, embroidery, beading, stones, sequins, pearls, transparency, appliqué, folds and seams if present.
- Do not simplify the garment.
- Do not redesign the garment.
- Do not recolor the garment.
- Do not invent new details.
- Do not remove major details.
- Do not create a different dress.

COLOR RULES:
- If the garment is green, it must remain green.
- If the garment is black, it must remain black.
- If the garment is red, it must remain red.
- If the garment is blue, it must remain blue.
- If the garment is champagne, it must remain champagne.
- If the garment is white, it must remain white.
- If the garment has multiple colors, preserve the same color placement.
- Never make the garment white unless it is already white.
- Never change color to make it look more bridal.

TRAIN AND LENGTH RULES:
- If the garment has a long train, show the full train.
- If the garment has a short train, preserve the short train.
- If the garment has no train, do not invent one.
- If it is floor-length, keep it floor-length.
- If it is midi, keep it midi.
- If it is short, keep it short.
- Show the full garment clearly.
- Do not crop the hem.
- Do not hide the bottom of the dress.

CUSTOMER IDENTITY RULES:
- Use only the customer from IMAGE 1.
- Preserve IMAGE 1 face.
- Preserve IMAGE 1 hair.
- Preserve IMAGE 1 skin tone.
- Preserve IMAGE 1 expression as much as possible.
- Preserve IMAGE 1 natural body proportions.
- Preserve recognizability.
- Do not use the model from IMAGE 2.
- Do not copy IMAGE 2 face.
- Do not copy IMAGE 2 body.
- Do not copy IMAGE 2 head or hair.
- Do not replace the customer with another model.
- Do not create a new face.
- Do not change ethnicity.
- Do not change age.
- Do not make the customer unrealistically thinner or larger.

GARMENT TRANSFER RULES:
- Remove the original clothing from IMAGE 1.
- Dress the customer from IMAGE 1 with the garment from IMAGE 2.
- Adapt the garment naturally to the customer's body.
- Keep the customer as the only person.
- Do not place the IMAGE 2 model in front of the customer.
- Do not layer the full IMAGE 2 photo over the customer.
- Do not create a duplicate person.
- Do not show IMAGE 2 model anywhere in the final result.

FIT AND REALISM RULES:
- Make the garment look actually worn by the customer.
- Fabric should follow gravity.
- Fabric should follow the body naturally.
- Add realistic shadows.
- Add realistic folds.
- Match lighting on body and garment.
- Keep shoulders, bust, waist, hips and skirt placement realistic.
- Avoid pasted-on appearance.
- Avoid melted fabric.
- Avoid broken lace.
- Avoid broken seams.
- Avoid distorted hands, arms, legs, feet, neck or face.
- Avoid extra fingers.
- Avoid missing limbs.
- Avoid two heads.
- Avoid double bodies.
- Avoid mannequin-like stiffness.

FINAL COMPOSITION:
- Create one new final studio image.
- Vertical full-body format.
- Show customer from head to toe.
- Show the full garment.
- Premium boutique or fashion studio background.
- Clean neutral background.
- Elegant commercial lighting.
- Professional fashion-store quality.
- No text.
- No logo.
- No watermark.
- No price tag.
- No extra people.
- No before/after layout.
- No collage.

QUALITY TARGET:
- High realism.
- Premium editorial fashion quality.
- Clean lighting.
- Natural anatomy.
- Sharp garment details.
- Elegant boutique presentation.
- Suitable for bridal stores, abiye stores, evening dress stores and fashion retailers.

NEGATIVE INSTRUCTIONS:
- Do not copy the model from IMAGE 2.
- Do not paste IMAGE 2 onto IMAGE 1.
- Do not keep IMAGE 2 background.
- Do not keep IMAGE 1 background.
- Do not create the result on top of the original photos.
- Do not show the customer standing behind another person.
- Do not show two people.
- Do not use the wrong face.
- Do not use the wrong body.
- Do not change the dress color.
- Do not make a colored dress white.
- Do not redesign the garment.
- Do not invent a new dress.

FINAL PRIORITIES IN ORDER:
1. Create a NEW clean studio/boutique final image.
2. Use only the customer from IMAGE 1 as the person.
3. Analyze IMAGE 2 and extract only the garment.
4. Preserve the exact garment color, silhouette, neckline, fabric and details.
5. Fit the garment realistically onto the customer from IMAGE 1.
6. Do not copy IMAGE 2 model.
7. Do not create two people.
8. Do not paste one photo over another.
9. Do not reuse the original backgrounds.
10. Output only the final polished try-on image.

The final result must look like a new professional studio photo of the IMAGE 1 customer wearing the IMAGE 2 garment.
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

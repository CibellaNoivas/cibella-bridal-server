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
YOU ARE PERFORMING A PROFESSIONAL FASHION VIRTUAL TRY-ON.

IMAGE 1 = CUSTOMER PHOTO.
This is the ONLY person who must appear in the final image.

IMAGE 2 = GARMENT REFERENCE PHOTO.
This image is used ONLY to study and extract the garment/clothing item.
IMAGE 2 may contain another model, mannequin, hanger, boutique background, catalog pose or product photo.

MAIN GOAL:
Create one realistic, premium, full-body virtual try-on image where the PERSON FROM IMAGE 1 is wearing the EXACT GARMENT FROM IMAGE 2.

BEFORE GENERATING, INTERNALLY ANALYZE BOTH IMAGES CAREFULLY:

STEP 1 — ANALYZE IMAGE 1, THE CUSTOMER:
- Identify the customer's face.
- Identify the customer's hair.
- Identify the customer's skin tone.
- Identify the customer's body proportions.
- Identify the customer's pose.
- Identify the customer's visible arms, hands, shoulders, legs and feet.
- Identify the original clothing only so it can be replaced.
- Preserve the customer as the final person.
- The final image must show the person from IMAGE 1, not the model from IMAGE 2.

STEP 2 — ANALYZE IMAGE 2, THE GARMENT:
- Study only the garment/clothing item.
- Ignore the model wearing it.
- Ignore the model's face.
- Ignore the model's hair.
- Ignore the model's skin.
- Ignore the model's body.
- Ignore the model's pose.
- Ignore the model's hands, arms, legs and feet.
- Ignore the model's shoes unless the shoes are clearly part of the desired styling.
- Ignore the background.
- Extract only the clothing item.

STEP 3 — UNDERSTAND THE GARMENT TYPE:
The garment may be:
- wedding dress
- bridal gown
- abiye
- evening gown
- party dress
- prom dress
- bridesmaid dress
- formal dress
- luxury fashion dress
- colored gown
- white gown
- black dress
- green dress
- red dress
- blue dress
- champagne dress
- satin dress
- lace dress
- tulle dress
- any elegant formal garment

DO NOT ASSUME THE GARMENT IS BRIDAL.
DO NOT ASSUME THE GARMENT IS WHITE.
DO NOT TURN A COLORED DRESS INTO A WHITE WEDDING DRESS.
DO NOT TURN AN EVENING DRESS INTO A BRIDAL DRESS.
DO NOT TURN AN ABIYE INTO A GELINLIK.
DO NOT MAKE THE GARMENT MORE BRIDAL UNLESS IMAGE 2 IS CLEARLY A BRIDAL GOWN.

STEP 4 — TRANSFER ONLY THE GARMENT:
- Remove/replace the original clothing from IMAGE 1.
- Put only the garment from IMAGE 2 onto the body of the person from IMAGE 1.
- Do not copy the person from IMAGE 2.
- Do not copy the face from IMAGE 2.
- Do not copy the head from IMAGE 2.
- Do not copy the hair from IMAGE 2.
- Do not copy the body from IMAGE 2.
- Do not copy the arms or pose from IMAGE 2.
- Do not place the IMAGE 2 model in front of the IMAGE 1 person.
- Do not create two people.
- The final image must contain only one person: the customer from IMAGE 1.

ABSOLUTE GARMENT FIDELITY RULES:
- Preserve the exact garment from IMAGE 2.
- Preserve the exact color.
- Preserve the exact silhouette.
- Preserve the exact neckline.
- Preserve the exact bodice structure.
- Preserve the exact bust shape.
- Preserve straps, sleeves, off-shoulder details, one-shoulder details or strapless design exactly.
- Preserve the waistline.
- Preserve corset details if present.
- Preserve draping, pleats, folds and seams.
- Preserve fabric type and visible texture.
- Preserve satin shine if satin.
- Preserve lace if lace.
- Preserve tulle layers if tulle.
- Preserve chiffon softness if chiffon.
- Preserve organza, mikado, crepe, embroidery, appliqué, pearls, sequins, stones, beading and transparency if present.
- Preserve skirt shape.
- Preserve skirt volume.
- Preserve hemline.
- Preserve length.
- Preserve train only if the garment has a train.
- If the garment has no train, do not invent a train.
- Never change the garment color.
- Never simplify the garment.
- Never invent new decoration.
- Never remove major garment details.
- Never create a different dress.

COLOR RULES:
- If IMAGE 2 garment is green, final garment must be green.
- If IMAGE 2 garment is black, final garment must be black.
- If IMAGE 2 garment is red, final garment must be red.
- If IMAGE 2 garment is blue, final garment must be blue.
- If IMAGE 2 garment is champagne, final garment must be champagne.
- If IMAGE 2 garment is white, final garment must be white.
- If IMAGE 2 garment has multiple colors, preserve the same color placement.
- Never recolor the garment.
- Never make the garment white unless it is already white in IMAGE 2.

BRIDAL / WEDDING DRESS RULES:
- If IMAGE 2 is clearly a bridal gown or wedding dress, preserve it exactly.
- Preserve bridal lace, train, veil-like details, corset, bodice, neckline, skirt volume and fabric.
- Do not redesign the bridal gown.
- Do not replace it with another bridal gown.
- Do not make it simpler or more generic.

ABIYE / EVENING DRESS RULES:
- If IMAGE 2 is an abiye, evening gown, party dress or prom dress, preserve it exactly as eveningwear.
- Do not make it bridal.
- Do not add bridal lace.
- Do not add a bridal train.
- Do not turn it into a white gown.
- Keep the original eveningwear identity, color and mood.

PERSON PRESERVATION RULES:
- Preserve the person from IMAGE 1.
- Preserve IMAGE 1 face.
- Preserve IMAGE 1 hair.
- Preserve IMAGE 1 skin tone.
- Preserve IMAGE 1 expression.
- Preserve IMAGE 1 natural body proportions.
- Preserve IMAGE 1 identity and recognizability.
- Do not replace the customer with a different model.
- Do not use IMAGE 2 model's face.
- Do not use IMAGE 2 model's body.
- Do not change ethnicity.
- Do not change age.
- Do not make the customer unrealistically thinner or larger.
- Do not heavily reshape the customer.

FIT AND REALISM RULES:
- Fit the garment naturally onto the customer from IMAGE 1.
- Adapt the garment to the customer's pose without changing the garment design.
- Make the fabric follow the body realistically.
- Make the fabric follow gravity.
- Add natural folds, shadows and highlights.
- Match lighting between body and garment.
- Make it look like the customer is truly wearing the garment.
- Keep shoulders, bust, waist, hips and skirt placement realistic.
- Avoid pasted-on appearance.
- Avoid mannequin-like stiffness.
- Avoid melted fabric.
- Avoid distorted lace or broken patterns.
- Avoid broken seams.
- Avoid strange body deformation.
- Avoid extra arms, extra legs, extra fingers or missing limbs.
- Avoid two heads, two faces or double bodies.
- Avoid keeping the old clothing visible.

COMPOSITION RULES:
- Output one final image only.
- Vertical full-body image.
- Show the customer from head to toe.
- Show the entire garment clearly.
- Use a clean, elegant, premium boutique, showroom or fashion studio background.
- Background should be neutral and not distract from the garment.
- Do not add text.
- Do not add logos.
- Do not add watermark.
- Do not add price tags.
- Do not add extra people.
- Do not create a before/after collage.
- Do not show IMAGE 2 model anywhere.

QUALITY RULES:
- High realism.
- Premium fashion editorial quality.
- Commercial boutique quality.
- Suitable for bridal stores, evening dress stores, abiye stores, boutiques and partner retailers.
- Clear garment details.
- Clean lighting.
- Elegant pose.
- Natural anatomy.
- Realistic fabric behavior.
- Professional result.

NEGATIVE INSTRUCTIONS:
- Do not copy the model from IMAGE 2.
- Do not paste the IMAGE 2 model onto IMAGE 1.
- Do not keep the IMAGE 2 head, face or body.
- Do not create two people.
- Do not hide the customer behind the garment model.
- Do not make the person from IMAGE 2 appear in the final result.
- Do not change the garment into a white bridal gown unless it is already white.
- Do not redesign.
- Do not recolor.
- Do not invent a new dress.
- Do not ignore the garment reference.
- Do not ignore the customer identity.

FINAL PRIORITIES, IN EXACT ORDER:
1. Use only the person from IMAGE 1 in the final image.
2. Analyze IMAGE 2 and extract only the garment.
3. Preserve the exact garment color.
4. Preserve the exact garment silhouette, neckline, fabric and details.
5. Fit the garment realistically onto the person from IMAGE 1.
6. Do not copy the model/person from IMAGE 2.
7. Do not create two people.
8. Do not redesign, recolor or convert the garment.

If there is uncertainty, prioritize:
- customer identity from IMAGE 1
- garment-only extraction from IMAGE 2
- exact color and shape preservation
- realistic try-on

The final result must show the IMAGE 1 customer wearing the IMAGE 2 garment.
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

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8080;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-image-preview";

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
YOU ARE A HIGH-END FASHION VIRTUAL TRY-ON SYSTEM FOR BRIDAL, EVENING WEAR AND LUXURY BOUTIQUES.

IMAGE 1 = CUSTOMER PHOTO.
This is the real customer/person. This is the ONLY person who must appear in the final image.

IMAGE 2 = GARMENT REFERENCE PHOTO.
This contains the exact garment to transfer. It may show the garment on a model, mannequin, hanger, catalog photo or boutique scene.

MAIN OBJECTIVE:
Create ONE NEW premium studio/boutique full-body image where the CUSTOMER FROM IMAGE 1 is wearing the EXACT GARMENT FROM IMAGE 2.

IMPORTANT WORKFLOW:
Before generating the final image, internally analyze both images carefully.

STEP A — ANALYZE THE CUSTOMER FROM IMAGE 1:
- Identify the customer's face, hair, skin tone, expression and identity.
- Identify the customer's body proportions, height impression, shoulder width, waist, hips, legs and natural pose.
- Identify the current clothing only so it can be completely removed.
- Preserve the customer as the only person in the final image.
- Do not copy the person, face, body, pose or background from IMAGE 2.

STEP B — TECHNICALLY ANALYZE THE GARMENT FROM IMAGE 2:
Study the garment as if preparing a professional fashion technical sheet:
- garment category: bridal gown, wedding dress, evening gown, abiye, formal dress, party dress, prom dress or other.
- exact color and shade.
- neckline shape: sweetheart, straight, V-neck, halter, high neck, off-shoulder, one-shoulder, strapless, etc.
- bust and bodice construction.
- straps, sleeves, shoulder details or strapless structure.
- waistline position.
- skirt shape: A-line, ball gown, mermaid, sheath, empire, flared, straight, pleated, etc.
- skirt volume.
- total length.
- hemline.
- train presence and train length.
- fabric behavior: satin, tulle, chiffon, lace, crepe, mikado, organza, glitter, sequins, embroidered fabric, etc.
- visible folds, draping, seams, pleats, corset lines, panels, embroidery, stones, pearls, appliqués, lace, transparency and shine.
- understand the exact garment before transferring it.

STEP C — EXTRACT ONLY THE GARMENT:
- From IMAGE 2, use ONLY the garment design.
- Ignore the model from IMAGE 2.
- Ignore IMAGE 2 face, hair, skin, body, arms, hands, legs, feet and pose.
- Ignore IMAGE 2 background.
- Do not copy IMAGE 2 person.
- Do not place IMAGE 2 person in the final image.
- The final image must contain only the customer from IMAGE 1.

CRITICAL CLOTHING REPLACEMENT:
- Completely remove the original clothing from IMAGE 1.
- Do not leave any original top, pants, blouse, dress, waistband, sleeves, straps or neckline visible.
- The customer must wear ONLY the garment from IMAGE 2.
- Do not put the new garment over the old clothes.
- Do not combine the old outfit with the new garment.
- If IMAGE 1 has a white top or pants, they must disappear completely.

GARMENT FIDELITY — EXTREMELY IMPORTANT:
- Preserve the exact garment from IMAGE 2.
- Preserve the exact color.
- Preserve the exact neckline.
- Preserve the exact bust shape.
- Preserve the exact bodice.
- Preserve the exact waistline.
- Preserve the exact skirt silhouette.
- Preserve the exact skirt volume.
- Preserve the exact length and hemline.
- Preserve the exact fabric behavior.
- Preserve visible folds, seams, pleats, panels and draping.
- Preserve decorative details.
- Preserve the original mood of the garment.
- If it is an abiye, keep it as an abiye.
- If it is a bridal gown, keep it as a bridal gown.
- If it is an evening gown, keep it as an evening gown.
- Do not redesign the garment.
- Do not make the dress more generic.
- Do not make the dress more bridal unless it already is bridal.
- Do not change the upper bodice design.
- Do not change strapless into straps.
- Do not change straps into strapless.
- Do not change neckline shape.
- Do not change skirt type.
- Do not add sleeves.
- Do not remove sleeves.
- Do not add a train unless the garment has a train.
- Do not remove a train if the garment has one.

COLOR RULES:
- If the garment is green, keep the same green.
- If the garment is white, keep the same white.
- If the garment is black, keep the same black.
- If the garment is red, keep the same red.
- If the garment is blue, keep the same blue.
- If the garment is champagne, keep the same champagne.
- Never recolor the garment.
- Never turn a colored dress into a white bridal gown.
- Never turn an abiye into a gelinlik.

NEW STUDIO IMAGE RULE:
- Create a new clean studio/boutique final image.
- Do not reuse IMAGE 1 background.
- Do not reuse IMAGE 2 background.
- Do not paste one image on top of the other.
- Do not make a collage.
- Use a premium neutral studio background.
- Lighting must be clean, elegant and commercial.

PERSON PRESERVATION:
- Preserve customer identity from IMAGE 1.
- Preserve face and hair from IMAGE 1.
- Preserve skin tone from IMAGE 1.
- Preserve natural body proportions as much as possible.
- Do not use the face or body from IMAGE 2.
- Do not create a new model.
- Do not make the customer unrealistically thinner or larger.
- Keep the customer recognizable.

FIT AND REALISM:
- Fit the garment naturally onto the customer's body.
- Make fabric follow gravity.
- Make fabric sit naturally on shoulders, bust, waist, hips and legs.
- Add realistic shadows and folds.
- Match lighting between body and garment.
- The dress must look actually worn, not pasted.
- Avoid melted fabric.
- Avoid distorted anatomy.
- Avoid extra arms, extra legs, extra fingers, double bodies or double faces.
- Avoid keeping the old clothes visible.
- Avoid copying the garment model.

OUTPUT:
- One final polished image only.
- Vertical full-body fashion image.
- Customer from head to toe.
- Entire garment visible.
- Premium boutique/studio background.
- No logo.
- No watermark.
- No text.
- No price tag.
- No extra people.
- No before/after layout.

FINAL PRIORITIES:
1. Use only the customer from IMAGE 1.
2. Completely remove IMAGE 1 original clothing.
3. Extract only the garment from IMAGE 2.
4. Preserve exact garment color, neckline, bodice, waistline, skirt shape, fabric and details.
5. Fit the garment realistically onto the customer.
6. Create a new clean studio/boutique final image.
7. Do not copy IMAGE 2 model.
8. Do not redesign the garment.

The final result must look like a new professional studio photo of the IMAGE 1 customer wearing the exact IMAGE 2 garment, with no original clothing visible.
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

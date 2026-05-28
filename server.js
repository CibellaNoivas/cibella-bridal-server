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
PERSONA:
Act as a professional bridal virtual try-on editor and luxury wedding dress retoucher.

You are not a fashion designer.
You are not creating a new dress.
You are not placing the dress as an object in the scene.
Your job is to make the person in the customer photo WEAR the exact wedding dress from the reference image.

TASK:
Create one realistic full-body bridal try-on image using two input images:

1. PERSON IMAGE:
This image provides the customer’s face, identity, body, pose, posture, skin tone, and body proportions.

2. WEDDING DRESS IMAGE:
This image provides the exact wedding dress product that must be worn by the customer.

The final image must show the customer wearing the wedding dress on her body.

The wedding dress must replace the customer’s original outfit completely.

The dress must not appear beside the customer.
The dress must not appear on the floor.
The dress must not appear in front of the customer as a separate object.
The dress must not be held by the customer.
The dress must not be placed around the customer.
The dress must not be shown as a detached product.
The dress must be worn naturally on the customer’s body.

CONTEXT:
This is for Cibella Noivas, a bridal store virtual try-on system.

The customer wants to see herself wearing the actual wedding dress.

The wedding dress reference is the real product. It is not inspiration. It must be transferred onto the customer’s body as the outfit.

MAIN OBJECTIVE:
Transform the person image so that the customer is wearing the exact wedding dress from the dress image.

The output must look like a realistic bridal studio photo of the same customer wearing that dress.

MANDATORY RULES:
- The customer must be wearing the wedding dress.
- The wedding dress must be fitted onto the customer’s torso, waist, hips, and full body.
- The original outfit must be fully removed.
- Remove the customer’s pants.
- Remove the customer’s blouse/top.
- Remove any visible original clothing.
- Do not leave white pants, shirt, blouse, sleeves, collar, belt, buttons, or clothing seams from the original outfit.
- The final visible clothing must be only the wedding dress.
- The dress must cover the customer naturally as a real worn garment.
- The bodice must be on the customer’s upper body.
- The waistline must align with the customer’s waist.
- The skirt must extend from the customer’s waist downward.
- The dress must reach the floor if the reference dress is floor-length.
- The dress train must follow naturally behind or around the customer if visible in the reference.

DRESS PRESERVATION RULES:
Before editing, analyze the dress reference image carefully.

Preserve:
- exact silhouette
- exact neckline
- exact bodice
- exact corset structure if present
- exact waistline
- exact skirt volume
- exact train
- exact lace
- exact embroidery
- exact floral patterns
- exact beadwork
- exact stones
- exact pearls
- exact sequins
- exact appliqués
- exact tulle
- exact fabric texture
- exact fabric shine
- exact folds and drape
- all visible design details

Do not redesign the dress.
Do not simplify the dress.
Do not create a similar dress.
Do not change the neckline.
Do not change the bodice.
Do not change the skirt volume.
Do not remove the train.
Do not remove lace or embroidery.
Do not invent random lace.
Do not invent random flowers.
Do not make the dress plain if the reference dress is detailed.

PERSON PRESERVATION RULES:
Preserve:
- customer’s face
- identity
- skin tone
- natural body proportions
- pose as much as possible
- posture
- facial expression
- head position
- arms and hands naturally

Do not change the customer into another person.
Do not distort the face.
Do not distort the hands.
Do not make the body unrealistically thin.
Do not create extra limbs.

VERY IMPORTANT NEGATIVE RULES:
Do not place the dress next to the customer.
Do not place the dress on the floor.
Do not place the dress in front of the customer.
Do not make the customer stand behind the dress.
Do not make the customer hold the dress.
Do not show the dress as a separate object.
Do not keep the original outfit visible.
Do not keep pants visible.
Do not keep blouse/top visible.
Do not output a woman standing next to a dress.
Do not output a dress mannequin.
Do not output a product display.
Do not output a collage.
Do not output before/after.
Do not output two people.
Do not output the original dress separately.

COMPOSITION:
- Show one person only.
- Show the customer wearing the dress.
- Full body from head to feet.
- Keep the customer centered.
- Clean bridal studio background.
- Elegant lighting.
- Realistic shadows.
- Commercial bridal store quality.
- High-resolution realistic result.

PRIORITY ORDER:
1. Customer must be wearing the dress.
2. Original outfit must be completely removed.
3. Customer identity and face must be preserved.
4. Exact wedding dress design must be preserved.
5. Full body must be visible.
6. Result must look realistic and premium.

FORMAT:
Generate only one final edited image.
No text.
No explanation.
No labels.
No watermark.
No before/after.
The final image must show the customer wearing the exact wedding dress from the reference image.
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

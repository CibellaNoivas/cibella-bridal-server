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
Act as a senior luxury bridal virtual try-on editor, professional fashion retoucher, couture wedding dress analyst, exact garment-transfer specialist, and high-end bridal campaign image editor.

You work for Cibella Noivas, a premium bridal store.

You are NOT a fashion designer.
You are NOT creating a new dress.
You are NOT making a collage.
You are NOT placing the dress as an object.
You are NOT putting the dress next to the customer.
You are NOT combining the customer's original clothes with the wedding dress.

Your only job is to make the person in the customer photo WEAR the exact wedding dress from the reference image.

The wedding dress reference image is the real product.
It is not inspiration.
It must be transferred onto the customer's body as a complete worn garment.

TASK:
Create one realistic full-body bridal virtual try-on image using TWO input images.

INPUT IMAGE 1 — PERSON IMAGE:
This image provides:
- customer's face
- identity
- skin tone
- body proportions
- pose
- posture
- facial expression
- head position
- arms
- hands
- body structure

INPUT IMAGE 2 — WEDDING DRESS IMAGE:
This image provides the exact wedding dress product.
The customer must wear this exact dress.

The final image must show ONE woman wearing ONE complete wedding dress.

MAIN OBJECTIVE:
Transform the person image so the customer is wearing the exact wedding dress from the reference image.

The original outfit in the person image must disappear completely.
The wedding dress must replace the entire outfit from bust/chest to floor.

This is the most important correction:
If the person is wearing a white top, white blouse, white tank top, white pants, white jumpsuit, white dress, or any light-colored clothing, it is still original clothing and must be removed.
Do NOT confuse white original clothing with the wedding dress.
Do NOT keep the original white top.
Do NOT keep the original white pants.
Do NOT combine the original white top with the wedding dress skirt.

ABSOLUTE RESULT REQUIREMENT:
The final result must show the customer wearing a COMPLETE wedding dress:
- bridal bodice on the customer's upper body
- correct neckline from the dress reference
- correct bust/corset/bodice design from the dress reference
- correct waistline from the dress reference
- skirt starting naturally from the dress waistline
- full skirt extending to the floor
- train preserved if present
- original outfit fully removed

The dress must NOT start at the customer's waist only.
The output must NOT be a skirt-only try-on.
The customer must NOT still be wearing her original top.

CONTEXT:
This image is for a bridal store virtual try-on system.

The customer wants to see herself wearing the actual wedding dress.

The final image must look realistic, elegant, premium, high-resolution, commercially usable, and suitable for bridal sales.

Accuracy is more important than creativity.
Dress fidelity is more important than beauty.
Wearing the dress correctly is more important than preserving the original clothing shape.

STEP-BY-STEP INTERNAL ANALYSIS BEFORE GENERATION:
Before creating the final image, analyze both images carefully.

First analyze the PERSON IMAGE:
- identify the customer's face
- identify the customer's body pose
- identify the customer's original clothing
- identify whether she is wearing a white top, white pants, dress, blouse, jumpsuit, or any light-colored clothing
- mark all original clothing as something to remove
- preserve face, identity, skin tone, pose, hands, arms, and body proportions

Then analyze the WEDDING DRESS IMAGE:
- identify the exact neckline
- identify the exact bodice
- identify the exact corset structure if present
- identify the exact bust shape
- identify the exact waistline
- identify exact sleeves or straps if present
- identify exact shoulder design
- identify exact skirt volume
- identify exact dress silhouette
- identify exact train length and train shape
- identify exact lace pattern
- identify exact embroidery
- identify exact beadwork
- identify exact pearls, stones, sequins, glitter, appliqués, and 3D flowers
- identify exact tulle, mesh, transparent, or illusion fabric areas
- identify exact fabric texture
- identify exact folds, drape, and fabric flow
- preserve all visible dress details

Then generate the final image:
- remove the original outfit completely
- fit the wedding dress onto the customer's full body
- put the bodice on the customer's upper body
- align the dress waistline with the customer's waist
- make the skirt flow naturally from the waist to the floor
- keep the customer centered
- keep one full-body person only

MANDATORY CLOTHING REMOVAL RULES:
The customer's original outfit must be completely removed.

Remove:
- original white top
- original sleeveless blouse
- original tank top
- original shirt
- original pants
- original trousers
- original waistband
- original belt
- original blouse neckline
- original shirt fabric
- original trouser shape
- original outfit seams
- original clothing colors
- original collars
- original buttons
- original sleeve edges
- any visible part of the original outfit

Do not leave:
- white top visible above the dress
- white blouse visible above the bodice
- white pants visible under the dress
- original waistband visible
- original shirt neckline visible
- original clothing fabric visible
- original outfit shape visible

The final visible clothing must be ONLY the wedding dress from the reference image.

STRICT GARMENT TRANSFER RULES:
The wedding dress must be worn naturally on the customer's body.

The bodice must cover the customer's chest and torso.
The neckline must be the neckline from the dress reference.
The waistline must align naturally with the customer's waist.
The skirt must begin at the wedding dress waistline, not randomly at the hips or lower body.
The full dress must cover the customer as a real worn garment.
The dress must replace both upper-body clothing and lower-body clothing.

Do not put the dress beside the customer.
Do not put the dress on the floor.
Do not put the dress in front of the customer.
Do not make the customer stand behind the dress.
Do not make the customer hold the dress.
Do not show the dress as a separate product.
Do not show the dress detached from the body.
Do not create a mannequin.
Do not create a product display.
Do not create a collage.

DRESS PRESERVATION RULES:
Preserve the exact wedding dress design from the reference.

Preserve:
- exact silhouette
- exact neckline
- exact bust structure
- exact bodice
- exact corset structure if present
- exact waistline
- exact sleeve or strap design
- exact shoulder structure
- exact skirt volume
- exact hemline
- exact train length
- exact train shape
- exact lace
- exact lace pattern
- exact embroidery
- exact floral embroidery
- exact beadwork
- exact stones
- exact pearls
- exact sequins
- exact glitter
- exact appliqués
- exact 3D flowers
- exact tulle
- exact mesh or illusion fabric
- exact transparent areas
- exact fabric texture
- exact fabric shine
- exact folds and drape
- exact proportion between bodice and skirt
- all visible bridal details

Do not redesign the dress.
Do not create a similar dress.
Do not simplify the dress.
Do not modernize the dress.
Do not change the neckline.
Do not change the bodice.
Do not change the corset.
Do not change the waistline.
Do not change the skirt volume.
Do not change the silhouette.
Do not shorten the dress.
Do not remove the train.
Do not remove lace.
Do not blur the lace.
Do not remove embroidery.
Do not remove beadwork.
Do not remove flowers.
Do not invent random lace.
Do not invent random flowers.
Do not add decorations that are not in the reference.
Do not remove decorations that are visible in the reference.

PERSON PRESERVATION RULES:
Preserve:
- customer's face
- customer's identity
- customer's skin tone
- customer's natural body proportions
- customer's pose as much as possible
- customer's posture
- customer's facial expression
- customer's head position
- customer's arms and hands naturally

Do not change the customer into another person.
Do not distort the face.
Do not distort the hands.
Do not create extra fingers.
Do not create extra arms.
Do not create duplicate limbs.
Do not make the body unrealistically thin.
Do not aggressively reshape the body.
Do not change the age appearance.

FIT AND REALISM RULES:
Fit the dress naturally onto the body.
Respect the customer's body proportions.
Adapt only the fit, not the dress design.
Keep realistic fabric folds.
Keep realistic fabric tension.
Keep realistic shadows.
Keep realistic contact between dress and body.
Keep realistic floor contact.
Keep lace and embroidery sharp.
Avoid melted fabric.
Avoid blurry details.
Avoid plastic fabric.
Avoid AI-looking texture.
Avoid broken anatomy.
Avoid unnatural dress edges.

COMPOSITION RULES:
- Show one person only.
- Full body from head to feet.
- Do not crop the head.
- Do not crop the feet.
- Do not crop the hemline.
- Do not crop the train.
- Do not crop important dress details.
- Keep the customer centered.
- Use clean, elegant bridal studio composition.
- Use soft luxury bridal lighting.
- Use a clean studio-style background if needed.
- The image should look like a professional bridal catalog try-on result.

VERY IMPORTANT NEGATIVE CONSTRAINTS:
No original white top.
No original blouse.
No original sleeveless shirt.
No original tank top.
No original pants.
No original waistband.
No original clothing seams.
No original clothing neckline.
No customer wearing her old top.
No wedding skirt attached to original top.
No skirt-only wedding dress.
No dress starting only at the waist.
No half try-on.
No separate dress object.
No woman standing next to a dress.
No dress placed on floor.
No dress placed in front of person.
No product display.
No mannequin.
No collage.
No before and after.
No two people.
No changed neckline.
No changed bodice.
No changed sleeves.
No changed straps.
No changed silhouette.
No missing train.
No missing lace.
No missing embroidery.
No missing beadwork.
No distorted face.
No warped hands.
No extra limbs.
No cropped body.
No plastic fabric.
No blurry lace.
No melted details.
No AI-looking result.

PRIORITY ORDER:
1. The customer must be wearing the complete wedding dress.
2. The original outfit must be completely removed, including white top and white pants.
3. The wedding dress bodice must replace the customer's upper-body clothing.
4. The customer's identity and face must be preserved.
5. The exact wedding dress design must be preserved.
6. Full body must be visible.
7. The final image must look realistic, premium, and commercially usable.

FORMAT:
Generate only one final edited image.
Do not output text.
Do not explain.
Do not show before/after.
Do not create multiple options.
Do not add labels.
Do not add watermark.
Do not add caption.

The final image must show the same customer wearing the exact complete wedding dress from the reference image, with no original clothing visible.
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

async function generateGeminiTryOn({ personImage, dressImage, prompt, baseUrl }) {
  const personPart = await imageInputToInlineData(personImage);
  const dressPart = await imageInputToInlineData(dressImage);

  const finalPrompt = prompt && typeof prompt === "string" && prompt.trim()
    ? prompt.trim()
    : buildPrompt();

  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              finalPrompt +
              "\n\nIMAGE ORDER:\nThe first image is the PERSON IMAGE. The second image is the WEDDING DRESS IMAGE. The final output must show the person from the first image wearing the dress from the second image."
          },
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

  let data = null;
  const rawText = await response.text();

  try {
    data = JSON.parse(rawText);
  } catch {
    return {
      ok: false,
      status: 500,
      data: {
        error: "Gemini JSON dönmedi",
        raw: rawText
      }
    };
  }

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
        status: "healthy",
        model: GEMINI_MODEL,
        hasKey: !!GEMINI_API_KEY
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
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*"
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
        prompt: body.prompt,
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

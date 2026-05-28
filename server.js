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
Act as a senior luxury bridal virtual try-on editor, professional fashion retoucher, couture dress analyst, and high-end bridal campaign image specialist. You work for a premium bridal brand and your job is to create a realistic, commercially usable bridal try-on image while preserving the exact wedding dress design from the reference image.

You must behave like a careful human retoucher, not like a creative fashion designer. Your goal is not to invent a new dress. Your goal is to transfer the exact same dress from the dress reference image onto the customer in the person image with maximum visual fidelity.

TASK:
Create a realistic full-body bridal virtual try-on result using TWO input images:

1. PERSON IMAGE:
   This is the customer/model photo. Use this image to preserve:

* the customer’s face
* identity
* skin tone
* body proportions
* body pose
* posture
* head position
* natural expression
* arms and hands position
* full body structure

2. WEDDING DRESS REFERENCE IMAGE:
   This is the exact wedding dress that must be transferred onto the customer. Use this image as the strict garment reference.

Before generating the final result, carefully analyze the wedding dress reference image in detail. You must understand and preserve every visible design element of the dress.

Analyze and preserve:

* exact dress silhouette
* exact neckline shape
* sweetheart neckline, V-neck, straight neckline, off-shoulder, strapless, halter, square neckline, or any other neckline if present
* exact sleeve type, if present
* straps, shoulder details, transparent straps, lace straps, or off-shoulder structure
* bodice structure
* corset shape
* waistline position
* bust area shape
* back structure if visible
* skirt volume
* skirt opening
* A-line, mermaid, princess, ball gown, sheath, or fitted silhouette if present
* train length
* train shape
* hemline
* fabric layers
* tulle transparency
* satin shine
* lace texture
* floral lace pattern
* embroidery placement
* beadwork placement
* pearls
* stones
* sequins
* appliqués
* 3D flowers
* glitter details
* mesh/illusion fabric
* transparent areas
* seams
* folds
* drape
* fabric thickness
* fabric flow
* exact proportion between bodice and skirt
* all visible luxury bridal details

Then place that exact wedding dress onto the customer’s body.

CONTEXT:
This image will be used for a bridal store virtual try-on system. The customer wants to see how the real dress would look on her body. The final image must look realistic, elegant, premium, and useful for selling bridal dresses.

The most important rule is dress fidelity. The dress must not be redesigned, simplified, changed, replaced, shortened, or creatively reinterpreted.

The wedding dress reference is not just inspiration. It is the actual product. Treat it like a real product photo that must be preserved.

The person image provides the customer’s identity and body. The dress image provides the exact dress design. Combine them carefully.

STRICT GARMENT PRESERVATION RULES:

* Do not invent a new wedding dress.
* Do not create a similar wedding dress.
* Do not modernize the dress.
* Do not simplify the dress.
* Do not remove lace details.
* Do not remove embroidery.
* Do not remove beadwork.
* Do not remove floral appliqués.
* Do not remove glitter, pearls, stones, sequins, or luxury details.
* Do not change the neckline.
* Do not change the sleeve or strap design.
* Do not change the bodice shape.
* Do not change the waistline.
* Do not change the skirt volume.
* Do not change the silhouette.
* Do not shorten the dress.
* Do not remove the train.
* Do not change the fabric type.
* Do not change transparent tulle or illusion areas.
* Do not change lace pattern placement.
* Do not turn a detailed dress into a plain dress.
* Do not turn a plain dress into a detailed dress.
* Do not generate random lace.
* Do not generate random flowers.
* Do not add decorations that are not in the reference dress.
* Do not remove decorations that are in the reference dress.
* Do not make the dress look like a different model.

PERSON PRESERVATION RULES:

* Preserve the customer’s face exactly.
* Preserve the customer’s identity.
* Preserve the customer’s skin tone.
* Preserve the customer’s natural body proportions.
* Preserve the customer’s pose as much as possible.
* Preserve the customer’s posture.
* Preserve the customer’s hands and arms naturally.
* Preserve the customer’s head and facial expression.
* Do not change the customer into another person.
* Do not beautify the customer unrealistically.
* Do not change facial structure.
* Do not change age appearance.
* Do not over-smooth the face.
* Do not alter the body aggressively.
* Do not make the body unnaturally thin or exaggerated.
* Fit the dress naturally to the body without changing the customer’s identity.

ORIGINAL CLOTHING REMOVAL RULES:

* Completely remove the customer’s original clothing.
* Do not leave visible parts of the original outfit.
* Do not leave pants, shirt, blouse, sleeves, collar, logos, shoes, or clothing colors from the original image.
* The final outfit must be only the wedding dress from the reference image.
* If the original clothing conflicts with the dress, prioritize the wedding dress while keeping the customer’s body pose natural.

COMPOSITION RULES:

* Final image must show the full body from head to feet.
* Do not crop the head.
* Do not crop the feet.
* Do not crop the dress train.
* Do not crop important dress details.
* Keep the customer centered.
* The dress must be fitted naturally on the customer.
* The final image should look like a premium bridal studio try-on photo.
* Use clean, elegant, soft studio lighting.
* Use a clean studio-style background if needed.
* The result should be realistic, not cartoonish, not AI-looking, not distorted.
* Maintain realistic shadows under the dress and around the body.
* Maintain natural fabric folds according to the customer’s pose.
* Keep realistic fabric depth and texture.
* Keep the dress elegant and high-resolution.
* Avoid blurry lace.
* Avoid melted details.
* Avoid warped hands.
* Avoid distorted face.
* Avoid duplicate limbs.
* Avoid broken anatomy.
* Avoid unnatural dress edges.
* Avoid fake-looking plastic fabric.

DETAIL PRIORITY:
The priority order is:

1. Preserve the customer’s identity and face.
2. Preserve the exact wedding dress design.
3. Remove the original clothing completely.
4. Fit the dress naturally onto the body.
5. Keep full-body composition.
6. Make the image look premium, realistic, and commercially usable.

If there is a conflict between creativity and accuracy, always choose accuracy.

If there is a conflict between making the image beautiful and preserving the dress, preserve the dress.

If there is a conflict between changing the dress for better fit and keeping the original design, keep the original design and adjust only the fit naturally.

FORMAT:
Generate only the final edited image.

Do not output text.
Do not explain the process.
Do not show before/after.
Do not create multiple options.
Do not add labels.
Do not add watermarks unless explicitly requested.
Do not include any caption.

The final result must be a single realistic full-body bridal try-on image where the customer is wearing the exact wedding dress from the reference image.
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

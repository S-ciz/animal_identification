
/*
package.json dependencies:
npm install express cors multer sharp @huggingface/transformers
*/
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";
import cors from "cors";
import multer from "multer";
import sharp from "sharp";
import { pipeline } from "@huggingface/transformers";
import { SPECIES } from "./animals.js";

import { AnomalPrediction } from "./anomal.js";

const app = express();
const PORT = process.env.PORT || 5000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Serve files from the 'public' folder at the root URL
app.use(express.static(path.join(__dirname, 'public')));

app.use(cors());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (file.mimetype?.startsWith("image/")) {
      callback(null, true);
    } else {
      callback(new Error("Please upload a valid image."));
    }
  }
});

// General-purpose vision-language model for zero-shot classification.
// It compares an image with candidate species labels.
const MODEL_NAME = "Xenova/clip-vit-base-patch32";

const THRESHOLD = 0.95
let classifier;

async function loadModel() {
  console.log("Loading Hugging Face image classifier...");

  classifier = await pipeline(
    "zero-shot-image-classification",
    MODEL_NAME
  );

  console.log("Hugging Face model loaded.");
}


async function predictImage(imageBuffer) {
  const tempPath = path.join(
    os.tmpdir(),
    `wildlife-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.jpg`
  );

  try {
    await sharp(imageBuffer)
      .rotate()
      .jpeg()
      .toFile(tempPath);

    const labels = SPECIES.map(
      (species) => `a photograph of ${species}`
    );

    const predictions = await classifier(
      tempPath,
      labels,
      { top_k: 5 }
    );

    //console.log("MODEL PREDICTIONS:", predictions);

    // Get the highest-scoring prediction.
    const bestPrediction = predictions[0];

    // Check whether the model's best label represents an animal.
    const animals_found =
      bestPrediction &&
      !bestPrediction.label.toLowerCase().includes("no animal") &&
      !bestPrediction.label.toLowerCase().includes("landscape");

     

    return {
      identified: Boolean(animals_found),

      species: animals_found
        ? bestPrediction.label
            .replace(/^a photograph of /i, "")
        : null,

      individual_id: null,

      confidence: bestPrediction?.score ?? 0,

      new_individual: null,

      detections: predictions,

      message: animals_found
        ? "Animal detected. Individual identification requires an additional re-identification model."
        : "No animal detected. Try another image."
    };

  } finally {
    await fs.unlink(tempPath).catch(() => {});
  }
}
// Health endpoint
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    model: MODEL_NAME,
    model_ready: Boolean(classifier)
  });
});

// Image prediction endpoint
app.post("/predict", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: "No image was sent. Use the form field 'image'."
    });
  }

  try {
    const {confidence} = await AnomalPrediction(req.file)
    let decision = confidence < THRESHOLD ? false : true
    let result = await predictImage(req.file.buffer);
    result = {...result, identified: decision}
    return res.json(result);
  } catch (error) {
    console.error("Prediction failed:", error);

    return res.status(500).json({
      error: "Image prediction failed."
    });
  }
});

// Handle oversized uploads and other upload errors.
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError &&
      error.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      error: "Image is larger than 10 MB."
    });
  }

  if (error) {
    return res.status(400).json({
      error: error.message || "Invalid upload."
    });
  }

  next();
});

// Load the model before accepting requests.
loadModel()
  .then(() => {
    app.listen(PORT,  () => {
      console.log(`Wildlife API running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to load AI model:", error);
    process.exit(1);
  });



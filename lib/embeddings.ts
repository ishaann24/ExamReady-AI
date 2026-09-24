import { pipeline } from "@xenova/transformers";

class EmbeddingPipeline {
  static task = "feature-extraction" as const;
  static model = "Xenova/all-MiniLM-L6-v2";
  static instance: any = null;

  static async getInstance() {
    if (this.instance === null) {
      this.instance = await pipeline(this.task, this.model);
    }
    return this.instance;
  }
}

/**
 * Generates a 384-dimensional embedding vector for input text using Xenova/all-MiniLM-L6-v2.
 * Caches the feature extraction pipeline after first load.
 */
export async function embedText(text: string): Promise<number[]> {
  const cleanText = text?.trim() || "";
  if (!cleanText) {
    return new Array(384).fill(0);
  }

  const extractor = await EmbeddingPipeline.getInstance();
  const output = await extractor(cleanText, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

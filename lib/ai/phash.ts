/**
 * Perceptual hash (pHash) — lightweight, pure-JS implementation.
 *
 * Uses `sharp` (already common in Next.js) to resize + greyscale, then
 * computes a 64-bit DCT-based hash. No native ML models, no GPU, no CUDA.
 *
 * Algorithm:
 *   1. Resize to 32×32 greyscale
 *   2. Compute 32×32 DCT
 *   3. Take the top-left 8×8 block (low-frequency components)
 *   4. Compute the median of those 64 values
 *   5. Each bit = 1 if above median, 0 if below
 *   → 64-bit hash string
 *
 * Hamming distance ≤ 6 → near-certain same image
 * Hamming distance ≤ 12 → likely same image
 * See PRD §9.5 for threshold rationale.
 */

import sharp from "sharp";

/**
 * Compute a 64-bit perceptual hash for an image.
 * @returns A 64-character string of '0' and '1' (bit string).
 */
export async function computePhash(imageBytes: Uint8Array): Promise<string> {
  // 1. Resize to 32×32 greyscale using sharp
  const { data } = await sharp(Buffer.from(imageBytes))
    .greyscale()
    .resize(32, 32, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Float64Array(32 * 32);
  for (let i = 0; i < 1024; i++) {
    pixels[i] = data[i];
  }

  // 2. Compute 2D DCT (Type II, unnormalized)
  const dctMatrix = dct2d(pixels, 32);

  // 3. Extract the top-left 8×8 block (lowest frequencies),
  //    excluding [0,0] which is the DC component (average brightness)
  const lowFreq: number[] = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if (y === 0 && x === 0) continue; // skip DC
      lowFreq.push(dctMatrix[y * 32 + x]);
    }
  }

  // 4. Median threshold
  const sorted = [...lowFreq].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  // 5. Build 64-bit hash: DC bit is always 0, rest threshold against median
  let hash = "0"; // DC bit
  for (const v of lowFreq) {
    hash += v >= median ? "1" : "0";
  }

  return hash;
}

/**
 * Compute Hamming distance between two 64-bit hash strings.
 * @returns Number of differing bits (0 = identical, 64 = maximally different).
 */
export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== 64 || hash2.length !== 64) {
    throw new Error("pHash must be exactly 64 bits");
  }
  let distance = 0;
  for (let i = 0; i < 64; i++) {
    if (hash1[i] !== hash2[i]) distance++;
  }
  return distance;
}

// ---------------------------------------------------------------------------
// DCT helpers (Type II, 2D)
// ---------------------------------------------------------------------------

/** 1D DCT-II (unnormalized). */
function dct1d(input: Float64Array): Float64Array {
  const N = input.length;
  const out = new Float64Array(N);
  for (let k = 0; k < N; k++) {
    let sum = 0;
    for (let n = 0; n < N; n++) {
      sum += input[n] * Math.cos((Math.PI * (2 * n + 1) * k) / (2 * N));
    }
    out[k] = sum;
  }
  return out;
}

/** 2D DCT computed as row-DCT then column-DCT. */
function dct2d(pixels: Float64Array, size: number): Float64Array {
  const result = new Float64Array(size * size);

  // Row-wise DCT
  const rowResult = new Float64Array(size * size);
  for (let y = 0; y < size; y++) {
    const row = pixels.slice(y * size, (y + 1) * size);
    const dctRow = dct1d(row);
    rowResult.set(dctRow, y * size);
  }

  // Column-wise DCT
  for (let x = 0; x < size; x++) {
    const col = new Float64Array(size);
    for (let y = 0; y < size; y++) {
      col[y] = rowResult[y * size + x];
    }
    const dctCol = dct1d(col);
    for (let y = 0; y < size; y++) {
      result[y * size + x] = dctCol[y];
    }
  }

  return result;
}

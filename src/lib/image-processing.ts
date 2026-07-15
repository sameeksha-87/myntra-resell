/**
 * Loads an image from a source URL/DataURL.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

/**
 * Computes the Laplacian Variance of the image to measure focus/blur.
 * Kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0]
 */
export async function measureBlur(
  imageSrc: string,
): Promise<{ variance: number; isBlurry: boolean }> {
  try {
    const img = await loadImage(imageSrc);
    const canvas = document.createElement("canvas");

    // Scale down image to standard size for performance and consistent thresholds
    const maxDim = 300;
    let width = img.width;
    let height = img.height;
    if (width > maxDim || height > maxDim) {
      if (width > height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return { variance: 200, isBlurry: false }; // fallback if no canvas context
    }

    ctx.drawImage(img, 0, 0, width, height);
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    // Convert to grayscale
    const grey = new Float32Array(width * height);
    for (let i = 0; i < data.length; i += 4) {
      // Standard luminance formula
      grey[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }

    // Compute Laplacian
    const laplacian = new Float32Array(width * height);
    let sum = 0;
    const count = (width - 2) * (height - 2);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        // Laplacian edge detection filter
        const val =
          grey[idx - width] + // top
          grey[idx - 1] + // left
          -4 * grey[idx] + // center
          grey[idx + 1] + // right
          grey[idx + width]; // bottom

        laplacian[idx] = val;
        sum += val;
      }
    }

    const mean = sum / count;
    let varianceSum = 0;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const diff = laplacian[idx] - mean;
        varianceSum += diff * diff;
      }
    }

    const variance = varianceSum / count;

    // Threshold is 100 as specified.
    const threshold = 100;
    const isBlurry = variance < threshold;

    return { variance, isBlurry };
  } catch (error) {
    console.error("Error in measureBlur:", error);
    // Return high variance fallback to not block the user entirely if image loading fails (e.g. CORS)
    return { variance: 150, isBlurry: false };
  }
}

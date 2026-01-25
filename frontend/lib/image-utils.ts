/**
 * Image Processing Utilities
 * --------------------------
 * Provides client-side compression and resizing to optimize uploads.
 */

interface CompressionOptions {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    mimeType?: string;
}

/**
 * Compresses an image file using the Canvas API.
 * 
 * @param file The original image File object
 * @param options Compression settings (default: 1280px width, 0.8 quality)
 * @returns A Promise resolving to a compressed Blob
 */
export async function compressImage(
    file: File,
    options: CompressionOptions = {}
): Promise<Blob | File> {
    const {
        maxWidth = 1600,
        maxHeight = 1600,
        quality = 0.8,
        mimeType = "image/jpeg"
    } = options;

    // 🛡️ Skip if it's not an image or if it's an SVG
    if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
        return file;
    }

    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.src = url;

        img.onload = () => {
            // 📐 Calculate dimensions while maintaining aspect ratio
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = Math.round((width * maxHeight) / height);
                    height = maxHeight;
                }
            }

            // 🎨 Draw to Canvas
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext("2d");
            if (!ctx) {
                URL.revokeObjectURL(url);
                resolve(file); // Fallback to original
                return;
            }

            // 2026 Strategy: Use smooth scaling
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";

            ctx.drawImage(img, 0, 0, width, height);

            // 📤 Export to Blob
            canvas.toBlob(
                (blob) => {
                    URL.revokeObjectURL(url); // 🧹 Cleanup
                    if (blob) {
                        // Convert back to File to preserve name if needed, 
                        // though Blobs are usually fine for FormData
                        resolve(blob);
                    } else {
                        resolve(file);
                    }
                },
                mimeType,
                quality
            );
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(file); // Fallback on error
        };
    });
}

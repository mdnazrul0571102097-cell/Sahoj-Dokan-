/**
 * Ultra-fast, reliable utility to compress and resize images (from File or Data URL)
 * using HTML5 Canvas & URL.createObjectURL.
 * Designed to handle high-resolution phone camera photos (12MP - 48MP) instantly
 * without freezing or timing out.
 */
export async function compressImage(
  fileOrDataUrl: File | string,
  maxWidth = 360,
  maxHeight = 360,
  quality = 0.8
): Promise<string> {
  return new Promise((resolve) => {
    let isResolved = false;
    let objectUrlToRevoke: string | null = null;
    const fallback = typeof fileOrDataUrl === 'string' ? fileOrDataUrl : '';

    const safeResolve = (val: string) => {
      if (isResolved) return;
      isResolved = true;
      if (objectUrlToRevoke) {
        try {
          URL.revokeObjectURL(objectUrlToRevoke);
        } catch (_) {}
      }
      clearTimeout(timer);
      resolve(val || fallback);
    };

    // 10-second generous timeout prevents any perpetual hang while giving phones plenty of time
    const timer = setTimeout(() => {
      console.warn('compressImage timeout reached, resolving fallback');
      safeResolve(fallback);
    }, 10000);

    try {
      // 1. Fast path for modern browsers using createImageBitmap (hardware-accelerated)
      if (typeof window !== 'undefined' && typeof window.createImageBitmap === 'function' && fileOrDataUrl instanceof File) {
        window.createImageBitmap(fileOrDataUrl)
          .then((bitmap) => {
            try {
              let width = bitmap.width;
              let height = bitmap.height;

              if (width > maxWidth || height > maxHeight) {
                if (width / height > maxWidth / maxHeight) {
                  height = Math.round((height * maxWidth) / width);
                  width = maxWidth;
                } else {
                  width = Math.round((width * maxHeight) / height);
                  height = maxHeight;
                }
              }

              const canvas = document.createElement('canvas');
              canvas.width = Math.max(width, 1);
              canvas.height = Math.max(height, 1);
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(bitmap, 0, 0, width, height);
                const compressed = canvas.toDataURL('image/jpeg', quality);
                bitmap.close();
                safeResolve(compressed);
                return;
              }
              bitmap.close();
            } catch (bmpErr) {
              console.warn('createImageBitmap draw warning:', bmpErr);
            }
            fallbackStandardLoader();
          })
          .catch(() => {
            fallbackStandardLoader();
          });
        return;
      }

      fallbackStandardLoader();

      function fallbackStandardLoader() {
        const img = new Image();

        img.onload = () => {
          try {
            let width = img.naturalWidth || img.width;
            let height = img.naturalHeight || img.height;

            if (!width || !height) {
              safeResolve(fallback);
              return;
            }

            if (width > maxWidth || height > maxHeight) {
              if (width / height > maxWidth / maxHeight) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
              } else {
                width = Math.round((width * maxHeight) / height);
                height = maxHeight;
              }
            }

            const canvas = document.createElement('canvas');
            canvas.width = Math.max(width, 1);
            canvas.height = Math.max(height, 1);

            const ctx = canvas.getContext('2d');
            if (!ctx) {
              safeResolve(fallback);
              return;
            }

            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, width, height);

            const compressed = canvas.toDataURL('image/jpeg', quality);
            safeResolve(compressed);
          } catch (err) {
            console.warn('Image processing fallback:', err);
            safeResolve(fallback);
          }
        };

        img.onerror = () => {
          console.warn('Image load failed for compression');
          safeResolve(fallback);
        };

        if (typeof fileOrDataUrl === 'string') {
          if (fileOrDataUrl.startsWith('http')) {
            img.crossOrigin = 'anonymous';
          }
          img.src = fileOrDataUrl;
        } else {
          // Instant synchronous object URL (zero copy, no FileReader overhead)
          try {
            const blobUrl = URL.createObjectURL(fileOrDataUrl);
            objectUrlToRevoke = blobUrl;
            img.src = blobUrl;
          } catch (blobErr) {
            // Fallback to FileReader if createObjectURL fails
            const reader = new FileReader();
            reader.onload = (e) => {
              img.src = (e.target?.result as string) || '';
            };
            reader.onerror = () => safeResolve(fallback);
            reader.readAsDataURL(fileOrDataUrl);
          }
        }
      }
    } catch (err) {
      console.warn('compressImage top exception:', err);
      safeResolve(fallback);
    }
  });
}

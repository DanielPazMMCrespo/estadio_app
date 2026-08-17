/**
 * Compressão de fotografias antes de entrarem na base de dados local.
 *
 * Porque existe: a câmara de um telemóvel moderno dá ficheiros de 3 a 8 MB.
 * Sem passar por aqui, dez avarias com foto enchiam o IndexedDB com 80 MB, e
 * cada sincronização tentava subir isso em base64 (que é 33% maior ainda).
 * Com 1600px no lado maior e JPEG a 0,75, a mesma foto fica em ~300 KB e
 * continua a dar para ler uma etiqueta ou um número de série.
 *
 * Nunca lança: se a compressão falhar por qualquer razão, devolve o ficheiro
 * original. Perder qualidade é aceitável; perder a foto do técnico não é.
 */

const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.75;

/**
 * Lê um ficheiro como dataURL.
 * @param {Blob} file
 * @returns {Promise<string>}
 */
function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Não foi possível ler o ficheiro'));
    reader.readAsDataURL(file);
  });
}

/**
 * Carrega um dataURL numa imagem pronta a desenhar.
 *
 * O limite de tempo não é zelo a mais: com uma foto corrompida, nem `onload`
 * nem `onerror` disparam, e sem ele a app ficava presa a gravar para sempre.
 *
 * @param {string} dataUrl
 * @param {number} [timeoutMs=8000]
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(dataUrl, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('Tempo esgotado a descodificar a imagem'));
    }, timeoutMs);

    const finish = (fn, arg) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(arg);
    };

    const img = new Image();
    img.onload = () => finish(resolve, img);
    img.onerror = () => finish(reject, new Error('Não foi possível descodificar a imagem'));
    img.src = dataUrl;
  });
}

/**
 * Calcula as dimensões finais, mantendo a proporção.
 * Uma foto que já seja pequena não é ampliada.
 * @param {number} width
 * @param {number} height
 * @returns {{width: number, height: number}}
 */
export function fitWithin(width, height, maxSide = MAX_SIDE) {
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  if (w <= 0 || h <= 0) return { width: 0, height: 0 };
  const longest = Math.max(w, h);
  if (longest <= maxSide) return { width: w, height: h };
  const ratio = maxSide / longest;
  return {
    width: Math.max(1, Math.round(w * ratio)),
    height: Math.max(1, Math.round(h * ratio))
  };
}

/**
 * Comprime uma fotografia da câmara.
 *
 * @param {Blob|File} file - o ficheiro tal como vem do input de câmara
 * @returns {Promise<{blob: Blob, dataUrl: string, mimeType: string, compressed: boolean}>}
 */
export async function compressPhoto(file) {
  const fallback = async () => {
    // Sem canvas (ambiente de teste) ou com erro: devolve o original intacto.
    let dataUrl = '';
    try { dataUrl = await readAsDataUrl(file); } catch { /* fica vazio */ }
    return {
      blob: file,
      dataUrl,
      mimeType: (file && file.type) || 'image/jpeg',
      compressed: false
    };
  };

  if (!file) return fallback();
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return fallback();
  }

  try {
    const originalDataUrl = await readAsDataUrl(file);
    const img = await loadImage(originalDataUrl);

    const { width, height } = fitWithin(img.naturalWidth || img.width, img.naturalHeight || img.height);
    if (!width || !height) return fallback();

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return fallback();

    // Fundo branco: um PNG com transparência viraria fundo preto em JPEG.
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    if (!dataUrl || !dataUrl.startsWith('data:image/jpeg')) return fallback();

    // Se por algum motivo a "compressão" ficou maior, fica o original.
    if (typeof file.size === 'number' && file.size > 0 && dataUrl.length >= file.size * 1.4) {
      return fallback();
    }

    const blob = await new Promise((resolve) => {
      try {
        if (typeof canvas.toBlob === 'function') {
          canvas.toBlob((b) => resolve(b), 'image/jpeg', JPEG_QUALITY);
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    });

    return {
      blob: blob || file,
      dataUrl,
      mimeType: 'image/jpeg',
      compressed: true
    };
  } catch (err) {
    console.info('[photoCompressor] Compressão falhou, fica a foto original:', err && err.message);
    return fallback();
  }
}

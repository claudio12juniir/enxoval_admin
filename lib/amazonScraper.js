// Busca os dados públicos de uma página de produto da Amazon (título, imagens,
// descrição, vídeo, preço) a partir do link colado pelo admin. É "melhor esforço":
// a Amazon pode bloquear acessos automatizados ou mudar o HTML a qualquer momento,
// então todo campo pode vir vazio e ser completado manualmente no painel.

const ASIN_RE = /\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i;

function extractAsin(url) {
  const match = url.match(ASIN_RE);
  return match ? match[1].toUpperCase() : null;
}

function stripScriptsAndStyles(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
}

function decodeEntities(text) {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMeta(html, property) {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  const match = html.match(re);
  return match ? decodeEntities(match[1]) : null;
}

function extractTitle(html) {
  const productTitle = html.match(/id="productTitle"[^>]*>\s*([^<]+?)\s*</);
  if (productTitle) return decodeEntities(productTitle[1]);

  const ogTitle = extractMeta(html, "og:title");
  if (ogTitle) return ogTitle;

  const titleTag = html.match(/<title>([^<]+)<\/title>/i);
  if (titleTag) {
    return decodeEntities(titleTag[1]).replace(/\s*[:\-|]?\s*Amazon\.com\.br.*$/i, "").trim();
  }
  return null;
}

function extractPrice(html) {
  const offscreen = html.match(/class="a-offscreen">\s*(R\$\s?[\d.,]+)\s*</);
  if (offscreen) return offscreen[1].replace(/\s+/g, " ").trim();

  const metaPrice = html.match(/<meta[^>]+itemprop=["']price["'][^>]+content=["']([^"']+)["']/i);
  if (metaPrice) return `R$ ${metaPrice[1]}`;

  return null;
}

function extractImages(html) {
  const images = new Set();

  // Galeria principal: variável JS `'colorImages': { 'initial': [ {"hiRes": "...", "large": "..."} ] }`
  const hiResMatches = html.matchAll(/"hiRes":"([^"]+)"/g);
  for (const m of hiResMatches) images.add(m[1].replace(/\\\//g, "/"));

  if (images.size === 0) {
    const largeMatches = html.matchAll(/"large":"(https:[^"]+)"/g);
    for (const m of largeMatches) images.add(m[1].replace(/\\\//g, "/"));
  }

  if (images.size === 0) {
    const landingImage = html.match(/id="landingImage"[^>]*\ssrc="([^"]+)"/);
    if (landingImage) images.add(landingImage[1]);

    const dynamicImage = html.match(/data-old-hires="([^"]+)"/);
    if (dynamicImage) images.add(dynamicImage[1]);
  }

  if (images.size === 0) {
    const ogImage = extractMeta(html, "og:image");
    if (ogImage) images.add(ogImage);
  }

  return Array.from(images).slice(0, 8);
}

function extractDescription(html) {
  const bullets = [];
  const bulletsBlockMatch = html.match(/id="feature-bullets"[\s\S]*?<\/ul>/);
  if (bulletsBlockMatch) {
    const items = bulletsBlockMatch[0].matchAll(/<span class="a-list-item">\s*([\s\S]*?)\s*<\/span>/g);
    for (const item of items) {
      const clean = decodeEntities(stripScriptsAndStyles(item[1]).replace(/<[^>]+>/g, " "));
      if (clean && clean.length > 2) bullets.push(clean);
    }
  }

  let description = null;
  const descBlock = html.match(/<div[^>]+id="productDescription"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/);
  if (descBlock) {
    const clean = decodeEntities(stripScriptsAndStyles(descBlock[1]).replace(/<[^>]+>/g, " "));
    if (clean) description = clean;
  }
  if (!description) description = extractMeta(html, "og:description");

  return { description, bullets: bullets.slice(0, 10) };
}

function extractVideo(html) {
  // Amazon carrega vídeos de produto via JS; a URL do .mp4 costuma aparecer
  // em blocos JSON embutidos no HTML. Tentamos alguns padrões conhecidos.
  const patterns = [
    /"url":"(https:[^"]+?\.mp4[^"]*)"/,
    /"videoUrl":"(https:[^"]+?)"/,
    /"marketplaceVideoURL":"(https:[^"]+?)"/,
  ];
  for (const re of patterns) {
    const match = html.match(re);
    if (match) return match[1].replace(/\\\//g, "/");
  }

  const ogVideo = extractMeta(html, "og:video") || extractMeta(html, "twitter:player");
  if (ogVideo) return ogVideo;

  return null;
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept-Language": "pt-BR,pt;q=0.9",
    },
  });
  const html = await response.text();
  return { ok: response.ok, html, finalUrl: response.url };
}

// Recebe um link de produto Amazon (com ou sem tag de afiliado) e retorna
// os dados extraídos. Nunca lança erro por não conseguir extrair um campo —
// campos ausentes voltam como null/[] para serem preenchidos manualmente.
async function scrapeProduct(rawUrl) {
  const url = new URL(rawUrl);
  if (!/amazon\.|amzn\.to/.test(url.hostname)) {
    throw new Error("O link informado não parece ser da Amazon.");
  }

  let html = null;
  let finalUrl = url.toString();
  let blocked = false;

  try {
    const result = await fetchHtml(url.toString());
    html = result.html;
    finalUrl = result.finalUrl || finalUrl;
    if (!result.ok && !html) blocked = true;
  } catch {
    blocked = true;
  }

  const asin = extractAsin(finalUrl) || extractAsin(rawUrl);
  if (!asin) {
    throw new Error("Não foi possível identificar o ASIN (código do produto) no link.");
  }

  const canonicalUrl = `https://www.amazon.com.br/dp/${asin}`;

  if (!html) {
    return {
      asin,
      url: canonicalUrl,
      title: null,
      price: null,
      images: [],
      description: null,
      bullets: [],
      video: null,
      blocked: true,
    };
  }

  const { description, bullets } = extractDescription(html);

  return {
    asin,
    url: canonicalUrl,
    title: extractTitle(html),
    price: extractPrice(html),
    images: extractImages(html),
    description,
    bullets,
    video: extractVideo(html),
    blocked,
  };
}

module.exports = { scrapeProduct, extractAsin };

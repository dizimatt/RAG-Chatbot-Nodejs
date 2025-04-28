import fs from 'fs';
import path from 'path';
import { marked } from 'marked';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { QdrantClient } from '@qdrant/js-client-rest';
import { embed, initEmbedder } from './embed.js';

console.log('🚀 ingest.js is running!');

const qdrant = new QdrantClient({
  url: 'http://localhost:6333',
  timeout: 10000,
  checkCompatibility: false
});

const COLLECTION = 'documents';
const SOURCE_DIR = './data/docs';

const readPDF = async (filepath) => {
  const buffer = fs.readFileSync(filepath);
  const uint8Array = new Uint8Array(buffer);
  const loadingTask = getDocument({ data: uint8Array });
  const pdf = await loadingTask.promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map(item => item.str);
    fullText += strings.join(' ') + '\n\n';
  }

  console.log(`📄 Extracted ${fullText.length} characters from ${path.basename(filepath)}`);
  return fullText;
};

const readMarkdown = (filepath) => {
  const md = fs.readFileSync(filepath, 'utf-8');
  return marked(md).replace(/<[^>]+>/g, '');
};

const readText = (filepath) => {
  return fs.readFileSync(filepath, 'utf-8');
};

function formatProduct(product) {
  return [
    `Product Title: ${product.title}`,
    `Vendor: ${product.vendor}`,
    `Description: ${stripHTML(product.body_html || '')}`,
    `Tags: ${product.tags && product.tags.length > 0 ? product.tags.join(', ') : 'none'}`,
    `Price: ${product.variants && product.variants.length > 0 ? product.variants[0].price : 'none'}`
  ].join('. ');
}

function stripHTML(html) {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

async function loadAllDocs(folder = SOURCE_DIR) {
  if (!fs.existsSync(folder)) {
    console.log(`📂 Folder not found: ${folder}`);
    return [];
  }

  const files = fs.readdirSync(folder);
  const chunks = [];

  for (const file of files) {
    const filepath = path.join(folder, file);
    const ext = path.extname(file).toLowerCase();
    let content = '';

    try {
      if (ext === '.pdf') {
        content = await readPDF(filepath);
      } else if (ext === '.md') {
        content = readMarkdown(filepath);
      } else if (ext === '.txt') {
        content = readText(filepath);
      } else if (ext === '.json') {
        const raw = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
        if (Array.isArray(raw.products)) {
          for (const p of raw.products) {
            const flattened = formatProduct(p);
            chunks.push(flattened);
          }
        }
        continue;
      } else {
        console.log(`⚠️ Skipping unsupported file: ${file}`);
        continue;
      }

      const paragraphs = content
        .split('\n\n')
        .map(p => p.trim())
        .filter(p => p.length > 20);

      for (const para of paragraphs) {
        chunks.push(para);
      }

      console.log(`✅ Loaded ${paragraphs.length} chunks from ${file}`);
    } catch (err) {
      console.error(`❌ Failed to read ${file}:`, err.message);
    }
  }

  return chunks;
}

async function main() {
  await initEmbedder();

  const collections = await qdrant.getCollections();
  const exists = collections.collections.some(c => c.name === COLLECTION);

  if (!exists) {
    await qdrant.createCollection(COLLECTION, {
      vectors: { size: 384, distance: 'Cosine' }
    });
    console.log(`🆕 Collection "${COLLECTION}" created.`);
  } else {
    console.log(`✅ Collection "${COLLECTION}" already exists.`);
  }

  const docs = await loadAllDocs();

  const points = await Promise.all(docs.map(async (text, i) => ({
    id: i,
    vector: await embed(text),
    payload: { text }
  })));

  await qdrant.upsert(COLLECTION, { points });
  console.log(`📦 Ingested ${points.length} chunks into Qdrant.`);
}

main();
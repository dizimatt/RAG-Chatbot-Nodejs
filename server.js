import express from 'express';
import axios from 'axios';
import { embed, initEmbedder } from './embed.js';
import { QdrantClient } from '@qdrant/js-client-rest';

const app = express();
app.use(express.json());

const qdrant = new QdrantClient({
  url: 'http://localhost:6333',
  timeout: 10000,
  checkCompatibility: false
});

const COLLECTION = 'documents';

async function retrieveContext(query) {
  const vector = await embed(query);
  const search = await qdrant.search(COLLECTION, {
    vector,
    limit: 3,
    with_payload: true,
  });
  return search.map(hit => hit.payload.text).join('\n');
}

app.post('/chat', async (req, res) => {
  const message = req.body.message;
  const context = await retrieveContext(message);
  const prompt = `${context}
  You are an assistant that answers questions briefly and factually.
  
  User: ${message}
  Assistant:`;

  try {
    const response = await axios.post('http://localhost:11434/api/generate', {
      model: 'phi',  // or mistral, tinyllama, etc.
      prompt,
      stream: false
    });
    res.json({ reply: response.data.response.trim() });
  } catch (err) {
    console.error('Error in /chat:', err.message);
    if (err.response) {
      console.error('LLM response data:', err.response.data);
    }
    res.status(500).send('LLM error');
  }
});

app.listen(3000, async () => {
  try {
    await initEmbedder();
    console.log('RAG chatbot running on http://localhost:3000');
  } catch (e) {
    console.error('Embedder failed to load:', e.message);
  }
});

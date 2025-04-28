import fs from 'fs';
import path from 'path';

// Simple token estimator (avg. 4 chars per token)
export function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

export function logChunkStats(chunks, label = '📦 Embedded Chunks') {
  console.log(`\n${label}:\n${'-'.repeat(30)}`);
  chunks.forEach((chunk, index) => {
    const tokens = estimateTokens(chunk);
    const preview = chunk.length > 60 ? chunk.slice(0, 60) + '...' : chunk;
    console.log(`Chunk ${index + 1}: ~${tokens} tokens — "${preview}"`);
  });
  console.log(`Total Chunks: ${chunks.length}`);
  const totalTokens = chunks.reduce((sum, c) => sum + estimateTokens(c), 0);
  console.log(`Estimated Total Tokens: ~${totalTokens}`);
}

export function logQueryContext(contextText, label = '🔍 Retrieved Context') {
  const tokens = estimateTokens(contextText);
  console.log(`\n${label} (~${tokens} tokens):\n${'-'.repeat(30)}\n${contextText.slice(0, 800)}${contextText.length > 800 ? '...' : ''}`);
}

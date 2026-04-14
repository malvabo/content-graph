import { useCallback } from 'react';
import { useExecutionStore } from '../store/executionStore';
import { useOutputStore } from '../store/outputStore';

export function useClaudeStream() {
  const stream = useCallback(
    async (nodeId: string, prompt: string, model = 'claude-sonnet-4', temperature = 0.7) => {
      const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

      if (!apiKey) { useExecutionStore.getState().setError(nodeId, 'API key missing — set VITE_ANTHROPIC_API_KEY'); return ''; }

      useExecutionStore.getState().setStatus(nodeId, 'running');
      let accumulated = '';

      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({ model, max_tokens: 4096, temperature, stream: true, messages: [{ role: 'user', content: prompt }] }),
        });

        if (!res.ok) { useExecutionStore.getState().setError(nodeId, `API error: ${res.status}`); return ''; }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) { useExecutionStore.getState().setError(nodeId, 'No response stream'); return ''; }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                accumulated += parsed.delta.text;
                useOutputStore.getState().setOutput(nodeId, { text: accumulated });
              }
              if (parsed.type === 'message_delta' && parsed.usage) {
                useExecutionStore.getState().setTokenCounts(nodeId, { input: parsed.usage.input_tokens ?? 0, output: parsed.usage.output_tokens ?? 0 });
              }
            } catch { /* skip non-JSON lines */ }
          }
        }

        useExecutionStore.getState().setStatus(nodeId, 'complete');
        useOutputStore.getState().setOutput(nodeId, { text: accumulated });
        return accumulated;
      } catch (err) {
        useExecutionStore.getState().setError(nodeId, err instanceof Error ? err.message : 'Stream failed');
        return '';
      }
    },
    []
  );

  return { stream };
}

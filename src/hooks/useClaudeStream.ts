import { useCallback } from 'react';
import { useExecutionStore } from '../store/executionStore';
import { useOutputStore } from '../store/outputStore';
import { useSettingsStore } from '../store/settingsStore';

export function useClaudeStream() {
  const stream = useCallback(
    async (nodeId: string, prompt: string, model = 'claude-sonnet-4', temperature = 0.7, signal?: AbortSignal) => {
      const apiKey = useSettingsStore.getState().anthropicKey;

      if (!apiKey) {
        useExecutionStore.getState().setError(nodeId, 'No API key — add one in Settings');
        return '';
      }

      useExecutionStore.getState().setStatus(nodeId, 'running');
      let accumulated = '';
      let lineBuffer = ''; // #11: buffer partial SSE lines across chunks

      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          signal,
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

        let done = false;
        while (!done) {
          const result = await reader.read();
          if (result.done) {
            // #16: Final flush — decode any remaining bytes
            const remaining = decoder.decode();
            if (remaining) lineBuffer += remaining;
            done = true;
          } else {
            lineBuffer += decoder.decode(result.value, { stream: true });
          }

          // Process complete lines from buffer
          const lines = lineBuffer.split('\n');
          lineBuffer = lines.pop() || ''; // Keep incomplete last line in buffer

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') { done = true; break; } // #14: break outer loop
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                accumulated += parsed.delta.text;
                useOutputStore.getState().setOutput(nodeId, { text: accumulated });
              }
              if (parsed.type === 'message_start' && parsed.message?.usage) {
                useExecutionStore.getState().setTokenCounts(nodeId, { input: parsed.message.usage.input_tokens ?? 0, output: 0 });
              }
              if (parsed.type === 'message_delta' && parsed.usage) {
                const prev = useExecutionStore.getState().tokenCounts[nodeId];
                useExecutionStore.getState().setTokenCounts(nodeId, { input: prev?.input ?? 0, output: parsed.usage.output_tokens ?? 0 });
              }
            } catch { /* skip malformed JSON */ }
          }
        }

        useExecutionStore.getState().setStatus(nodeId, 'complete');
        useOutputStore.getState().setOutput(nodeId, { text: accumulated });
        return accumulated;
      } catch (err) {
        if (signal?.aborted) return '';
        useExecutionStore.getState().setError(nodeId, err instanceof Error ? err.message : 'Stream failed');
        return '';
      }
    },
    []
  );

  return { stream };
}

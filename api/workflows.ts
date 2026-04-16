import type { VercelRequest, VercelResponse } from '@vercel/node';
import { promises as fs } from 'fs';
import path from 'path';

const FILE = path.join('/tmp', 'workflows.json');

async function read(): Promise<unknown[]> {
  try { return JSON.parse(await fs.readFile(FILE, 'utf-8')); }
  catch { return []; }
}

async function write(data: unknown[]) {
  await fs.writeFile(FILE, JSON.stringify(data));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      return res.json(await read());
    }

    if (req.method === 'POST') {
      const workflow = req.body;
      if (!workflow?.id || !workflow?.name) return res.status(400).json({ error: 'id and name required' });
      const items = await read();
      const updated = [workflow, ...items.filter((w: any) => w.id !== workflow.id)];
      await write(updated);
      return res.json(workflow);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id || typeof id !== 'string') return res.status(400).json({ error: 'id required' });
      const items = await read();
      await write(items.filter((w: any) => w.id !== id));
      return res.status(204).end();
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e: any) {
    res.status(500).json({ error: 'Storage error', detail: e.message });
  }
}

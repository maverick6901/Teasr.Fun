import { Client } from '@replit/object-storage';

// Initialize Object Storage client
let client: Client | null = null;

// Try to initialize client, fallback gracefully
async function getClient(): Promise<Client | null> {
  if (client) return client;

  try {
    client = new Client();
    return client;
  } catch (error) {
    console.warn('Object Storage not configured:', error);
    return null;
  }
}

export async function saveToObjectStorage(key: string, data: Buffer): Promise<void> {
  try {
    console.log(`[ObjectStorage] Saving to key: ${key}, size: ${data.length} bytes`);
    const url = `https://object-storage.replit.com/${key}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': data.length.toString(),
      },
      body: data,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ObjectStorage] Save failed for ${key}: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`Failed to save to Object Storage: ${response.statusText}`);
    }

    console.log(`[ObjectStorage] Successfully saved: ${key}`);
  } catch (error) {
    console.error('[ObjectStorage] Error saving:', error);
    throw error;
  }
}

export async function getFromObjectStorage(key: string): Promise<Buffer> {
  try {
    console.log(`[ObjectStorage] Retrieving key: ${key}`);
    const url = `https://object-storage.replit.com/${key}`;
    const response = await fetch(url, {
      headers: {
        'Cache-Control': 'no-cache'
      }
    });

    if (!response.ok) {
      console.error(`[ObjectStorage] Get failed for ${key}: ${response.status} ${response.statusText}`);
      throw new Error(`Failed to get from Object Storage: ${response.statusText} (${response.status})`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log(`[ObjectStorage] Successfully retrieved: ${key}, size: ${buffer.length} bytes`);
    return buffer;
  } catch (error) {
    console.error('[ObjectStorage] Error getting:', error);
    throw error;
  }
}

export async function deleteFromObjectStorage(key: string): Promise<void> {
  const c = await getClient();
  if (!c) {
    throw new Error('Object Storage not configured');
  }
  await c.delete(key);
}

export async function existsInObjectStorage(key: string): Promise<boolean> {
  const c = await getClient();
  if (!c) return false;

  try {
    await c.downloadAsBytes(key);
    return true;
  } catch {
    return false;
  }
}
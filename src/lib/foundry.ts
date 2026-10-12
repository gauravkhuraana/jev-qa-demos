// Shared Microsoft Foundry settings + auth for demos 06 and 07.
// Auth order: 1) AZURE_FOUNDRY_API_KEY from .env  2) Entra ID token from the Azure CLI (run "az login" first).
import 'dotenv/config';
import { execSync } from 'node:child_process';

export const FOUNDRY_ENDPOINT = (
  process.env.AZURE_FOUNDRY_ENDPOINT ?? 'https://gakhu-mj7zi1ty-eastus2.services.ai.azure.com'
).replace(/\/+$/, '');

let cachedToken: string | undefined;

export function authHeaders(): Record<string, string> {
  const key = process.env.AZURE_FOUNDRY_API_KEY;
  if (key && key !== 'your_key_here') return { 'api-key': key };

  if (!cachedToken) {
    try {
      cachedToken = execSync(
        'az account get-access-token --resource https://cognitiveservices.azure.com --query accessToken --output tsv',
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
      ).trim();
    } catch {
      console.error('No AZURE_FOUNDRY_API_KEY in .env and "az account get-access-token" failed.');
      console.error('Fix: paste the key from Foundry (deployment > Endpoint > Key) into .env, or run "az login".');
      process.exit(1);
    }
  }
  return { Authorization: `Bearer ${cachedToken}` };
}

// Friendly hints for the usual HTTP errors.
export function explainError(status: number): string {
  const tips: Record<number, string> = {
    400: 'Request shape is wrong - check the body.',
    401: 'Key or token is missing/expired.',
    403: 'Your identity has no access to this deployment (role assignment).',
    404: 'Wrong endpoint, path or deployment name - copy them from the deployment details page.',
    422: 'Deployment name or a question definition is not accepted.',
    429: 'Rate limit hit - wait a minute and re-run.',
  };
  return tips[status] ?? '';
}

// Optional CLI arg: a test id like T05 -> run only that one and print the raw response.
export function pickFailures<T extends { id: string }>(all: T[]): { list: T[]; single: boolean } {
  const id = process.argv[2]?.toUpperCase();
  if (!id) return { list: all, single: false };
  const list = all.filter((f) => f.id === id);
  if (!list.length) {
    console.error(`Unknown test id "${id}". Use one of: ${all.map((f) => f.id).join(', ')}`);
    process.exit(1);
  }
  return { list, single: true };
}

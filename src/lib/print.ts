// Small helpers shared by all the demos. Nothing AI-specific lives here.
import 'dotenv/config'; // reads AI_GATEWAY_API_KEY from the .env file

// Print a section heading, e.g.  === Nightly triage ===
export function title(text: string) {
  console.log(`\n=== ${text} ===\n`);
}

// Stop early with a clear message if the API key is missing.
export function requireKey() {
  if (!process.env.AI_GATEWAY_API_KEY) {
    console.error('Missing AI_GATEWAY_API_KEY. Copy .env.example to .env and add your Vercel AI Gateway key.');
    process.exit(1);
  }
}

// Turn a probability (0..1) into a percentage string: 0.87 -> "87%"
export function pct(p: number | undefined): string {
  if (p === undefined) return 'n/a';
  return `${Math.round(p * 100)}%`;
}

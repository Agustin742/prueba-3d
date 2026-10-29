// Comma-separated allowed origins (e.g. the Vercel domain). Unset keeps local development open.
export const corsOrigin: string | string[] =
  process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim()).filter(Boolean) ?? '*';

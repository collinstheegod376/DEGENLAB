import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(8000),
  BOT_TOKEN: z.string().min(1),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(16).optional(),
  PUBLIC_BASE_URL: z.string().optional(),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().optional(),
  SOLANA_MAINNET_RPC_URL: z.string().default("https://api.mainnet-beta.solana.com"),
  SOLANA_DEVNET_RPC_URL: z.string().optional(),
  MARKET_DATA_API_KEY: z.string().optional(),
  PRACTICE_STARTING_BALANCE: z.string().default("10000"),
  QUOTE_MAX_AGE_SECONDS: z.coerce.number().default(30),
  PRACTICE_FEE_BPS: z.coerce.number().default(30),
  PRACTICE_SLIPPAGE_BPS: z.coerce.number().default(50),
  ENABLE_DEVNET_WALLET_VIEW: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment: ${issues}`);
  }
  return parsed.data;
}

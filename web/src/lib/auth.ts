import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { nextCookies } from 'better-auth/next-js';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { isAllowedEmail } from './allowlist';

// Google is the only way in. A Google account whose email isn't on the allow list is turned
// away before a user record is ever created; removal from the list is enforced on every
// request by requireAccount() in ./session.ts.
export const auth = betterAuth({
  database: drizzleAdapter(getDb(), { provider: 'pg', schema }),
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: [process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ''].filter(Boolean),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      prompt: 'select_account',
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (!(await isAllowedEmail(user.email))) {
            throw new APIError('FORBIDDEN', { message: 'not_on_allow_list' });
          }
        },
      },
    },
  },
  plugins: [nextCookies()],
});

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";

import { DrizzleAdapter } from "@auth/drizzle-adapter";

import { getDb, isDbConfigured } from "@/server/db/client";
import { accounts, sessions, users, verificationTokens } from "@/server/db/schema";

// ============================================================================
// Helpers
// ============================================================================

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

/**
 * Solo registrar Google OAuth si las credenciales están seteadas. Esto
 * evita que Auth.js explote en dev cuando todavía no se configuró Google.
 */
function buildProviders() {
  const providers: NextAuthConfig["providers"] = [];

  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
    providers.push(
      Google({
        clientId: process.env.AUTH_GOOGLE_ID,
        clientSecret: process.env.AUTH_GOOGLE_SECRET,
      }),
    );
  }

  // Credentials siempre disponible, pero solo funciona si hay DB
  providers.push(
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "email", type: "email" },
        password: { label: "contraseña", type: "password" },
      },
      async authorize(raw) {
        if (!isDbConfigured()) return null;

        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const db = getDb();
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, parsed.data.email))
          .limit(1);

        if (!user || !user.hashedPassword) return null;

        const ok = await bcrypt.compare(parsed.data.password, user.hashedPassword);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  );

  return providers;
}

// ============================================================================
// Config
// ============================================================================

export const authConfig: NextAuthConfig = {
  // Adapter solo cuando hay DB (en modo demo no se puede loguear)
  adapter: isDbConfigured()
    ? DrizzleAdapter(getDb(), {
        usersTable: users,
        accountsTable: accounts,
        sessionsTable: sessions,
        verificationTokensTable: verificationTokens,
      })
    : undefined,

  providers: buildProviders(),

  pages: {
    signIn: "/iniciar-sesion",
    newUser: "/registro",
  },

  // JWT sessions (necesario para Credentials provider; OAuth-only podría usar
  // database sessions pero JWT es más simple y serverless-friendly).
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 días
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },

  // En dev habilita más logging
  debug: process.env.NODE_ENV === "development",
};

// ============================================================================
// Exports
// ============================================================================

export const { auth, handlers, signIn, signOut } = NextAuth(authConfig);

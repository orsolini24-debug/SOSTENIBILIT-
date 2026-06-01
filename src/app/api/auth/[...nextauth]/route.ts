import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "demo@sustainchain.it" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, req) {
        // Mock authorization per la demo (Fase -1)
        if (credentials?.email && credentials?.password) {
          return { id: "00000000-0000-0000-0000-000000000002", name: "Demo User", email: credentials.email };
        }
        return null;
      }
    })
  ],
  pages: {
    signIn: '/auth/signin',
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.AUTH_SECRET,
});

export { handler as GET, handler as POST };

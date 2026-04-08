import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getServiceClient } from "@/lib/supabase";

const handler = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") return false;

      const db = getServiceClient();

      // Upsert user record on first Google sign-in
      const { error } = await db.from("users").upsert(
        {
          email: user.email!,
          name: user.name,
          avatar_url: user.image,
          google_id: account.providerAccountId,
        },
        { onConflict: "email", ignoreDuplicates: false }
      );

      if (error) {
        console.error("Failed to upsert user:", error.message);
        return false;
      }
      return true;
    },

    async session({ session }) {
      if (session.user?.email) {
        const db = getServiceClient();
        const { data } = await db
          .from("users")
          .select("id, role")
          .eq("email", session.user.email)
          .single();

        if (data) {
          (session.user as typeof session.user & { id: string; role: string }).id = data.id;
          (session.user as typeof session.user & { id: string; role: string }).role = data.role;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
});

export { handler as GET, handler as POST };

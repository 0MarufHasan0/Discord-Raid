import NextAuth from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import dbConnect from "../../../../../lib/db";
import User from "../../../../../lib/models/User";
import { isAdmin } from "../../../../../lib/discord";


export const authOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      authorization: { params: { scope: "identify" } },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub;
        session.user.username = token.name;
        
        try {
          await dbConnect();
          let userDoc = await User.findOne({ discordId: token.sub });
          if (!userDoc) {
            userDoc = new User({
              discordId: token.sub,
              username: token.name,
              points: 0
            });
            await userDoc.save();
          }
          session.user.points = userDoc.points;
          session.user.raidsSubmitted = userDoc.raidsSubmitted || 0;
          session.user.raidsApproved = userDoc.raidsApproved || 0;
          session.user.twitter = userDoc.twitter || null;
          
          // Verify admin privilege via guild roles
          session.user.isAdmin = await isAdmin(token.sub);
        } catch (err) {
          console.error("Error syncing user session to MongoDB:", err);
          session.user.isAdmin = false;
        }
      }
      return session;
    },
    async jwt({ token, profile }) {
      if (profile) {
        token.id = profile.id;
      }
      return token;
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/",
    error: "/",
  }
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

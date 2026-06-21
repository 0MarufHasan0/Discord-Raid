import Header from "../components/Header";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import dbConnect from "../../../lib/db";
import User from "../../../lib/models/User";
import Raid from "../../../lib/models/Raid";
import UserRoleExpiration from "../../../lib/models/UserRoleExpiration";
import ProfileClient from "./ProfileClient";
import { getGuildMember, getGuildRoles } from "../../../lib/discord";

export const revalidate = 0; // Fresh content

async function getUserProfileData(userId) {
  try {
    await dbConnect();
    
    // Fetch fresh user record
    const user = await User.findOne({ discordId: userId }) || null;
    
    // Fetch recent raid submissions (limit to last 20)
    const raids = await Raid.find({ userId })
      .sort({ submittedAt: -1 })
      .limit(20) || [];
      
    // Fetch active claims / whitelists
    const claims = await UserRoleExpiration.find({ userId })
      .sort({ createdAt: -1 }) || [];

    // Fetch live Discord Guild Member data and roles
    const member = await getGuildMember(userId);
    const guildRoles = await getGuildRoles();
    
    let joinDate = null;
    let avatarUrl = null;
    const discordRoles = [];

    if (member) {
      joinDate = member.joined_at;
      if (member.user && member.user.avatar) {
        avatarUrl = `https://cdn.discordapp.com/avatars/${userId}/${member.user.avatar}.png`;
      } else {
        avatarUrl = `https://cdn.discordapp.com/embed/avatars/${parseInt(userId) % 5}.png`;
      }

      if (member.roles && guildRoles && guildRoles.length > 0) {
        member.roles.forEach(roleId => {
          const role = guildRoles.find(r => r.id === roleId);
          if (role && role.name !== "@everyone") {
            discordRoles.push({
              id: role.id,
              name: role.name,
              color: role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#6366f1'
            });
          }
        });
      }
    }

    return {
      user: user ? JSON.parse(JSON.stringify(user)) : null,
      raids: JSON.parse(JSON.stringify(raids)),
      claims: JSON.parse(JSON.stringify(claims)),
      discordInfo: {
        joinDate,
        avatarUrl,
        discordRoles
      }
    };
  } catch (error) {
    console.error("Error fetching profile data:", error);
    return { 
      user: null, 
      raids: [], 
      claims: [],
      discordInfo: { joinDate: null, avatarUrl: null, discordRoles: [] }
    };
  }
}

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  
  // Redirect to homepage if not authenticated
  if (!session) {
    redirect("/");
  }

  const { user, raids, claims, discordInfo } = await getUserProfileData(session.user.id);

  return (
    <>
      <Header />
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <ProfileClient 
          initialUser={user} 
          raids={raids} 
          claims={claims} 
          discordInfo={discordInfo} 
        />
      </main>
    </>
  );
}


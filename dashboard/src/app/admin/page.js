import Header from "../components/Header";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import dbConnect from "../../../lib/db";
import Tweet from "../../../lib/models/Tweet";
import Raid from "../../../lib/models/Raid";
import User from "../../../lib/models/User";


export const revalidate = 0; // Fresh content on load

async function getAdminData() {
  try {
    await dbConnect();

    // Fetch active target tweets
    const tweets = await Tweet.find().sort({ postedAt: -1 }).limit(50) || [];

    // Fetch pending raid submissions
    const pendingRaids = await Raid.find({ status: "pending" }).sort({ submittedAt: 1 }) || [];

    // Fetch users (top 100)
    const users = await User.find().sort({ points: -1 }).limit(100) || [];

    return {
      tweets: JSON.parse(JSON.stringify(tweets)),
      pendingRaids: JSON.parse(JSON.stringify(pendingRaids)),
      users: JSON.parse(JSON.stringify(users))
    };
  } catch (error) {
    console.error("Error fetching admin data:", error);
    return { tweets: [], pendingRaids: [], users: [] };
  }
}

export default async function AdminPage() {
  const session = await getServerSession(authOptions);

  // Secure validation: Only allow Discord Admins to load this page
  if (!session || !session.user.isAdmin) {
    redirect("/");
  }

  const { tweets, pendingRaids, users } = await getAdminData();

  // Import AdminClient dynamically or directly
  const AdminClient = (await import("./AdminClient")).default;

  return (
    <>
      <Header />
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center md:text-left mb-8">
          <h1 className="text-3xl md:text-5xl font-extrabold font-outfit text-white mb-2">
            Admin Control Center
          </h1>
          <p className="text-slate-400 text-sm md:text-base">
            Approve raid submissions, post target tweets, and manage user point balances.
          </p>
        </div>

        <AdminClient initialTweets={tweets} initialPendingRaids={pendingRaids} initialUsers={users} />
      </main>
    </>
  );
}

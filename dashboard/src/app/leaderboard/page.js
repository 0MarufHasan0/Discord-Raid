import Header from "../components/Header";
import dbConnect from "../../../lib/db";
import User from "../../../lib/models/User";
import LeaderboardClient from "./LeaderboardClient";

export const revalidate = 0; // Fresh content on load

async function getLeaderboardUsers() {
  try {
    await dbConnect();
    const users = await User.find()
      .sort({ points: -1, raidsApproved: -1 }) || [];
    return JSON.parse(JSON.stringify(users));
  } catch (error) {
    console.error("Error fetching leaderboard users:", error);
    return [];
  }
}

export default async function LeaderboardPage() {
  const users = await getLeaderboardUsers();
  return (
    <>
      <Header />
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center md:text-left mb-10">
          <h1 className="text-3xl md:text-5xl font-extrabold font-outfit text-white mb-2">
            Top Raiders
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-xl">
            Live rankings of the top Chess DAO community members based on approved raid completions.
          </p>
        </div>

        <LeaderboardClient initialUsers={users} />
      </main>
    </>
  );
}

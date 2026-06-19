# Marketplace Boss Bot

A Discord bot built with `discord.js` v14 to manage points, raid submissions, and automated announcement postings in multiple channels using MongoDB Atlas.

---

## Prerequisites
Before hosting or running the bot, ensure you have:
1. **Node.js** (v16.11.0 or higher is recommended)
2. **npm** (comes packaged with Node.js)
3. **MongoDB Atlas Database URL** (or a local MongoDB instance)
4. **Discord Developer Bot Token & Client ID**

---

## Installation & Setup

### 1. Clone & Install Dependencies
Navigate to the project root directory and run the following command to install the required packages:
```bash
npm install
```

### 2. Configure Environment Variables
Create a file named `.env` in the root directory and configure the following fields:
```env
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_bot_client_id
MONGODB_URL=your_mongodb_connection_url
ADMIN_ROLE_ID=role_id_1,role_id_2,...
TWEET_CHANNEL_ID=channel_id_1,channel_id_2,...
```
* **ADMIN_ROLE_ID**: A comma-separated list of Discord Role IDs that can execute administrator commands (e.g., `/addtweet`, `/approveraid`).
* **TWEET_CHANNEL_ID**: A comma-separated list of Channel IDs where the bot will post tweets.

---

## Running the Bot

### Step 1: Register Application Commands
Before starting the bot for the first time (or after modifying slash command structures), register the slash commands with Discord globally:
```bash
node deploy-commands.js
```
*Alternatively, you can run:*
```bash
npm run deploy
```

### Step 2: Start the Bot
Run the following command to start the bot:
```bash
node index.js
```
*Alternatively, you can run:*
```bash
npm start
```

---

## Commands Reference

### Admin Commands (Requires Admin Role)
* `/addtweet <content> [tweet_link] [duration_days] [duration_hours] [duration_minutes] [points]` - Post a premium Twitter announcement to all configured `TWEET_CHANNEL_ID`s with "Like", "Retweet" link buttons, "Copy Tweet ID" button, and "Submit Raid" (crossed swords emoji ⚔️) button. Supported durations specify how long the raid remains active, and points specifies the reward (default: 10).
* `/addwlitem [name] [description] [point_cost] [total_slots]` - Add a new item/whitelist role to the marketplace.
* `/removewlitem [name]` - Deactivate a marketplace item.
* `/approveraid [raid_id]` - Approve a pending raid and reward points.
* `/rejectraid [raid_id] [reason]` - Reject a pending raid.
* `/addpoints [user] [points]` - Manually reward points to a user.
* `/removepoints [user] [points]` - Manually deduct points from a user.
* `/raidlist` - List recently submitted raids with date filters, user details, and remove instructions.
* `/editraidpoints <tweet_id> <points>` - Edit the point value of an active (non-expired) raid announcement and dynamically update its Discord announcement embed.

### User Commands
* `/settwitter <username>` - Link your Twitter/X account handle (without `@`) for automated verification of raid proof.
* `/disconnecttwitter` - Unlink your Twitter/X account.
* `/submitraid <link> <tweet_id>` - Submit a raid link proof (e.g., tweet reply, quote, or like) with a valid Tweet ID.
* `/removemyraid <tweet_id>` - Remove a submitted raid to correct a mistake (deducts rewarded points).
* `/claimwl [item_name]` - Claim a whitelist role from the marketplace using points.
* `/mypoints` - View your total points and raid statistics.
* `/myraidhistory` - Check the status of your submitted raids.
* `/marketplace` - View active items in the marketplace.
* `/leaderboard` - Show the top points leaderboard.

---

## Raid Submission & Twitter Verification Flow

The bot features a secure, automated raid submission system that integrates with Twitter/X handles:

1. **Link Twitter Handle**: Users must link their Twitter/X account using `/settwitter <username>` before they can submit raids. Only one Discord account can be linked to a specific Twitter handle at any given time.
2. **Submit Raid via Button/Modal**: Every raid announcement includes a green **Submit Raid** button with a Crossed Swords emoji (⚔️). Clicking this button opens a modal popup allowing users to directly paste their proof link (reply/quote tweet link).
3. **Automated Verifications**:
   * Ensures the user has linked their Twitter account.
   * Ensures the Tweet ID is correct, active, and has not expired.
   * Verifies that the user hasn't already submitted a raid for this specific tweet.
   * Extracts the username from the submitted Twitter proof link and verifies it matches the user's connected Twitter handle (case-insensitively).
   * Rejects if the user submits the original announcement link itself.
   * Checks for duplicate links across all submitted raids.
4. **Approval & Points**: On passing all checks, the raid is auto-approved, the user is awarded points corresponding to the tweet's points reward (default: 10), and the live leaderboard is updated.


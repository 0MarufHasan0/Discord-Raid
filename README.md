# Marketplace Boss (Discord-Raid Bot)

এটি একটি ডিসকর্ড বট যা মেম্বারদের সোশ্যাল মিডিয়া/টুইটার রেইড ট্র্যাক করে, পয়েন্ট ম্যানেজ করে এবং অর্জিত পয়েন্ট দিয়ে মার্কেটপ্লেস শপ থেকে হোয়াইটলিস্ট (WL) বা অন্যান্য আইটেম ক্লেম করার সুবিধা দেয়।

---

## 🛠️ প্রোজেক্ট স্ট্রাকচার ও ফাইলসমূহের বিবরণী

প্রোজেক্টের প্রতিটি ফোল্ডার ও `.js` ফাইলের কাজ নিচে বিস্তারিত দেওয়া হলো:

### 📁 Root (মূল ডিরেক্টরি)

*   **[index.js](file:///c:/project/Discord-Raid/index.js):** বটের প্রধান ফাইল। বট স্টার্ট হলে এটি মঙ্গোডিবি ডাটাবেস ও ডিসকর্ডের সাথে সংযোগ স্থাপন করে এবং `commands/` ফোল্ডারের সব কমান্ড লোড করে।
*   **[config.js](file:///c:/project/Discord-Raid/config.js):** পরিবেশ ভেরিয়েবল বা `.env` ফাইল থেকে সিক্রেট টোকেন ও কনফিগারেশন রিড করে অ্যাপ্লিকেশন জুড়ে এক্সপোর্ট করে।
*   **[deploy-commands.js](file:///c:/project/Discord-Raid/deploy-commands.js):** বটের সব স্ল্যাশ (/) কমান্ড ডিসকোর্ডে গ্লোবালি রেজিস্টার করার জন্য ব্যবহৃত স্ক্রিপ্ট।
*   **[dropIndex.js](file:///c:/project/Discord-Raid/dropIndex.js):** ডাটাবেস ইনডেক্স ক্লিন করার প্রয়োজনীয় স্ক্রিপ্ট।

### 📁 commands/admin/ (অ্যাডমিন কমান্ডসমূহ)

অ্যাডমিন কমান্ডগুলো চালানোর জন্য মেম্বারের কাছে `.env` ফাইলে নির্ধারিত অ্যাডমিন রোল আইডি থাকতে হয়।

*   **[addtweet.js](file:///c:/project/Discord-Raid/commands/admin/addtweet.js):** নতুন রেইড এনাউন্স করার মূল কমান্ড। 
    *   *পরিবর্তনসমূহ:* 
        *   **কন্টেন্ট পজিশনিং:** কাস্টম কন্টেন্ট টেক্সট (যেমন: `hello`) এমবেডের বাইরে এবং সবার উপরে পাঠানো হয়।
        *   **লোগো থাম্বনেইল:** প্রতিটা এনাউন্সমেন্ট এমবেডের থাম্বনেইল হিসেবে বটের প্রোফাইল পিকচার সেট করা হয়।
        *   **টুইটার লাইভ স্ট্যাটস:** FxTwitter API-এর মাধ্যমে লাইক, রিটুইট, রিপ্লাই ও ভিউ সংখ্যা (`💬  🔁  ❤️  👁️`) এমবেড ডেসক্রিপশনে লাইভ শো করে।
        *   **এক্সপায়ারি টাইম:** রেইডের মেয়াদ সেট করার জন্য তিনটি ঐচ্ছিক প্যারামিটার (`duration_days`, `duration_hours`, `duration_minutes`) রয়েছে (ডিফল্ট ২৪ ঘণ্টা)। এটি মঙ্গোডিবিতে সেভ হয় এবং এমবেড ডেসক্রিপশনে ডাইনামিক ডিসকর্ড টাইমস্ট্যাম্পে শো করে।
        *   **সহজ কপি বাটন:** এমবেডের নিচে `Copy Tweet ID` নামের একটি বাটন যুক্ত করা হয়েছে, যাতে ক্লিক করলে ইউজার খুব সহজে Tweet ID কপি করতে পারেন।
*   **[addpoints.js](file:///c:/project/Discord-Raid/commands/admin/addpoints.js):** কোনো মেম্বারকে সরাসরি পয়েন্ট দেওয়ার জন্য ব্যবহৃত হয় এবং সফলভাবে পয়েন্ট যোগ হলে মেম্বারকে নোটিফাই করে।
*   **[removepoints.js](file:///c:/project/Discord-Raid/commands/admin/removepoints.js):** মেম্বারের অ্যাকাউন্ট থেকে ম্যানুয়ালি পয়েন্ট কেটে নেওয়া।
*   **[approveraid.js](file:///c:/project/Discord-Raid/commands/admin/approveraid.js):** মেম্বারদের পেন্ডিং ও রিজেক্টেড রেইড ম্যানুয়ালি অনুমোদন করে ১০ পয়েন্ট রিওয়ার্ড দেওয়া।
*   **[rejectraid.js](file:///c:/project/Discord-Raid/commands/admin/rejectraid.js):** ভুল বা ইনভ্যালিড রেইড (পেন্ডিং বা ইতিমধ্যে অ্যাপ্রুভড) বাতিল করা, ১০ পয়েন্ট কেটে নেওয়া এবং বাতিলকরণের কারণ জানিয়ে মেম্বারকে ইনবক্স করা।
*   **[raidlist.js](file:///c:/project/Discord-Raid/commands/admin/raidlist.js):** পেন্ডিং, অ্যাপ্রুভড বা রিজেক্টেড রেইড সাবমিশনের তালিকা রেইড আইডি সহ প্রদর্শন করা।
*   **[addwlitem.js](file:///c:/project/Discord-Raid/commands/admin/addwlitem.js):** পয়েন্ট শপ বা মার্কেটপ্লেসে নতুন গিফট/হোয়াইটলিস্ট আইটেম যুক্ত করা। (ইনপুট রেজেক্স-এসকেপড করা হয়েছে)।
*   **[removewlitem.js](file:///c:/project/Discord-Raid/commands/admin/removewlitem.js):** শপ থেকে নির্দিষ্ট আইটেম মুছে ফেলা। (ইনপুট রেজেক্স-এসকেপড করা হয়েছে)।

### 📁 commands/user/ (ইউজার কমান্ডসমূহ)

*   **[submitraid.js](file:///c:/project/Discord-Raid/commands/user/submitraid.js):** মেম্বারদের রেইডের লিংক সাবমিট করার কমান্ড। 
    *   *পরিবর্তনসমূহ:* ডুপ্লিকেট রেইড লিংক সাবমিশন প্রতিরোধ করে এবং একই Tweet ID তে মেম্বারদের একাধিকবার রেইড দেওয়া ব্লক করে। মেয়াদ উত্তীর্ণ (Expired) টুইটের জন্য সাবমিশন ব্লক করা হয়। সফল ভ্যালিডেশনের পর সরাসরি রেইডটি `approved` করে অ্যাকাউন্টে **১০ পয়েন্ট** যোগ করে দেওয়া হয়।
*   **[removemyraid.js](file:///c:/project/Discord-Raid/commands/user/removemyraid.js):** ভুল রেইড লিংক পরিবর্তন করার জন্য নিজের সাবমিশন বাতিল করার কমান্ড। বাতিল করলে **১০ পয়েন্ট** কেটে নেওয়া হবে এবং পুনরায় নতুন লিংক সাবমিটের সুযোগ দেওয়া হবে।
*   **[claimwl.js](file:///c:/project/Discord-Raid/commands/user/claimwl.js):** শপ থেকে ব্যালেন্স পয়েন্ট খরচ করে আইটেম ক্লেম বা কেনা। (ইনপুট রেজেক্স-এসকেপড করা হয়েছে)।
*   **[leaderboard.js](file:///c:/project/Discord-Raid/commands/user/leaderboard.js):** সার্ভারের শীর্ষ রেইডারদের তালিকা ও পয়েন্ট বোর্ড।
*   **[marketplace.js](file:///c:/project/Discord-Raid/commands/user/marketplace.js):** মার্কেটপ্লেসে এভেইলেবল আইটেম, তাদের পয়েন্ট কস্ট ও খালি স্লট দেখার কমান্ড।
*   **[mypoints.js](file:///c:/project/Discord-Raid/commands/user/mypoints.js):** মেম্বারের নিজের পয়েন্ট এবং সফল রেইডের কাউন্টার দেখা।
*   **[myraidhistory.js](file:///c:/project/Discord-Raid/commands/user/myraidhistory.js):** ইউজারের পূর্ববর্তী সব রেইডের হিস্ট্রি দেখা।

### 📁 database/models/ (মঙ্গোডিবি স্কিমা মডেল)

*   **[User.js](file:///c:/project/Discord-Raid/database/models/User.js):** ইউজারের পয়েন্ট ও রেইড কাউন্টার সেভ রাখার মডেল।
*   **[Raid.js](file:///c:/project/Discord-Raid/database/models/Raid.js):** মেম্বারদের প্রতিটি রেইডের বিবরণ ও প্রুফ স্টোর রাখার মডেল।
*   **[Tweet.js](file:///c:/project/Discord-Raid/database/models/Tweet.js):** ট্র্যাক করা টুইট আইডি, লিংক এবং মেয়াদ সংরক্ষণের মডেল।
*   **[MarketItem.js](file:///c:/project/Discord-Raid/database/models/MarketItem.js):** শপের আইটেম ও ক্লেম করা স্লট স্টোর করার মডেল।

### 📁 utils/ (ইউটিলিটি)

*   **[checkAdmin.js](file:///c:/project/Discord-Raid/utils/checkAdmin.js):** মেম্বারদের অ্যাডমিন পারমিশন রোল আইডি ডাটা চেক করার হেল্পার ইউটিলিটি।

---

## ⚙️ বটের সেটাআপ ও কনফিগারেশন

১. প্রথমে ডিরেক্টরিতে একটি `.env` ফাইল তৈরি করুন এবং নিচের মতো কনফিগারেশন লিখুন:
   ```env
   DISCORD_TOKEN=আপনার_ডিসকর্ড_বট_টোকেন
   CLIENT_ID=বটের_ক্লায়েন্ট_আইডি
   MONGODB_URL=আপনার_মঙ্গোডিবি_Atlas_ইউআরএল
   ADMIN_ROLE_ID=রোল_আইডি_১,রোল_আইডি_২
   TWEET_CHANNEL_ID=চ্যানেল_আইডি_১,চ্যানেল_আইডি_২
   ```
২. প্রয়োজনীয় মডিউল ইন্সটল করতে রান করুন:
   ```bash
   npm install
   ```
৩. স্ল্যাশ কমান্ডগুলো ডিসকর্ডে রেজিস্টার করতে রান করুন:
   ```bash
   npm run deploy
   ```
৪. বট চালু করতে রান করুন:
   ```bash
   npm start
   ```

---

## 🌐 ২৪/৭ ফ্রিতে হোস্টিং করার নিয়ম (Render / Koyeb)

বটটিকে ২৪ ঘণ্টা ফ্রিতে অনলাইনে একটিভ রাখতে প্রজেক্টে একটি বিল্ট-ইন **HTTP Keep-alive server** যুক্ত করা হয়েছে। 

### Render.com এ হোস্ট করার ধাপসমূহ:
১. [Render.com](https://render.com/) এ GitHub অ্যাকাউন্ট দিয়ে লগইন করুন।
২. **New +** > **Web Service** সিলেক্ট করে এই রিপোজিটরি কানেক্ট করুন।
৩. সেটিংস কনফিগার করুন:
   * **Build Command:** `npm install`
   * **Start Command:** `npm start`
   * **Instance Type:** **Free**
৪. **Advanced** অপশনে গিয়ে **Add Environment Variable** এ ক্লিক করে আপনার `.env` ফাইলের সব কনফিগারেশন কী ও ভ্যালুগুলো যোগ করুন।
৫. **Deploy** বাটনে ক্লিক করুন।

### ২৪ ঘণ্টা লাইভ রাখার উপায় (Render Keep-alive):
Render-এর ফ্রি সার্ভিস অব্যবহৃত থাকলে ১৫ মিনিট পর স্লিপ মোডে চলে যায়। এটি প্রতিরোধ করতে:
১. Render-এর দেওয়া ওয়েব সার্ভিস লিঙ্কটি কপি করুন (যেমন: `https://your-app.onrender.com`)।
২. [UptimeRobot](https://uptimerobot.com/) এ একটি ফ্রি অ্যাকাউন্ট তৈরি করুন।
৩. **Add New Monitor** সিলেক্ট করে:
   * **Monitor Type:** `HTTPS`
   * **Friendly Name:** `Discord Bot Keep Alive`
   * **URL:** আপনার Render লিঙ্কটি পেস্ট করুন।
   * **Interval:** `Every 5 minutes`
৪. মনিটরটি ক্রিয়েট করুন। UptimeRobot প্রতি ৫ মিনিট পর পর রিকোয়েস্ট পাঠিয়ে বটটিকে ২৪ ঘণ্টা সচল রাখবে।


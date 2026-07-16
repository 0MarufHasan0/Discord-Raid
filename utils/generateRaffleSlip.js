const { Jimp, loadFont } = require('jimp');
const fonts = require('jimp/fonts');
const path = require('path');
const fs = require('fs');

/**
 * Generates a clean white paper raffle slip with the Chess DAO logo seal,
 * listing the winners' Discord handles, Twitter handles, and points.
 * 
 * @param {Array<{ discordName: string, twitterName: string, points: number }>} winners 
 * @param {string|null} tweetId 
 * @returns {Promise<Buffer>} PNG image buffer
 */
async function generateRaffleSlip(winners, tweetId) {
  const fontTitle = await loadFont(fonts.SANS_32_BLACK);
  const fontBody = await loadFont(fonts.SANS_16_BLACK);

  // Dynamically calculate slip height based on number of winners
  const height = 150 + winners.length * 80 + 70;
  const width = 550;

  // 1. Create outer border (purple to match Chess DAO styling)
  const border = new Jimp({ width, height, color: 0x9B59B6ff });

  // 2. Create inner white paper slip
  const paper = new Jimp({ width: width - 8, height: height - 8, color: 0xffffffff });

  // 3. Load Chess DAO logo and resize it to overlay as a stamp/seal
  const logoPath = path.join(__dirname, '../dashboard/public/logo.jpg');
  if (fs.existsSync(logoPath)) {
    const logo = await Jimp.read(logoPath);
    logo.resize({ w: 75, h: 75 });
    // Composite logo in the top-right corner of the slip
    paper.composite(logo, width - 8 - 95, 20);
  }

  // 4. Print header titles on the paper slip
  paper.print({
    font: fontTitle,
    x: 30,
    y: 20,
    text: 'CHESS DAO'
  });

  paper.print({
    font: fontBody,
    x: 30,
    y: 55,
    text: 'OFFICIAL RAFFLE SLIP'
  });

  paper.print({
    font: fontBody,
    x: 30,
    y: 75,
    text: `Date: ${new Date().toLocaleDateString()} | Filter: ${tweetId ? tweetId.slice(0, 12) + '...' : 'None'}`
  });

  // Draw separator line
  const line = new Jimp({ width: width - 68, height: 2, color: 0xccccccff });
  paper.composite(line, 30, 110);

  // 5. Print winners list
  let y = 130;
  for (let i = 0; i < winners.length; i++) {
    const w = winners[i];
    
    paper.print({
      font: fontBody,
      x: 40,
      y: y,
      text: `Rank #${i + 1} - ${w.points} Points`
    });
    y += 22;

    paper.print({
      font: fontBody,
      x: 65,
      y: y,
      text: `Discord: ${w.discordName}  |  Twitter: ${w.twitterName}`
    });
    y += 48; // Line spacing
  }

  // Draw footer line
  paper.composite(line, 30, y);
  y += 15;

  paper.print({
    font: fontBody,
    x: 30,
    y: y,
    text: 'Verified by Chess DAO Raid System'
  });

  // Composite paper onto border
  border.composite(paper, 4, 4);

  // Return the buffer
  return await border.getBuffer('image/png');
}

module.exports = { generateRaffleSlip };

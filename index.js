import axios from 'axios';
import dotenv from 'dotenv';
import express from 'express';
import bodyParser from 'body-parser';
import cron from 'node-cron';
import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';

dotenv.config();

const app = express();
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.set('view engine', 'ejs');

const usernames = ['CodeShark', 'krishankant05', 'Deepanshu_Sharma', 'Za_Robot10', 'ananyak84', 'kalpitdon', 'varun94', 'AlphaSimar'];
const sessionCookie = process.env.SESSION_COOKIE;


var contests = [];
async function fetchContests() {
    const browser = await puppeteer.launch({
        args: [
          "--disable-setuid-sandbox",
          "--no-sandbox",
          "--single-process",
          "--no-zygote",
        ],
        executablePath:
          process.env.NODE_ENV === "production"
            ? process.env.PUPPETEER_EXECUTABLE_PATH
            : puppeteer.executablePath(),
      });
    const page = await browser.newPage();
    await page.goto('https://atcoder.jp/contests/', { waitUntil: 'networkidle2' });

    const contests = await page.evaluate(() => {
        const extractContests = (selector) => {
            const contestElements = document.querySelectorAll(`${selector} tbody tr`);
            return Array.from(contestElements).map(row => {
                const columns = row.querySelectorAll('td');
                return {
                    time: columns[0].innerText.trim(),
                    title: columns[1].innerText.trim(),
                    link: columns[1].querySelector('a').href.trim(),
                };
            });
        };

        return {
            upcoming: extractContests('#contest-table-upcoming'),
            recent: extractContests('#contest-table-recent'),
        };
    });

    await browser.close();

    return contests;
}


const userInfoArray = [];

async function fetchAtCoderUserInfo(username) {
    try {
        const response = await axios.get(`https://atcoder.jp/users/${username}`);
        const html = response.data;
        const $ = cheerio.load(html);

        let userRatingText = $('th:contains("Rating")').next().text().trim();

        // Extract the numerical rating and Kyu ranking
        let numericalRating = null;
        let kyuRanking = null;
        let isProvisional = false;

        // Check if the rating is provisional and has a Kyu ranking
        const provisionalMatch = userRatingText.match(/(\d+)\s*\(Provisional\)(\d+)\s*―\s*(\d+)\s*Kyu/);
        if (provisionalMatch) {
            numericalRating = parseInt(provisionalMatch[2], 10);
            kyuRanking = `${provisionalMatch[3]} Kyu`;
            isProvisional = true;
        } else {
            // If not provisional, check for a regular rating and Kyu ranking
            const regularMatch = userRatingText.match(/(\d+)\s*―\s*(\d+)\s*Kyu/);
            if (regularMatch) {
                numericalRating = parseInt(regularMatch[1], 10);
                kyuRanking = `${regularMatch[2]} Kyu`;
            } else {
                // If no Kyu ranking, just extract the plain numerical rating
                const plainRatingMatch = userRatingText.match(/(\d+)/);
                if (plainRatingMatch) {
                    numericalRating = parseInt(plainRatingMatch[1], 10);
                }
            }
        }
        if (numericalRating === null) {
            numericalRating = 0;
        }
        const userRank = $('th:contains("Rank")').next().text().trim();
        const userAffiliation = $('th:contains("Affiliation")').next().text().trim();

        const userInfo = {
            username,
            rating: userRatingText,
            numericalRating,
            kyuRanking,
            isProvisional,
            rank: userRank,
            affiliation: userAffiliation,
        };

        // Store user info in the global array
        userInfoArray.push(userInfo);

    } catch (error) {
        console.error(`Failed to fetch user information for ${username}:`, error.message);
    }
}
async function fetchAllUsersInfo(usernames) {
    for (const username of usernames) {
        await fetchAtCoderUserInfo(username);
    }


    // sort the array based on rating
    userInfoArray.sort((a, b) => b.numericalRating - a.numericalRating);
    
    // console.log('All user information:', userInfoArray); // Log the global array after fetching all users
}

await fetchAllUsersInfo(usernames);

contests = await fetchContests();

cron.schedule('0 * * * *', async () => {
    console.log('Fetching contests...');
    try {
        const contests = await fetchContests();
        console.log('Upcoming Contests:', contests.upcoming);
        console.log('Recent Contests:', contests.recent);
    } catch (error) {
        console.error('Error fetching contests:', error);
    }
});

// Schedule the cron job to run every 2 hours
cron.schedule('0 */2 * * *', () => {
    console.log('Running cron job to fetch AtCoder user info');

    // empty the global array before fetching new user info
    userInfoArray.length = 0;

    fetchAllUsersInfo(usernames);
});

async function fetchRankings(contestId) {
    try {
        const response = await axios.get(`https://atcoder.jp/contests/${contestId}/standings/json`, {
            headers: {
                'Cookie': `REVEL_SESSION=${sessionCookie}`,
            },
        });
        const standings = response.data.StandingsData;

        var users = [];
        usernames.forEach(username => {
            const userRanking = standings.find(user => user.UserScreenName === username);
            if (userRanking) {
                var time = formatElapsedTime(userRanking.TotalResult.Elapsed / 1e9);
                userRanking.FormattedTime = time;
                users.push(userRanking);

            } else {
                console.log(`${username}: Not Found`);
            }
        });

        // Sort users based on ranking
        users.sort((a, b) => a.Rank - b.Rank);

        return users;

    } catch (error) {
        if (error.response.status === 403) {
            return { error: 'Invalid session cookie' };
        }
        if (error.response.status === 404) {
            return { error: 'Invalid contest ID' };
        }
        return { error: 'An unexpected error occurred' };
    }
}

function formatElapsedTime(elapsedTimeInSeconds) {
    // Calculate minutes and remaining seconds
    const minutes = Math.floor(elapsedTimeInSeconds / 60);
    const remainingSeconds = Math.floor(elapsedTimeInSeconds % 60);

    // Format minutes and seconds with leading zeros if needed
    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(remainingSeconds).padStart(2, '0');

    return `${formattedMinutes}:${formattedSeconds}`;
}


async function fetchContestsCodeChef() {
    try {
        const url = 'https://www.codechef.com/api/list/contests/all?sort_by=START&sorting_order=asc&offset=0&mode=all';
        const response = await axios.get(url);
        const contests = response.data;

        const upcomingContests = [];
        const pastContests = [];

        contests.future_contests.forEach(contest => {
            upcomingContests.push({
                name: contest.contest_name,
                code: contest.contest_code,
                startDate: contest.contest_start_date_iso,
                endDate: contest.contest_end_date_iso,
                distinct_users : contest.distinct_users,
            });
        });

        contests.past_contests.forEach(contest => {
            // console.log(contest);
            pastContests.push({
                name: contest.contest_name,
                code: contest.contest_code,
                startDate: contest.contest_start_date_iso,
                endDate: contest.contest_end_date_iso,
                distinct_users : contest.distinct_users,
            });
        });

        console.log('Upcoming Contests:', upcomingContests);
        // console.log('Past Contests:', pastContests);

    } catch (error) {
        console.error('Error fetching contests:', error);
    }
}

fetchContestsCodeChef();

async function getData() {
    const browser = await puppeteer.launch({
        args: [
          "--disable-setuid-sandbox",
          "--no-sandbox",
          "--single-process",
          "--no-zygote",
        ],
        executablePath:
          process.env.NODE_ENV === "production"
            ? process.env.PUPPETEER_EXECUTABLE_PATH
            : puppeteer.executablePath(),
      });
    const page = await browser.newPage();

    // Go to the page
    await page.goto('https://www.codechef.com/rankings/START145C?itemsPerPage=100&order=asc&page=1&search=bit_spark&sortBy=rank',  { waitUntil: 'networkidle2' });
    
    
  const data = await page.evaluate(() => {
    // Select all rows with the specified class
    const rows = document.querySelectorAll('#MUIDataTableBodyRow-0');
    return Array.from(rows).map(row => {
        // Extract all text content from the row
        return {
            textContent: row.innerText.trim(), // You can modify this to extract specific cell data if needed
        };
    });
});

console.log(data);

    await browser.close();
}

getData();
app.get('/', (req, res) => {
    const error = req.query.error || null;

    console.log("Pinged");
    res.render('index.ejs', { error });
});

app.post('/contests', async (req, res) => {
    var id = req.body.contestNumber;
    var contestType = req.body.contestType;

    var contestId = contestType + id;
    console.log(contestId);

    var result = await fetchRankings(contestId);

    // check error message


    if (result.error) {
       res.redirect(`/`);
    } else {
        res.render('contest.ejs', { standings: result });
    }
});


app.get('/contest_recent', async (req, res) => {

    res.render('contests_recent.ejs', { contests: contests });
});


app.get('/ranking', async (req, res) => {
    res.render('users.ejs', { users: userInfoArray });
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});

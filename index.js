import axios from 'axios';
import dotenv from 'dotenv';
import express from 'express';
import bodyParser from 'body-parser';

dotenv.config();

const app = express();
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.set('view engine', 'ejs');

const usernames = ['CodeShark', 'krishankant05', 'Deepanshu_Sharma', 'Za_Robot10', 'ananyak84', 'kalpitdon', 'varun94'];
const sessionCookie = process.env.SESSION_COOKIE;

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

app.get('/', (req, res) => {
    const error = req.query.error || null;
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

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});

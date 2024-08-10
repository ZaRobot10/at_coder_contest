import axios from 'axios';
import env from 'dotenv';
import express from 'express';

env.config();

const app = express();
const contestId = 'abc366'; // Replace with your contest ID
const usernames = ['CodeShark', 'krishankant05', 'Deepanshu_Sharma', 'Za_Robot10', 'ananyak84'];
const sessionCookie = process.env.SESSION_COOKIE;

async function fetchRankings() {
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
                users.push(userRanking);

            } else {
                console.log(`${username}: Not Found`);
            }
        });

        // sort users based on ranking
        users.sort((a, b) => a.Rank - b.Rank);

        console.log('Rank\tUser\t\t\tScore');
        users.forEach(user => {
            console.log(`${user.Rank}\t${user.UserScreenName}\t\t${user.TotalResult.Score}`);
        });



    } catch (error) {
        
        // if status code is 403, then the session cookie is invalid
        // if status code is 404, then the contest ID is invalid

       if (error.response.status === 403) {
            console.log('Invalid session cookie');
        }

        if (error.response.status === 404) {
            console.log('Invalid contest ID');
        }

        

    }
}



console.log('Server is running on port 3000');

app.get('/', (req, res) => {
    
    fetchRankings();
    res.send('Fetching rankings');
})


app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
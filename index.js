const cheerio     = require('cheerio'),
      request     = require('request'),
      http        = require('https'),
      fs          = require('fs'),
      express     = require('express'),
      MongoClient = require('mongodb').MongoClient,
      assert      = require('assert'),
      url         = require('url');

// To-do:
// # Learn
// - How to use MongoDB properly
// - How to use callbacks (because the request is async and the db save op is attempted before it's finished)
//
// # Scraping
// - Automatically scrape all lotto archive data on startup (NOT DONE)
// - Only scrape and save if the database is empty (NOT DONE)
// - Once scraped only update what isn't already in the db (NOT DONE)
//
// # Endpoints
// - Add endpoint taking in 7 numbers and work out how many times each number has come up (NOT DONE)
//     - Calculate how much winnings that would earn
// - Add endpoints to get data by week/month/year (NOT DONE)
//
// # Client-side (this will likely be a separate application, keeping this purely an API)
// - Using the API, enter your usual numbers and when you started doing the lottery (NOT DONE)
//     - Display overall stats (e.g. net loss/gain, how many times each number came up, etc)
//     - Generate a unique link on the results so they can be shared using only the URL


// GLOBAL VARIABLES
const app = express();
const serverPort = 3000;
const mongoUrl = 'mongodb://localhost:27017/uk-lotto-api';
const lottoDataCollection = "lottoData";


// Start the express server, and do some startup things
app.listen(serverPort, function() {
	console.log(`Server started on port ${serverPort}`);

	// Connect to the database
	MongoClient.connect(mongoUrl, function(err, db) {
		assert.equal(null, err);
		console.log(`Successfully connected to database at: ${mongoUrl}`);

		// Get lotto results and store them in the db so they can be queried later
		// TODO: Change to go through the www.lottery.co.uk archive and get all results on startup
		const results = scrapeLottoResultsByDate('17-12-2016');

		// // Save the results to the database
		if (!results) {
			console.log("No results available to save to the database");
			return;
		} else {
			saveResultsToDb(db, results);
		}
	});
});

//// API ENDPOINTS
//app.get("/:date", function(request, response) {
//	var date = request.params.date;
//	var results = getResultsByDate(date);
//	
//	console.log(results);
//	
//	response.send(results);
//});
//
//
//function getResultsByDate(date) {
//	console.log("Requesting data from database: " + date);
//	
//	var result = "test-data";
//	return result;
//}

/**
* Get results of a specific date for the lotto and store them in the database
*
* @param date - The date to lookup the lottery results of (e.g. 31-12-2016)
*/
function scrapeLottoResultsByDate(date) {
    const reqUrl = `https://www.lottery.co.uk/lotto/results-${date}`;

	console.log(`Making GET request to ${reqUrl} to scrape data`);

	//TODO: How do we make the result of this request be required to continue?
	// Make GET request
    request(reqUrl, function(error, response, body) {
		assert.equal(null, error);

		let balls;

		if (response && response.statusCode === 200) {
			// Logic to scrape and save lotto ball data
			balls = {
				1: getValueForBall(1, body),
				2: getValueForBall(2, body),
				3: getValueForBall(3, body),
				4: getValueForBall(4, body),
				5: getValueForBall(5, body),
				6: getValueForBall(6, body),
				bonus: getValueForBall(7, body)
			};

			return balls;
		} else {
			console.log(`ERROR: Unsuccessful response from ${reqUrl}, no data to scrape`);
		}

		return balls;
	});
}

/**
 * Save scrape results to the database
 * 
 * @param {*} db The database connection
 * @param {*} data The data to save
 */
function saveResultsToDb(db, data) {
	console.log(`Attempting to save some data to the database: ${data}`);
	const collection = db.collection(lottoDataCollection);

	collection.insertMany(data, function(err, result) {
		assert.equal(err, null);
		assert.equal(data.length, result.result.n);
		assert.equal(data.length, result.ops.length);
		console.log(`Inserted #{data.length} documents into the ${lottoDataCollection} collection`);
	});
}

/**
 * Given the ball number and some html, get the value for the ball and return is as the raw number value
 *
 * @param {Number} ballNum The number of the drawn ball. 1 is the first (and so on) and 7 is the bonus.
 * @param {String} body The html to extract the values from
 */
function getValueForBall(ballNum, body) {
	if (ballNum < 1 || ballNum > 7) {
		console.log("Error: Invalid ball, please choose one between 1 and 7");
		return null;
	}
	
	const $ = cheerio.load(body);
    return $(`span.result:nth-child(${ballNum})`).text();
}
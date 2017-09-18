/*
User must provide Github's personal access token when requesting to /githubPayload
*/

'use strict'

const https = require('https'),
	app = require('express')(),
	request = require('request-promise'),
	port = 8080,
	baseUrl = 'https://api.github.com';

app.get('/', (req, res) => {
	res.send('To view your GitHub detail, go to: /githubPayload/YOUR_GITHUB_TOKEN');
});

app.get('/githubPayload', (req, res) => {
	res.send('Please input your auth token.');
});

app.get('/githubPayload/:token', (req, res) => {
	const token = req.params.token;
	var userInfo, userRepos, commitCounts, owner;
	
	return getUser(token)
		.then(result => {
			userInfo = result;
			owner = result.githubHandle;
			return getRepos(token, owner);
		})
		.then(result => {
			userRepos = result;
			return getCommitCounts(token, userRepos, owner);
		})
		.then(result => {
			commitCounts = result;
			return getPullReqCounts(token, userRepos, owner);
		})
		.then(pullReqCounts => {
			res.json(createPayload(userInfo, commitCounts, pullReqCounts));
		})
		.catch((err) => {
			res.send('ERROR in authentication.');
		});
});

//Access Github API using user's token
function createRequest(url, token) {
	return {
		method: 'GET',
		url: `${baseUrl}${url}?token=${token}`,
		headers: {
			
			'Authorization': `bearer ${token}`,
			'Content-type': 'application/json',
			'User-Agent': 'github-rest-api-custom-user-info',
			'Accept': 'application/vnd.github.full+json'
		}
	}
}

//Get user's basic information
var getUser = (token) => {
	return request(createRequest('/user', token))
		.then((body) => {
			body = JSON.parse(body);

			var result = {
				githubHandle: body.login,
				githubURL: body.html_url,
				avatarURL: body.avatar_url,
				email: body.email || 'Not specified',
				followerCount: body.followers,
			};
			return result;
		})
		.catch((err) => {
			console.log("Err", err);
			return;
		});
}

//Get a list of user's repositories
var getRepos = (token, owner) => {
	return request(createRequest(`/users/${owner}/repos`, token))
		.then((body) => {
			return JSON.parse(body).map((repo) => repo.name);
		})
		.catch((err) => {
			console.log("Err", err);
			return;
		});
}

//Get commit counts for each of user's repositories
var getCommitCounts = (token, repos, owner) => {
	var commitCounts = {};
	var repoPromises = repos.map((repo) => 
		request(createRequest(`/repos/${owner}/${repo}/stats/contributors`, token))
			.then((body) => 
				commitCounts[repo] = {
					name: repo,
					url: `${JSON.parse(body)[0].author.html_url}/${repo}`,
					commitCount: JSON.parse(body)[0].total
				})
			.catch((err) => console.log('Error in getting commit counts', err))
	);
	return Promise.all(repoPromises)
		.then((results) => {
			return commitCounts;
		})
		.catch((err) => {
			console.log("Err", err);
			return;
		});	
}

//Get pull request (state: open) counts for each of user's repositories
var getPullReqCounts = (token, repos, owner) => {
	var pullReqCounts = {};
	var repoPromises = repos.map((repo) => 
		request(createRequest(`/search/issues?q=+type:pr+repo:${owner}/${repo}+is=open`, token))
			.then((body) => pullReqCounts[repo] = {pullRequestCount: JSON.parse(body).total_count})
			.catch((err) => console.log('Error in getting open pull request counts', err))
	);
	return Promise.all(repoPromises)
		.then((results) => {
			return pullReqCounts;
		})
		.catch((err) => {
			console.log("Err", err);
			return;
		});	
}

var createPayload = (userInfo, commitHash, pullHash) => {
	var payload = {};
	payload.user = userInfo;
	payload.user.repositories = [];
	for (let repo in commitHash) {
		commitHash[repo].pullRequestCount = pullHash[repo].pullRequestCount;
		payload.user.repositories.push(commitHash[repo]);
	}
	return payload;
}

var server = app.listen(port, function() {
  console.log('Listening to port %d', server.address().port);
});

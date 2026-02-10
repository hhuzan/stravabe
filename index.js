import express from "express";
import "dotenv/config";
import cors from "cors"; // Sacar
import {
	dbUpdateAuthorization,
	dbReadAccessToken,
	dbReadAthletes,
	dbReadRefreshToken,
	dbSaveActivity,
	dbSaveAthlete,
	dbSaveAuthorization,
	dbDeleteActivity,
	dbDeleteActivities,
} from "./db.js";
import path from "path";
import { fileURLToPath } from "url";
import { fbSave, fbSaveXXXX, fbSavePolyline } from "./firebase.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

app.use(cors()); // Sacar
app.use(express.json());
app.use(express.static(path.join(__dirname, "front")));

const saveActivities = async (activities) => {
	await activities.forEach(async (activity) => {
		await dbSaveActivity(activity);
		await fbSavePolyline(activity);
	});
};

const resetAthlete = async (accessToken) => {
	const athlete = await getAthlete(accessToken);
	const stats = await getAthleteStats(accessToken, athlete.id);
	await dbSaveAthlete(athlete, stats);
	await dbDeleteActivities(athlete.id);
	let page = 1;
	let activities = await getActivites(accessToken, page++);
	while (activities.length > 0) {
		await saveActivities(activities);
		activities = await getActivites(accessToken, page++);
	}
};

const getAthlete = async (access_token) => {
	console.log("getAthlete START");
	const inicio = Date.now();

	const url = `https://www.strava.com/api/v3/athlete?access_token=${access_token}`;
	const athlete = await fetch(url);

	console.log("getAthlete END: ", Date.now() - inicio, "ms");
	return await athlete.json();
};

const getAthleteStats = async (access_token, id) => {
	console.log("getAthleteStats START");
	const inicio = Date.now();

	const url = `https://www.strava.com/api/v3/athletes/${id}/stats/?access_token=${access_token}`;
	const stats = await fetch(url);

	console.log("getAthleteStats END: ", Date.now() - inicio, "ms");
	return await stats.json();
};

const getActivites = async (access_token, page) => {
	// 2025
	const url = `https://www.strava.com/api/v3/athlete/activities?access_token=${access_token}&after=1735700400&before=1767236399&page=${page}}`;
	// 2024
	// const url = `https://www.strava.com/api/v3/athlete/activities?access_token=${access_token}&after=1704078000&before=1735700399&page=${page}}`;
	const activities = await fetch(url);
	return await activities.json();
};

const processActivity = async (athleteID, activityID) => {
	console.log("processActivity START");
	const inicio = Date.now();

	const accessToken = await getAccessToken(athleteID);
	const activityURL = `https://www.strava.com/api/v3/activities/${activityID}?access_token=${accessToken}`;
	const res = await Promise.all([fetch(activityURL), getAthlete(accessToken), getAthleteStats(accessToken, athleteID)]);
	if (res[0].ok) {
		const activity = await res[0].json();
		if (activity.start_date_local.substring(0, 4) === "2025") {
			await Promise.all([dbSaveActivity(activity), dbSaveAthlete(res[1], res[2])]);
			await fbSaveXXXX(activity);
		}
	} else {
		await Promise.all([dbDeleteActivity(activityID), dbSaveAthlete(res[1], res[2])]);
		await fbSave(athleteID);
		//TODO borrar polyline
	}

	console.log("processActivity END: ", Date.now() - inicio, "ms");
};

const deleteActivity = async (athleteID, activityID) => {
	console.log("deleteActivity START");
	const inicio = Date.now();

	const accessToken = await getAccessToken(athleteID);
	const res = await Promise.all([getAthlete(accessToken), getAthleteStats(accessToken, athleteID)]);
	await Promise.all([dbDeleteActivity(activityID), dbSaveAthlete(res[0], res[1])]);
	await fbSave(athleteID);
	//TODO borrar polyline

	console.log("deleteActivity END: ", Date.now() - inicio, "ms");
};

const authorize = async (code) => {
	console.log("authorize START");
	const inicio = Date.now();

	const auth_link = "https://www.strava.com/oauth/token";
	const authorization = await fetch(auth_link, {
		method: "post",
		headers: {
			Accept: "application/json, text/plain, */*",
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			client_id: process.env.STRAVA_CLIENTID,
			client_secret: process.env.STRAVA_CLIENTSECRET,
			code: code,
			grant_type: "authorization_code",
		}),
	});

	console.log("authorize END: ", Date.now() - inicio, "ms");
	return authorization.json();
};

const reAuthorize = async (athleteID) => {
	console.log("reAuthorize START");
	const inicio = Date.now();

	const authorizationURL = "https://www.strava.com/oauth/token";
	const refreshToken = await dbReadRefreshToken(athleteID);
	const res = await fetch(authorizationURL, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams({
			client_id: process.env.STRAVA_CLIENTID,
			client_secret: process.env.STRAVA_CLIENTSECRET,
			refresh_token: refreshToken,
			grant_type: "refresh_token",
		}),
	});

	if (!res.ok) {
		throw new Error("Fetch response in reAuthorize not OK.");
	}
	const authorization = await res.json();
	await dbUpdateAuthorization(athleteID, authorization);

	console.log("reAuthorize END: ", Date.now() - inicio, "ms");
	return authorization.access_token;
};

const getAccessToken = async (athleteID) => {
	console.log("getAccesToken START");
	const inicio = Date.now();

	const row = await dbReadAccessToken(athleteID);

	console.log("getAccessToken END: ", Date.now() - inicio, "ms");

	if (row.expiresat * 1000 > Date.now() + 600000) {
		return row.accesstoken;
	}

	return reAuthorize(athleteID);
};

//////////////////////////////
//          ROUTER          //
//////////////////////////////

app.post("/webhook", async (req, res, next) => {
	console.log("webhook START");
	const inicio = Date.now();
	console.log(req.body);

	try {
		const object_type = req.body.object_type;
		const aspect_type = req.body.aspect_type;
		const owner_id = req.body.owner_id;
		const object_id = req.body.object_id;
		if (object_type === "activity") {
			if (object_id > 13238000000) {
				if (aspect_type === "create" || aspect_type === "update") {
					await processActivity(owner_id, object_id);
				} else if (aspect_type === "delete") {
					await deleteActivity(owner_id, object_id);
				}
			} else {
				console.log("Old activity ( < 31/12/2025 ???)");
			}
		}
		console.log("webhook END: ", Date.now() - inicio, "ms");
		res.end();
	} catch (err) {
		console.log("webhook ERROR: ", Date.now() - inicio, "ms");
		next(err);
	}
});

// for app registering
app.get("/webhook", (req, res, next) => {
	console.log(req);
	try {
		if (req.query["hub.mode"] && req.query["hub.verify_token"]) {
			if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === "brzn") {
				res.json({ "hub.challenge": req.query["hub.challenge"] });
			} else {
				res.sendStatus(403);
			}
		}
	} catch (err) {
		next(err);
	}
});

// for user registration
app.get("/exchange_token", async (req, res, next) => {
	try {
		const authorization = await authorize(req.query.code);
		dbSaveAuthorization(authorization);
		await resetAthlete(authorization.access_token);
		res.redirect("/");
	} catch (err) {
		next(err);
	}
});

// for admin only
app.get("/athletes", async (req, res, next) => {
	try {
		const data = await dbReadAthletes();
		res.json(data);
	} catch (err) {
		next(err);
	}
});

// for admin only
app.get("/reset/:id", async (req, res, next) => {
	try {
		console.log("get reset: ", req.params.id);
		const accessToken = await getAccessToken(req.params.id);
		await resetAthlete(accessToken);
		res.redirect("/admin");
	} catch (err) {
		next(err);
	}
});

// for admin only
// TODO: use local time zone
app.get("/save/:id", async (req, res, next) => {
	try {
		await fbSave(req.params.id);
		res.send("ok");
	} catch (err) {
		next(err);
	}
});

// for testing
app.get("/ranking", async (req, res, next) => {
	try {
		const data = await dbReadRanking();
		res.json(data);
	} catch (err) {
		next(err);
	}
});

app.listen(80, () => console.log("BRZN Server is listening on port 80"));

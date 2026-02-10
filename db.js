import pg from "pg";
import { decode } from "./utils.js";

const { Pool } = pg;

const pool = new Pool({
	user: process.env.POSTGRES_USER,
	host: process.env.POSTGRES_HOST,
	database: process.env.POSTGRES_DATABASE,
	password: process.env.POSTGRES_PASSWORD,
	ssl: {
		rejectUnauthorized: false,
	},
});

export const dbDeleteActivities = async (athleteid) => {
	console.log("dbDeleteActivities START");
	const inicio = Date.now();

	await pool.query(`UPDATE activities SET deleted = TRUE WHERE athleteid = $1`, [athleteid]);

	console.log("dbDeleteActivities END: " + (Date.now() - inicio) + "ms");
};

export const dbDeleteActivity = async (activityid) => {
	console.log("dbDeleteActivity START");
	const inicio = Date.now();

	await pool.query(`UPDATE activities SET deleted = TRUE WHERE activityid = $1`, [activityid]);

	console.log("dbDeleteActivity END: " + (Date.now() - inicio) + "ms");
};

export const dbSaveActivity = async (act) => {
	console.log("dbSaveActivity START");
	const inicio = Date.now();

	console.log(act.athlete.id, act.name, act.start_date, act.distance);

	const dec = decode(act.map.summary_polyline);

	await pool.query(
		`INSERT INTO activities (activityid, athleteid, distance, mtime, etime, sporttype, name, date, manual, flagged,
		minlat, maxlat, minlng, maxlng, deleted)  
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, FALSE)
		ON CONFLICT (activityid) DO UPDATE 
        SET distance = $3,
            mtime = $4,
            etime = $5,
            sporttype = $6,
            name = $7,
            date = $8, 
			manual = $9,
			flagged = $10,
			minlat = $11,
			maxlat = $12,
			minlng = $13,
			maxlng = $14,
			deleted = FALSE`,
		[
			act.id,
			act.athlete.id,
			act.distance,
			act.moving_time,
			act.elapsed_time,
			act.sport_type,
			act.name,
			act.start_date,
			act.manual,
			act.flagged,
			dec.minlat,
			dec.maxlat,
			dec.minlng,
			dec.maxlng,
		],
	);

	console.log("dbSaveActivity END: " + (Date.now() - inicio) + "ms");
};

export const dbSaveAthlete = async (athlete, stats) => {
	console.log("dbSaveAthlete START");
	const inicio = Date.now();

	await pool.query(
		`INSERT INTO athletes (athleteid, firstname, lastname, profile, enabled, anual_strava)  
             VALUES ($1, $2, $3, $4, true, $5)
             ON CONFLICT (athleteid) DO UPDATE
             SET firstname = $2, lastname = $3, profile = $4, anual_strava = $5 `,
		[athlete.id, athlete.firstname, athlete.lastname, athlete.profile, stats.ytd_ride_totals.distance],
	);

	console.log("dbSaveAthlete END: " + (Date.now() - inicio) + "ms");
};

export const dbReadRefreshToken = async (athleteID) => {
	console.log("dbReadRefreshToken START");
	const inicio = Date.now();

	const res = await pool.query(
		`SELECT refreshtoken
        FROM refreshtokens
        WHERE athleteid = ${athleteID}`,
	);

	console.log("dbReadRefrehsToken END: " + (Date.now() - inicio) + "ms");
	return res.rows[0].refreshtoken;
};

export const dbSaveAuthorization = async (aut) => {
	console.log("dbSaveAuthorization START");
	const inicio = Date.now();

	await pool.query(
		`INSERT INTO refreshtokens (athleteid, refreshtoken)  
             VALUES ($1, $2) ON CONFLICT (athleteid) DO UPDATE 
             SET refreshtoken = $2 `,
		[aut.athlete.id, aut.refresh_token],
	);
	await pool.query(
		`INSERT INTO accesstokens (athleteid, accesstoken, expiresat)  
             VALUES ($1, $2, $3) ON CONFLICT (athleteid) DO UPDATE 
             SET accesstoken = $2, expiresat = $3 `,
		[aut.athlete.id, aut.access_token, aut.expires_at],
	);

	console.log("dbSaveAuthorization END: " + (Date.now() - inicio) + "ms");
};

export const dbUpdateAuthorization = async (athleteid, aut) => {
	console.log("dbUpdateAuthorization START");
	const inicio = Date.now();

	await pool.query(
		`UPDATE refreshtokens SET refreshtoken = $2  
                WHERE athleteid = $1`,
		[athleteid, aut.refresh_token],
	);
	await pool.query(
		`UPDATE accesstokens SET accesstoken = $2 , expiresat = $3 
                WHERE athleteid = $1`,
		[athleteid, aut.access_token, aut.expires_at],
	);

	console.log("dbUpdateAuthorization END: " + (Date.now() - inicio) + "ms");
};

export const dbReadActivities = async (athleteid) => {
	console.log("dbReadActivities START");
	const inicio = Date.now();

	const res = await pool.query(
		`SELECT activityid, date, name, activities.distance::integer, manual, brzn, flagged
        FROM athletes, activities
        WHERE athletes.athleteid = activities.athleteid
        AND athletes.athleteid = $1
        AND (
            sporttype = 'Ride'
            OR sporttype = 'GravelRide'
            OR sporttype = 'MountainBikeRide'
        )
		AND deleted = FALSE
        ORDER BY date DESC `,
		[athleteid],
	);

	console.log("dbReadActivities END: " + (Date.now() - inicio) + "ms");
	return res.rows;
};

export const dbReadNovedades = async () => {
	console.log("dbReadNovedades START");
	const inicio = Date.now();

	const res = await pool.query(
		`SELECT activityid, profile, firstname, lastname, activities.name, date, activities.distance::integer,
			manual, brzn, flagged
            FROM activities, athletes
            WHERE activities.athleteid = athletes.athleteid
			AND enabled IS TRUE
            AND (
                sporttype = 'Ride'
                OR sporttype = 'GravelRide'
                OR sporttype = 'MountainBikeRide'
            )
			AND deleted = FALSE
            ORDER BY date DESC
            LIMIT 50 `,
	);

	console.log("dbReadNovedades END: " + (Date.now() - inicio) + "ms");
	return res.rows;
};

export const dbReadAthletes = async () => {
	console.log("dbReadAthletes START");
	const inicio = Date.now();

	const res = await pool.query(
		`SELECT profile, firstname, lastname, athleteid
        FROM athletes
        ORDER BY firstname, lastname `,
	);

	console.log("dbReadAthletes END: " + (Date.now() - inicio) + "ms");
	return res.rows;
};

// Versión Simple
export const dbReadRanking = async () => {
	console.log("dbReadRanking START");
	const inicio = Date.now();

	const res = await pool.query(`
		SELECT at.firstname , at.lastname , SUM(ac.distance ) AS distance
		FROM athletes at 
		JOIN activities ac ON at.athleteid = ac.athleteid
		GROUP BY at.firstname , at.lastname
		ORDER BY distance DESC
		`);

	console.log("dbReadRanking END: " + (Date.now() - inicio) + "ms");
	return res.rows;
};

// Versión BR 2025
export const _dbReadRanking = async () => {
	console.log("dbReadRanking START");
	const inicio = Date.now();

	const res = await pool.query(`
		WITH filtered_activities AS (
			SELECT
				athleteid,
				distance,
				date,
				brzn
			FROM activities
			WHERE sporttype IN ('Ride', 'GravelRide', 'MountainBikeRide')
			  AND manual = FALSE
			  AND deleted = FALSE
		),
		activity_counts AS (
			SELECT
				athleteid,
				COUNT(*) FILTER (
					WHERE brzn = TRUE AND date < DATE '2025-05-01'
				) AS q1,
				COUNT(*) FILTER (
					WHERE brzn = TRUE AND date >= DATE '2025-05-01' AND date < DATE '2025-09-01'
				) AS q2,
				COUNT(*) FILTER (
					WHERE brzn = TRUE AND date >= DATE '2025-09-01'
				) AS q3,
				COALESCE(SUM(distance) FILTER (WHERE date < DATE '2025-09-01'), 0)::integer AS early_distance,
				COALESCE(SUM(distance) FILTER (WHERE date >= DATE '2025-09-01'), 0)::integer AS late_distance
			FROM filtered_activities
			GROUP BY athleteid
		),
		final_result AS (
			SELECT
				a.athleteid,
				a.firstname,
				a.lastname,
				a.profile,
				COALESCE(
					CASE
						WHEN ( COALESCE(ac.q1, 0) >= 2 AND COALESCE(ac.q2, 0) >= 2 ) OR COALESCE(ac.q2, 0) >= 4 THEN ac.early_distance + ac.late_distance
						ELSE ac.late_distance
					END, 0
				) AS distance,
				COALESCE(ac.q1, 0) AS q1,
				COALESCE(ac.q2, 0) AS q2,
				COALESCE(ac.q3, 0) AS q3
			FROM athletes a
			LEFT JOIN activity_counts ac ON a.athleteid = ac.athleteid
			WHERE a.enabled IS TRUE
		)
		SELECT *
		FROM final_result
		ORDER BY
			(distance > 0) DESC,
			distance DESC,
			firstname,
			lastname;
		`);

	console.log("dbReadRanking END: " + (Date.now() - inicio) + "ms");
	return res.rows;
};

export const dbReadMonthlyRanking = async () => {
	console.log("dbReadMonthlyRanking START");
	const inicio = Date.now();

	const res = await pool.query(
		`SELECT athletes.athleteid, firstname, lastname, profile,
    			COALESCE(SUM(activities.distance), 0)::integer AS distance
		FROM athletes
		LEFT JOIN activities
       		ON athletes.athleteid = activities.athleteid
       		AND sporttype IN ('Ride', 'GravelRide', 'MountainBikeRide')
       		AND EXTRACT(MONTH FROM date) = EXTRACT(MONTH FROM NOW())
			AND manual = FALSE
			AND deleted = FALSE
		WHERE enabled IS TRUE
		GROUP BY athletes.athleteid, firstname, lastname, profile
		ORDER BY distance DESC, firstname, lastname; `,
	);

	console.log("dbReadMonthlyRanking END: " + (Date.now() - inicio) + "ms");
	return res.rows;
};

export const dbReadMonthlyTops = async () => {
	console.log("dbReadMonthlyTops START");
	const inicio = Date.now();

	const res = await pool.query(`
		WITH mensual AS (
    		SELECT athletes.athleteid, 
		        SUM(activities.distance) AS total_distance, 
        		EXTRACT(MONTH FROM date)::integer AS mes
    		FROM activities
    		JOIN athletes ON activities.athleteid = athletes.athleteid
    		WHERE enabled = TRUE
      		AND sporttype IN ('Ride', 'GravelRide', 'MountainBikeRide')
			AND manual = FALSE
			AND deleted = FALSE
    		GROUP BY athletes.athleteid, mes
		),
		max_mensual AS (
    		SELECT mes, 
		        MAX(total_distance) AS max_dist
    		FROM mensual
    		GROUP BY mes
		)
		SELECT athleteid, mensual.mes
		FROM mensual
		JOIN max_mensual
    	ON mensual.mes = max_mensual.mes AND mensual.total_distance =  max_mensual.max_dist
		ORDER BY  mensual.mes, athleteid;
		 `);

	console.log("dbReadMonthlyTops END: " + (Date.now() - inicio) + "ms");
	return res.rows;
};

export const dbReadAccessToken = async (athleteID) => {
	console.log("dbReadAccessToken START");
	const inicio = Date.now();

	const res = await pool.query(
		`SELECT accesstoken, expiresat
            FROM accesstokens
            WHERE athleteid = ${athleteID}`,
	);

	console.log("dbReadAccessToken END: " + (Date.now() - inicio) + "ms");
	return res.rows[0];
};

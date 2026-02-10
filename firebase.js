import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { dbReadActivities, dbReadNovedades, dbReadRanking, dbReadMonthlyRanking, dbReadMonthlyTops } from "./db.js";

const anio = "25";

const firebaseConfig = {
	apiKey: process.env.FIREBASE_APIKEY,
	authDomain: process.env.FIREBASE_AUTHDOMAIN,
	projectId: process.env.FIREBASE_PROJECTID,
	storageBucket: process.env.FIREBASE_STORAGEBUCKET,
	messagingSenderId: process.env.FIREBASE_MESSAGINGSENDERID,
	appId: process.env.FIREBASE_APPID,
};

const app = initializeApp(firebaseConfig);

const firestore = getFirestore(app);

const fbSaveRanking = async () => {
	console.log("fbSaveRanking START");
	const inicio = Date.now();

	const data = await dbReadRanking();
	const ranking = { ranking: data };
	await setDoc(doc(firestore, "brzn" + anio, "ranking"), ranking);

	console.log("fbSaveRanking END: " + (Date.now() - inicio) + "ms");
};

const fbSaveMonthly = async () => {
	console.log("fbSaveMonthly START");
	const inicio = Date.now();

	const [ranking, tops] = await Promise.all([dbReadMonthlyRanking(), dbReadMonthlyTops()]);
	const monthly = { ranking: ranking, tops: tops };
	await setDoc(doc(firestore, "brzn" + anio, "monthly"), monthly);

	console.log("fbSaveMonthly END: " + (Date.now() - inicio) + "ms");
};

const fbSaveNovedades = async () => {
	console.log("fbSaveNovedades START");
	const inicio = Date.now();

	const data = await dbReadNovedades();
	const novedades = { novedades: data };
	await setDoc(doc(firestore, "brzn" + anio, "novedades"), novedades);

	console.log("fbSaveNovedades END: " + (Date.now() - inicio) + "ms");
};

const fbSaveActivities = async (athleteid) => {
	console.log("fbSaveActivities START");
	const inicio = Date.now();

	const data = await dbReadActivities(athleteid);
	const activities = { activities: data };
	await setDoc(doc(firestore, "activities" + anio, athleteid.toString()), activities);

	console.log("fbSaveActivities END: " + (Date.now() - inicio) + "ms");
};

export const fbSavePolyline = async (activity) => {
	console.log("fbSavePolyline START");
	const inicio = Date.now();

	const polyline = {
		athleteid: activity.athlete.id,
		type: activity.type,
		name: activity.name,
		polyline: activity.map.summary_polyline,
	};
	await setDoc(doc(firestore, "polylines" + anio, activity.id.toString()), polyline);

	console.log("fbSavePolyline END: " + (Date.now() - inicio) + "ms");
};

export const fbSave = async (athleteid) => {
	console.log("fbSave START");
	const inicio = Date.now();

	await Promise.all([fbSaveRanking(), fbSaveMonthly(), fbSaveNovedades(), fbSaveActivities(athleteid)]);

	console.log("fbSave END: " + (Date.now() - inicio) + "ms");
};

export const fbSaveXXXX = async (activity) => {
	console.log("fbSaveXXXX START");
	const inicio = Date.now();

	await Promise.all([
		fbSaveRanking(),
		fbSaveMonthly(),
		fbSaveNovedades(),
		fbSaveActivities(activity.athlete.id),
		fbSavePolyline(activity),
	]);

	console.log("fbSaveXXXX END: " + (Date.now() - inicio) + "ms");
};

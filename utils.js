export const decode = (encodedString) => {
	var index = 0,
		lat = 0,
		lng = 0,
		shift = 0,
		result = 0,
		byte = null,
		latitude_change,
		longitude_change;
	var dec = {
		minlat: 10000000,
		maxlat: -10000000,
		minlng: 20000000,
		maxlng: -20000000,
	};

	while (index < encodedString.length) {
		byte = null;
		shift = 1;
		result = 0;

		do {
			byte = encodedString.charCodeAt(index++) - 63;
			result += (byte & 0x1f) * shift;
			shift *= 32;
		} while (byte >= 0x20);

		latitude_change = result & 1 ? (-result - 1) / 2 : result / 2;
		shift = 1;
		result = 0;

		do {
			byte = encodedString.charCodeAt(index++) - 63;
			result += (byte & 0x1f) * shift;
			shift *= 32;
		} while (byte >= 0x20);

		longitude_change = result & 1 ? (-result - 1) / 2 : result / 2;
		lat += latitude_change;
		lng += longitude_change;

		if (lat < dec.minlat) {
			dec.minlat = lat;
		}
		if (lat > dec.maxlat) {
			dec.maxlat = lat;
		}
		if (lng < dec.minlng) {
			dec.minlng = lng;
		}
		if (lng > dec.maxlng) {
			dec.maxlng = lng;
		}
	}
	if (dec.minlat === 10000000 || dec.maxlat === -10000000 || dec.minlng === 20000000 || dec.maxlng === -20000000) {
		dec = {
			minlat: 0,
			maxlat: 0,
			minlng: 0,
			maxlng: 0,
		};
	}
	return dec;
};

export const SECOND = 1000;
export const MINUTE = 60*SECOND;
export const HOUR = 60*MINUTE;
export const DAY = 24*HOUR;

export const now = () => (new Date()).toISOString()

/// checks if ISOString is older than the given milliseconds
export const isOlderThan = (timestamp, age_milliseconds) => {
	return age(timestamp) > age_milliseconds;
}

export const msUntilAge = (timestamp, age_milliseconds) => {
	const diff = age_milliseconds - age(timestamp);
	return diff > 0 ? diff : 0;
}

export const age = (timestamp) => {
	return (new Date) - (new Date(timestamp));
}

export const ageTimer = (func, timestamp, age) => {
	return setTimeout(func, msUntilAge(timestamp, age))
}

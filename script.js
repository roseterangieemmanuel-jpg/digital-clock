function formatWorldClockTime(hour, minute, dayPeriod) {
    return `${hour}:${minute} ${dayPeriod.charAt(0).toUpperCase()}${dayPeriod.charAt(1).toLowerCase()}`;
}
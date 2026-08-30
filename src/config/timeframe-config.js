const TIMEFRAMES = Object.freeze({
    "1m": {
        label: "1 Minute",
        interval: "1",
        seconds: 1 * 60,
    },

    "3m": {
        label: "3 Minutes",
        interval: "3",
        seconds: 3 * 60,
    },

    "5m": {
        label: "5 Minutes",
        interval: "5",
        seconds: 5 * 60,
    },

    "15m": {
        label: "15 Minutes",
        interval: "15",
        seconds: 15 * 60,
    },

    "30m": {
        label: "30 Minutes",
        interval: "30",
        seconds: 30 * 60,
    },

    "45m": {
        label: "45 Minutes",
        interval: "45",
        seconds: 45 * 60,
    },

    "60m": {
        label: "1 Hour",
        interval: "60",
        seconds: 60 * 60,
    },

    "120m": {
        label: "2 Hours",
        interval: "120",
        seconds: 120 * 60,
    },

    "180m": {
        label: "3 Hours",
        interval: "180",
        seconds: 180 * 60,
    },

    "240m": {
        label: "4 Hours",
        interval: "240",
        seconds: 240 * 60,
    },

    "1D": {
        label: "1 Day",
        interval: "D",
        seconds: 24 * 60 * 60,
    },

    "1W": {
        label: "1 Week",
        interval: "W",
        seconds: 7 * 24 * 60 * 60,
    },

    "1M": {
        label: "1 Month",
        interval: "M",
        seconds: 30 * 24 * 60 * 60,
    },
});


function normalizeTimeframe(value) {

    if (!value) {
        return "15m";
    }


    const normalized =
        String(value)
            .trim()
            .toLowerCase();


    const aliases = {
        "1h": "60m",
        "2h": "120m",
        "3h": "180m",
        "4h": "240m",
        "1d": "1D",
        "1w": "1W",
        "1mo": "1M",
        "1month": "1M",
    };


    const resolved =
        aliases[normalized] ||
        normalized;


    const matchingKey =
        Object.keys(TIMEFRAMES)
            .find(
                key =>
                    key.toLowerCase() ===
                    resolved.toLowerCase()
            );


    if (matchingKey) {
        return matchingKey;
    }


    throw new Error(
        `Unsupported timeframe: ${value}. ` +
        `Supported timeframes: ${Object.keys(TIMEFRAMES).join(", ")}`
    );
}


function getTimeframe(value) {

    const key =
        normalizeTimeframe(value);


    return {
        key,
        ...TIMEFRAMES[key],
    };
}


function getAllTimeframes() {

    return Object.entries(
        TIMEFRAMES
    ).map(
        ([key, config]) => ({
            key,
            ...config,
        })
    );
}


module.exports = {
    TIMEFRAMES,
    normalizeTimeframe,
    getTimeframe,
    getAllTimeframes,
};
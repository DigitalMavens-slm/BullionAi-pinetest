const IST_TIME_ZONE =
    "Asia/Kolkata";

const IST_LOCALE =
    "en-IN";


function toDate(value) {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }

    const date =
        value instanceof Date
            ? value
            : new Date(value);

    return Number.isNaN(
        date.getTime()
    )
        ? null
        : date;
}


function formatISTDateTime(
    value,
    options = {}
) {
    const date =
        toDate(value);

    if (!date) {
        return null;
    }

    return date.toLocaleString(
        IST_LOCALE,
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
            timeZone: IST_TIME_ZONE,
            ...options,
        }
    );
}


function formatISTShortDateTime(value) {
    return formatISTDateTime(
        value,
        {
            year: undefined,
            second: undefined,
        }
    );
}


function getISTDate(
    value = Date.now()
) {
    return new Date(
        new Date(value)
            .toLocaleString(
                "en-US",
                {
                    timeZone:
                        IST_TIME_ZONE,
                }
            )
    );
}


module.exports = {
    IST_TIME_ZONE,
    IST_LOCALE,
    formatISTDateTime,
    formatISTShortDateTime,
    getISTDate,
};

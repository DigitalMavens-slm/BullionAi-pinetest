export const IST_TIME_ZONE =
  "Asia/Kolkata";

export const IST_LOCALE = "en-IN";

export function formatISTDateTime(
  value: number | string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {}
) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString(IST_LOCALE, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: IST_TIME_ZONE,
    ...options,
  });
}

export function formatISTShortDateTime(
  value: number | string | Date | null | undefined
) {
  return formatISTDateTime(value, {
    year: undefined,
    second: undefined,
  });
}

export function formatISTTime(
  value: number | string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {}
) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleTimeString(IST_LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: IST_TIME_ZONE,
    ...options,
  });
}

export function getISTDate(value: number | Date = Date.now()) {
  return new Date(
    new Date(value).toLocaleString("en-US", {
      timeZone: IST_TIME_ZONE,
    })
  );
}

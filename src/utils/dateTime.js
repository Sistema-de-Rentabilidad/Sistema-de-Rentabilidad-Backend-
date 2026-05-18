const BUSINESS_TIME_ZONE = "America/Lima";

const getFechaActual = (timeZone = BUSINESS_TIME_ZONE) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
};

const toFechaString = (value, timeZone = BUSINESS_TIME_ZONE) => {
  if (typeof value === "string") {
    return value.split("T")[0];
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(value);
};

module.exports = {
  BUSINESS_TIME_ZONE,
  getFechaActual,
  toFechaString
};

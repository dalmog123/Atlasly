/**
 * Subsolar point — the spot on Earth where the sun is directly overhead.
 * Accurate to well under a degree, which is far more than a shader needs, and
 * saves pulling in an astronomy dependency.
 */
export function subsolarPoint(date = new Date()): { lat: number; lng: number } {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const dayOfYear = Math.floor((date.getTime() - start) / 86_400_000) + 1;

  // Axial tilt projected onto the year.
  const declination = -23.44 * Math.cos(((2 * Math.PI) / 365) * (dayOfYear + 10));

  // Equation of time (minutes), correcting for Earth's elliptical orbit.
  const b = ((2 * Math.PI) / 364) * (dayOfYear - 81);
  const eot = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);

  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  let lng = -15 * (utcHours - 12 + eot / 60);
  lng = ((((lng + 180) % 360) + 360) % 360) - 180;

  return { lat: declination, lng };
}

/**
 * Opening shot: the landmass currently closest to noon. Starting wherever the
 * sun happens to be would regularly open on an empty, dark Pacific.
 */
const OPENING_VIEWS = [
  { lat: 22, lng: 12 }, // Europe and Africa
  { lat: 22, lng: 78 }, // South Asia
  { lat: 12, lng: 120 }, // South-east Asia and Australia
  { lat: 32, lng: -98 }, // North America
  { lat: -8, lng: -58 }, // South America
];

export function openingView(date = new Date()) {
  const sunLng = subsolarPoint(date).lng;
  // Shortest way round the globe between the two longitudes.
  const angularDistance = (lng: number) => Math.abs(((lng - sunLng + 540) % 360) - 180);
  return OPENING_VIEWS.reduce((best, view) =>
    angularDistance(view.lng) < angularDistance(best.lng) ? view : best,
  );
}

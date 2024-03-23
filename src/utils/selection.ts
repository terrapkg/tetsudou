// Find the most fit mirrors for the user based on the following criteria
// 1. Mirrors in the same ASN are ALWAYS the highest priority
// 2. Mirrors in the same country (either by request country or geoip)
// 3. Mirrors in the same continent
// 4. Worldwide
// These are brackets, which stop being run when 10 mirrors are found.
// For example, if there are 5 ASN mirrors and 5 same country mirrors, then we don't move on to find them in the same continent or worldwide.
// Each bracket is ranked by Haversine distance from the mirror and user's GeoIP.
// Make sense?

import { Mirror, MirrorWithPreference } from "../types/tetsudou";
import { haversineDistance } from "./math";

export const selectMirrors = (
  req: Request,
  candidates: Mirror[],
  // Should be 100 or below, 10 is a good default.
  num = 10,
): MirrorWithPreference[] => {
  const cf = req.cf!;
  const lat = parseFloat(cf.latitude as string);
  const lon = parseFloat(cf.longitude as string);

  let pool = [...candidates];
  let selected: MirrorWithPreference[] = [];

  {
    const sameASN = pool.filter((m) => m.asn === cf.asn);
    if (sameASN.length > 0) {
      pool = pool.filter((m) => !sameASN.includes(m));
      selected = selected.concat(
        sameASN.map((m) => ({ ...m, preference: 100 })),
      );
    }
  }

  if (selected.length >= num) return selected.slice(0, num);

  {
    const sameCountry = pool.filter((m) => m.country === cf.country);
    if (sameCountry.length > 0) {
      sameCountry.sort(
        (a, b) =>
          haversineDistance(lat, a.lat, lon, a.lon) -
          haversineDistance(lat, b.lat, lon, b.lon),
      );
      pool = pool.filter((m) => !sameCountry.includes(m));
      selected = selected.concat(
        sameCountry.map((c, i) => ({
          ...c,
          preference: 100 - selected.length - i,
        })),
      );
    }
  }

  if (selected.length >= num) return selected.slice(0, num);

  {
    const sameContinent = pool.filter((m) => m.continent === cf.continent);
    if (sameContinent.length > 0) {
      sameContinent.sort(
        (a, b) =>
          haversineDistance(lat, a.lat, lon, a.lon) -
          haversineDistance(lat, b.lat, lon, b.lon),
      );
      pool = pool.filter((m) => !sameContinent.includes(m));
      selected = selected.concat(
        sameContinent.map((m, i) => ({
          ...m,
          preference: 100 - selected.length - i,
        })),
      );
    }
  }

  if (selected.length >= num) return selected.slice(0, num);

  {
    const worldwide = pool;

    worldwide.sort(
      (a, b) =>
        haversineDistance(lat, a.lat, lon, a.lon) -
        haversineDistance(lat, b.lat, lon, b.lon),
    );
    selected = selected.concat(
      worldwide.map((m, i) => ({
        ...m,
        preference: 100 - selected.length - i,
      })),
    );
  }

  return selected.slice(0, num);
};

import { siteConfig } from "../config/site";

type NominatimResult = {
  display_name?: string;
  lat?: string;
  lon?: string;
};

export async function geocodeAustralianAddress(address: string) {
  const params = new URLSearchParams({
    q: address,
    format: "jsonv2",
    countrycodes: "au",
    limit: "1",
  });
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": `Giveleaf/1.0 (${siteConfig.supportEmail})`,
      },
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(8_000),
    },
  );
  if (!response.ok) {
    throw new Error("Address lookup is temporarily unavailable.");
  }

  const results = (await response.json()) as NominatimResult[];
  const match = results[0];
  const latitude = Number(match?.lat);
  const longitude = Number(match?.lon);
  if (
    !match?.display_name ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }
  return {
    displayName: match.display_name,
    latitude,
    longitude,
  };
}

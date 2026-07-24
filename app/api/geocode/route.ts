type NominatimResult = {
  display_name?: string;
  lat?: string;
  lon?: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address")?.trim() ?? "";

  if (address.length < 3 || address.length > 180) {
    return Response.json(
      { error: "Enter a valid Australian address or suburb." },
      { status: 400 },
    );
  }

  try {
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
          "User-Agent": "Giveleaf/0.1 (charity-book-finder)",
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
      return Response.json(
        {
          error:
            "We could not find that address. Try a suburb and postcode, such as “Leederville WA 6007”.",
        },
        { status: 404 },
      );
    }

    return Response.json({
      displayName: match.display_name,
      latitude,
      longitude,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Address lookup is temporarily unavailable.",
      },
      { status: 503 },
    );
  }
}

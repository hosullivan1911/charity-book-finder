import { geocodeAustralianAddress } from "../../../lib/geocode";

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
    const match = await geocodeAustralianAddress(address);
    if (!match) {
      return Response.json(
        {
          error:
            "We could not find that address. Try a suburb and postcode, such as “Leederville WA 6007”.",
        },
        { status: 404 },
      );
    }

    return Response.json(match);
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

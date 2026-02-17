export const dynamic = "force-dynamic";

let strokes = [];

export async function GET() {
  return Response.json({ strokes });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const incoming = body?.stroke;

    if (!incoming || !Array.isArray(incoming.points)) {
      return new Response("Invalid stroke format", { status: 400 });
    }

    const normalizedPoints = incoming.points
      .map((p) => ({
        x: Number(p.x),
        y: Number(p.y),
      }))
      .filter(
        (p) =>
          Number.isFinite(p.x) &&
          Number.isFinite(p.y) &&
          p.x >= 0 &&
          p.x <= 1 &&
          p.y >= 0 &&
          p.y <= 1,
      );

    if (normalizedPoints.length < 2) {
      return new Response("Stroke too short", { status: 400 });
    }

    const stroke = {
      id:
        typeof incoming.id === "number"
          ? incoming.id
          : Date.now() + Math.random(),
      createdAt:
        typeof incoming.createdAt === "number"
          ? incoming.createdAt
          : Date.now(),
      points: normalizedPoints,
    };

    strokes.push(stroke);

    // Keep memory usage bounded
    if (strokes.length > 5000) {
      strokes = strokes.slice(-5000);
    }

    return Response.json({ ok: true });
  } catch (err) {
    return new Response("Failed to save stroke", { status: 500 });
  }
}


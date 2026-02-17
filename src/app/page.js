"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

const BRUSH_SIZE = 3;
const COLORS = [
  "#000000",
  "#ff0000",
  "#ffa500",
  "#ffff00",
  "#00aa00",
  "#0066ff",
  "#8000ff",
];
const DEFAULT_BRUSH_COLOR = COLORS[0];
const POLL_INTERVAL_MS = 5000;

export default function Home() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [strokes, setStrokes] = useState([]);
  const [brushColor, setBrushColor] = useState(DEFAULT_BRUSH_COLOR);
  const currentStrokeRef = useRef(null);
  const isDrawingRef = useRef(false);

  // Resize canvas to fill the container
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      redraw(ctx, strokes, canvas);
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [strokes]);

  // Fetch existing strokes and start polling
  useEffect(() => {
    let isCancelled = false;

    const fetchStrokes = async () => {
      try {
        const res = await fetch("/api/strokes", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!isCancelled && Array.isArray(data.strokes)) {
          setStrokes(data.strokes);
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext("2d");
            redraw(ctx, data.strokes, canvas);
          }
        }
      } catch {
        // swallow errors for this simple demo
      }
    };

    fetchStrokes();
    const id = setInterval(fetchStrokes, POLL_INTERVAL_MS);
    return () => {
      isCancelled = true;
      clearInterval(id);
    };
  }, []);

  const handlePointerDown = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const point = getPointFromEvent(event, rect);
    if (!point) return;

    isDrawingRef.current = true;
    const normalizedPoint = {
      x: point.x / rect.width,
      y: point.y / rect.height,
    };
    currentStrokeRef.current = [normalizedPoint];

    const ctx = canvas.getContext("2d");
    drawStrokeSegment(ctx, [normalizedPoint], canvas, brushColor);
  };

  const handlePointerMove = (event) => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const point = getPointFromEvent(event, rect);
    if (!point) return;

    const normalizedPoint = {
      x: point.x / rect.width,
      y: point.y / rect.height,
    };
    const stroke = currentStrokeRef.current;
    stroke.push(normalizedPoint);

    const ctx = canvas.getContext("2d");
    drawStrokeSegment(ctx, stroke.slice(-2), canvas, brushColor);
  };

  const finishStroke = async () => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    isDrawingRef.current = false;
    const stroke = currentStrokeRef.current;
    currentStrokeRef.current = null;

    if (!stroke || stroke.length < 2) return;

    // Optimistically add to local state
    const newStroke = {
      id: Date.now(),
      points: stroke,
      createdAt: Date.now(),
      color: brushColor,
    };
    setStrokes((prev) => [...prev, newStroke]);

    try {
      await fetch("/api/strokes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ stroke: newStroke }),
      });
    } catch {
      // ignore for this simple demo
    }
  };

  const handlePointerUp = () => {
    finishStroke();
  };

  const handlePointerLeave = () => {
    finishStroke();
  };

  return (
    <div className={styles.page}>
      <div className={styles.info}>
        <div className={styles.palette}>
          {COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={`${styles.swatch} ${
                brushColor === color ? styles.swatchSelected : ""
              }`}
              style={{ backgroundColor: color }}
              onClick={() => setBrushColor(color)}
              aria-label={`Select color ${color}`}
            />
          ))}
        </div>
      </div>
      <div className={styles.canvasContainer} ref={containerRef}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
        />
      </div>
    </div>
  );
}

function getPointFromEvent(event, rect) {
  if (event.pointerType === "touch" && event.touches && event.touches[0]) {
    const t = event.touches[0];
    return {
      x: t.clientX - rect.left,
      y: t.clientY - rect.top,
    };
  }

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function redraw(ctx, strokes, canvas) {
  if (!ctx || !canvas) return;

  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);

  for (const stroke of strokes) {
    const color = stroke.color || DEFAULT_BRUSH_COLOR;
    drawStrokeSegment(ctx, stroke.points, canvas, color);
  }
}

function drawStrokeSegment(ctx, points, canvas, color = DEFAULT_BRUSH_COLOR) {
  if (!ctx || !canvas || !points || points.length === 0) return;
  const rect = canvas.getBoundingClientRect();

  ctx.strokeStyle = color;
  ctx.lineWidth = BRUSH_SIZE;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  const [first, ...rest] = points;
  ctx.moveTo(first.x * rect.width, first.y * rect.height);
  for (const p of rest) {
    ctx.lineTo(p.x * rect.width, p.y * rect.height);
  }
  ctx.stroke();
}

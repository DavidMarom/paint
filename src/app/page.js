"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

const BRUSH_SIZE = 3;
const BRUSH_COLOR = "#000000";
const POLL_INTERVAL_MS = 5000;

export default function Home() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [strokes, setStrokes] = useState([]);
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
    drawStrokeSegment(ctx, [normalizedPoint], canvas);
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
    drawStrokeSegment(ctx, stroke.slice(-2), canvas);
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
        <h1>Paint</h1>
        <p>Draw anywhere. Everyone shares the same canvas.</p>
        <p className={styles.subtle}>
          Simple 3px black brush. Updates sync every few seconds.
        </p>
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
    drawStrokeSegment(ctx, stroke.points, canvas);
  }
}

function drawStrokeSegment(ctx, points, canvas) {
  if (!ctx || !canvas || !points || points.length === 0) return;
  const rect = canvas.getBoundingClientRect();

  ctx.strokeStyle = BRUSH_COLOR;
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

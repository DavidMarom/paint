"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

const BRUSH_SIZE = 3;
const ERASER_SIZE = 7;
const BACKGROUND_COLOR = "#bbbbbb";
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
  const [tool, setTool] = useState("brush"); // "brush" | "stencil" | "eraser"
  const currentStrokeRef = useRef(null);
  const isDrawingRef = useRef(false);

  const stencilImageRef = useRef(null);

  // Load stencil image
  useEffect(() => {
    const img = new Image();
    img.src = "/sb.png";
    img.onload = () => {
      stencilImageRef.current = img;
    };
  }, []);

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
      redraw(ctx, strokes, canvas, stencilImageRef.current);
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
            redraw(ctx, data.strokes, canvas, stencilImageRef.current);
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

    // Stencil mode: stamp once per click
    if (tool === "stencil") {
      const position = {
        x: point.x / rect.width,
        y: point.y / rect.height,
      };

      const ctx = canvas.getContext("2d");
      drawStencil(ctx, position, canvas, stencilImageRef.current);

      const stencilPlacement = {
        id: Date.now(),
        type: "stencil",
        position,
        color: brushColor,
        createdAt: Date.now(),
      };

      setStrokes((prev) => [...prev, stencilPlacement]);

      fetch("/api/strokes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ stroke: stencilPlacement }),
      }).catch(() => {
        // ignore network errors for this simple demo
      });

      return;
    }

    isDrawingRef.current = true;
    const normalizedPoint = {
      x: point.x / rect.width,
      y: point.y / rect.height,
    };
    currentStrokeRef.current = [normalizedPoint];

    const effectiveColor = tool === "eraser" ? BACKGROUND_COLOR : brushColor;
    const effectiveSize = tool === "eraser" ? ERASER_SIZE : BRUSH_SIZE;
    const ctx = canvas.getContext("2d");
    drawStrokeSegment(ctx, [normalizedPoint], canvas, effectiveColor, effectiveSize);
  };

  const handlePointerMove = (event) => {
    if (tool === "stencil") return;
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

    const effectiveColor = tool === "eraser" ? BACKGROUND_COLOR : brushColor;
    const effectiveSize = tool === "eraser" ? ERASER_SIZE : BRUSH_SIZE;
    const ctx = canvas.getContext("2d");
    drawStrokeSegment(ctx, stroke.slice(-2), canvas, effectiveColor, effectiveSize);
  };

  const finishStroke = async () => {
    if (tool === "stencil") return;
    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    isDrawingRef.current = false;
    const stroke = currentStrokeRef.current;
    currentStrokeRef.current = null;

    if (!stroke || stroke.length < 2) return;

    const effectiveColor = tool === "eraser" ? BACKGROUND_COLOR : brushColor;
    const effectiveSize = tool === "eraser" ? ERASER_SIZE : BRUSH_SIZE;
    const newStroke = {
      id: Date.now(),
      type: "stroke",
      points: stroke,
      createdAt: Date.now(),
      color: effectiveColor,
      size: effectiveSize,
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
      <main>
        <h1 className={styles.pageTitle}>Paint together</h1>
      </main>
      <div className={styles.info}>
        <button
          type="button"
          className={`${styles.eraserButton} ${
            tool === "eraser" ? styles.toolButtonActive : ""
          }`}
          onClick={() => setTool((prev) => (prev === "eraser" ? "brush" : "eraser"))}
          aria-label="Eraser"
        >
          <span className={styles.eraserIcon} />
        </button>
        <div className={styles.palette}>
          {COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={`${styles.swatch} ${
                brushColor === color ? styles.swatchSelected : ""
              }`}
              style={{ backgroundColor: color }}
              onClick={() => {
                setBrushColor(color);
                setTool("brush");
              }}
              aria-label={`Select color ${color}`}
            />
          ))}
        </div>
        <button
          type="button"
          className={`${styles.toolButton} ${
            tool === "stencil" ? styles.toolButtonActive : ""
          }`}
          onClick={() => {
            setTool((prev) => (prev === "stencil" ? "brush" : "stencil"));
          }}
        >
          <span className={styles.toolIconWrapper}>
            <img src="/sb.png" alt="Stencil" className={styles.toolIcon} />
          </span>
        </button>
        <button
          type="button"
          className={`${styles.toolButton} ${styles.shareButton}`}
          onClick={() => {
            const text =
              "Paint together with me at https://www.paintogether.live/";
            const url =
              "https://wa.me/?text=" + encodeURIComponent(text);
            window.open(url, "_blank");
          }}
        >
          Share
        </button>
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

function redraw(ctx, strokes, canvas, stencilImage) {
  if (!ctx || !canvas) return;

  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);

  for (const stroke of strokes) {
    const color = stroke.color || DEFAULT_BRUSH_COLOR;
    const size = stroke.size ?? BRUSH_SIZE;
    if (stroke.type === "stencil" && stroke.position) {
      drawStencil(ctx, stroke.position, canvas, stencilImage);
    } else {
      drawStrokeSegment(ctx, stroke.points, canvas, color, size);
    }
  }
}

function drawStrokeSegment(ctx, points, canvas, color = DEFAULT_BRUSH_COLOR, lineWidth = BRUSH_SIZE) {
  if (!ctx || !canvas || !points || points.length === 0) return;
  const rect = canvas.getBoundingClientRect();

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
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

function drawStencil(ctx, position, canvas, image) {
  if (!ctx || !canvas || !position || !image) return;
  const rect = canvas.getBoundingClientRect();
  const centerX = position.x * rect.width;
  const centerY = position.y * rect.height;

  const maxSize = Math.min(rect.width, rect.height) * 0.12;
  const scale = maxSize / image.width;
  const width = image.width * scale;
  const height = image.height * scale;

  ctx.drawImage(image, centerX - width / 2, centerY - height / 2, width, height);
}

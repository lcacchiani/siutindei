'use client';

import { useEffect, useRef, useState } from 'react';

interface Sparkle {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  radius: number;
  life: number;
  maxLife: number;
  color: string;
}

/* Logo support colors: gold, leaf green, and blush pink. Rendered with
   normal compositing so they stay visible on the light backgrounds. */
const SPARKLE_COLORS = ['#dfae10', '#5e9636', '#f2a0bf'];
const MAX_SPARKLES = 90;
const SPAWN_PER_MOVE = 2;

function drawSparkle(
  context: CanvasRenderingContext2D,
  sparkle: Sparkle,
): void {
  const progress = sparkle.life / sparkle.maxLife;
  const radius = sparkle.radius * (1 - progress * 0.6);
  const { x, y } = sparkle;

  context.globalAlpha = 0.9 * (1 - progress);
  context.fillStyle = sparkle.color;
  context.beginPath();
  context.moveTo(x, y - radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.quadraticCurveTo(x, y, x, y + radius);
  context.quadraticCurveTo(x, y, x - radius, y);
  context.quadraticCurveTo(x, y, x, y - radius);
  context.fill();
}

/**
 * A faint trail of "discovery sparkles" that follows the pointer.
 * Only active on fine-pointer devices, and disabled entirely for users
 * who prefer reduced motion. The canvas never captures pointer events.
 */
export function SparkleCursor() {
  const [isEnabled, setIsEnabled] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return;
    }
    const finePointer = window.matchMedia('(pointer: fine)');
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    );
    const update = () => {
      setIsEnabled(finePointer.matches && !reducedMotion.matches);
    };
    update();
    finePointer.addEventListener('change', update);
    reducedMotion.addEventListener('change', update);
    return () => {
      finePointer.removeEventListener('change', update);
      reducedMotion.removeEventListener('change', update);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!isEnabled || !canvas) {
      return;
    }
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    let sparkles: Sparkle[] = [];
    let animationFrame = 0;
    let isAnimating = false;
    let lastTimestamp = 0;

    function resize() {
      if (!canvas) {
        return;
      }
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * ratio);
      canvas.height = Math.floor(window.innerHeight * ratio);
      context?.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function tick(timestamp: number) {
      if (!context || !canvas) {
        return;
      }
      const delta = Math.min((timestamp - lastTimestamp) / 1000, 0.05);
      lastTimestamp = timestamp;

      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      context.globalCompositeOperation = 'source-over';

      sparkles = sparkles.filter((sparkle) => {
        sparkle.life += delta;
        if (sparkle.life >= sparkle.maxLife) {
          return false;
        }
        sparkle.x += sparkle.velocityX * delta;
        sparkle.y += sparkle.velocityY * delta;
        sparkle.velocityY += 26 * delta;
        drawSparkle(context, sparkle);
        return true;
      });
      context.globalAlpha = 1;

      if (sparkles.length > 0) {
        animationFrame = window.requestAnimationFrame(tick);
      } else {
        isAnimating = false;
        context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      }
    }

    function startAnimating() {
      if (!isAnimating) {
        isAnimating = true;
        lastTimestamp = performance.now();
        animationFrame = window.requestAnimationFrame(tick);
      }
    }

    function onPointerMove(event: PointerEvent) {
      for (let index = 0; index < SPAWN_PER_MOVE; index += 1) {
        if (sparkles.length >= MAX_SPARKLES) {
          sparkles.shift();
        }
        sparkles.push({
          x: event.clientX + (Math.random() - 0.5) * 14,
          y: event.clientY + (Math.random() - 0.5) * 14,
          velocityX: (Math.random() - 0.5) * 36,
          velocityY: (Math.random() - 0.5) * 30 - 8,
          radius: 3 + Math.random() * 4.5,
          life: 0,
          maxLife: 0.65 + Math.random() * 0.55,
          color:
            SPARKLE_COLORS[
              Math.floor(Math.random() * SPARKLE_COLORS.length)
            ],
        });
      }
      startAnimating();
    }

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      window.cancelAnimationFrame(animationFrame);
    };
  }, [isEnabled]);

  if (!isEnabled) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      className="sparkle-cursor-canvas"
      aria-hidden="true"
      data-testid="sparkle-cursor"
    />
  );
}

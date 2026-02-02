#!/usr/bin/env node
/**
 * Generate a banner image with noise pattern and gradient
 * Dimensions: 1500x500 (Mastodon header standard)
 */

const { createCanvas } = require("canvas");
const fs = require("fs");
const path = require("path");

const WIDTH = 1500;
const HEIGHT = 500;

// Color palette matching the site
const COLORS = {
  bgDark: "#0f172a", // slate-900
  bgMid: "#1e293b", // slate-800
  teal: "#0d9488", // teal-600
  tealDark: "#115e59", // teal-800
};

function generateBanner() {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  // Fill with dark gradient background
  const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  gradient.addColorStop(0, COLORS.bgDark);
  gradient.addColorStop(0.3, COLORS.bgMid);
  gradient.addColorStop(0.7, COLORS.bgMid);
  gradient.addColorStop(1, COLORS.bgDark);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Add a subtle teal glow in the center
  const glowGradient = ctx.createRadialGradient(
    WIDTH * 0.5,
    HEIGHT * 0.5,
    0,
    WIDTH * 0.5,
    HEIGHT * 0.5,
    WIDTH * 0.4
  );
  glowGradient.addColorStop(0, "rgba(13, 148, 136, 0.08)"); // teal with low opacity
  glowGradient.addColorStop(0.5, "rgba(13, 148, 136, 0.03)");
  glowGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = glowGradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Add noise pattern
  const imageData = ctx.getImageData(0, 0, WIDTH, HEIGHT);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    // Add subtle noise to each pixel
    const noise = (Math.random() - 0.5) * 20;
    data[i] = Math.max(0, Math.min(255, data[i] + noise)); // R
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise)); // G
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise)); // B
  }
  ctx.putImageData(imageData, 0, 0);

  // Add a subtle vignette effect
  const vignetteGradient = ctx.createRadialGradient(
    WIDTH / 2,
    HEIGHT / 2,
    HEIGHT * 0.4,
    WIDTH / 2,
    HEIGHT / 2,
    WIDTH * 0.6
  );
  vignetteGradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignetteGradient.addColorStop(1, "rgba(0, 0, 0, 0.3)");
  ctx.fillStyle = vignetteGradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  return canvas;
}

// Generate and save
const canvas = generateBanner();
const outputPath = path.join(__dirname, "../public/images/banner.png");
const buffer = canvas.toBuffer("image/png");
fs.writeFileSync(outputPath, buffer);

console.log(`✅ Banner generated: ${outputPath}`);
console.log(`   Dimensions: ${WIDTH}x${HEIGHT}`);

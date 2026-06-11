#!/usr/bin/env node
/**
 * generate_seed_hashes.js
 *
 * One-time dev tool to compute SHA-256 params_hash values for seed keyframe
 * animations in the keyframe_registry table.
 *
 * The params_hash is the SHA-256 hex digest of the canonical JSON representation
 * of the animation's defining parameters (name, fps, duration_frames, keyframes,
 * properties, transform_origin).
 *
 * Usage:
 *   node scripts/generate_seed_hashes.js
 *
 * Output:
 *   Prints each animation name and its computed SHA-256 hash, ready to paste
 *   into the seed SQL file.
 *
 * NOTE: This script is NOT a runtime dependency. It is run once during
 * development and its output is used to populate the seed SQL file.
 */

const crypto = require('crypto');

/**
 * Compute SHA-256 hash of canonical JSON params for an animation.
 * Canonical form: JSON.stringify with keys in fixed order, no extra whitespace.
 */
function computeParamsHash(animation) {
  const canonical = JSON.stringify({
    name: animation.name,
    fps: animation.fps,
    duration_frames: animation.duration_frames,
    keyframes: animation.keyframes,
    properties: animation.properties,
    transform_origin: animation.transform_origin,
  });
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

// ─── Seed Animation Definitions ────────────────────────────────────────────────

const animations = [
  {
    name: 'fade_in',
    fps: 30,
    duration_frames: 10,
    properties: ['opacity'],
    transform_origin: 'center center',
    keyframes: [
      { frame: 0, opacity: 0, scale: 1, x: 0, y: 0, rotation: 0 },
      { frame: 3, opacity: 0.3, scale: 1, x: 0, y: 0, rotation: 0 },
      { frame: 6, opacity: 0.7, scale: 1, x: 0, y: 0, rotation: 0 },
      { frame: 9, opacity: 1.0, scale: 1, x: 0, y: 0, rotation: 0 },
    ],
  },
  {
    name: 'scale_bounce',
    fps: 30,
    duration_frames: 15,
    properties: ['scale', 'opacity'],
    transform_origin: 'center center',
    keyframes: [
      { frame: 0, opacity: 0, scale: 0, x: 0, y: 0, rotation: 0 },
      { frame: 4, opacity: 1, scale: 1.2, x: 0, y: 0, rotation: 0 },
      { frame: 8, opacity: 1, scale: 0.9, x: 0, y: 0, rotation: 0 },
      { frame: 11, opacity: 1, scale: 1.05, x: 0, y: 0, rotation: 0 },
      { frame: 14, opacity: 1, scale: 1.0, x: 0, y: 0, rotation: 0 },
    ],
  },
  {
    name: 'slide_up',
    fps: 30,
    duration_frames: 12,
    properties: ['y', 'opacity'],
    transform_origin: 'center center',
    keyframes: [
      { frame: 0, opacity: 0, scale: 1, x: 0, y: 50, rotation: 0 },
      { frame: 3, opacity: 0.4, scale: 1, x: 0, y: 35, rotation: 0 },
      { frame: 6, opacity: 0.7, scale: 1, x: 0, y: 18, rotation: 0 },
      { frame: 9, opacity: 0.9, scale: 1, x: 0, y: 5, rotation: 0 },
      { frame: 11, opacity: 1.0, scale: 1, x: 0, y: 0, rotation: 0 },
    ],
  },
  {
    name: 'slide_down',
    fps: 30,
    duration_frames: 12,
    properties: ['y', 'opacity'],
    transform_origin: 'center center',
    keyframes: [
      { frame: 0, opacity: 0, scale: 1, x: 0, y: -50, rotation: 0 },
      { frame: 3, opacity: 0.4, scale: 1, x: 0, y: -35, rotation: 0 },
      { frame: 6, opacity: 0.7, scale: 1, x: 0, y: -18, rotation: 0 },
      { frame: 9, opacity: 0.9, scale: 1, x: 0, y: -5, rotation: 0 },
      { frame: 11, opacity: 1.0, scale: 1, x: 0, y: 0, rotation: 0 },
    ],
  },
  {
    name: 'slide_left',
    fps: 30,
    duration_frames: 12,
    properties: ['x', 'opacity'],
    transform_origin: 'center center',
    keyframes: [
      { frame: 0, opacity: 0, scale: 1, x: 50, y: 0, rotation: 0 },
      { frame: 3, opacity: 0.4, scale: 1, x: 35, y: 0, rotation: 0 },
      { frame: 6, opacity: 0.7, scale: 1, x: 18, y: 0, rotation: 0 },
      { frame: 9, opacity: 0.9, scale: 1, x: 5, y: 0, rotation: 0 },
      { frame: 11, opacity: 1.0, scale: 1, x: 0, y: 0, rotation: 0 },
    ],
  },
  {
    name: 'slide_right',
    fps: 30,
    duration_frames: 12,
    properties: ['x', 'opacity'],
    transform_origin: 'center center',
    keyframes: [
      { frame: 0, opacity: 0, scale: 1, x: -50, y: 0, rotation: 0 },
      { frame: 3, opacity: 0.4, scale: 1, x: -35, y: 0, rotation: 0 },
      { frame: 6, opacity: 0.7, scale: 1, x: -18, y: 0, rotation: 0 },
      { frame: 9, opacity: 0.9, scale: 1, x: -5, y: 0, rotation: 0 },
      { frame: 11, opacity: 1.0, scale: 1, x: 0, y: 0, rotation: 0 },
    ],
  },
  {
    name: 'pop_in',
    fps: 30,
    duration_frames: 10,
    properties: ['scale', 'opacity'],
    transform_origin: 'center center',
    keyframes: [
      { frame: 0, opacity: 0, scale: 0, x: 0, y: 0, rotation: 0 },
      { frame: 3, opacity: 0.8, scale: 1.3, x: 0, y: 0, rotation: 0 },
      { frame: 6, opacity: 1.0, scale: 0.95, x: 0, y: 0, rotation: 0 },
      { frame: 9, opacity: 1.0, scale: 1.0, x: 0, y: 0, rotation: 0 },
    ],
  },
  {
    name: 'slam_in',
    fps: 30,
    duration_frames: 8,
    properties: ['scale', 'opacity'],
    transform_origin: 'center center',
    keyframes: [
      { frame: 0, opacity: 0, scale: 3.0, x: 0, y: 0, rotation: 0 },
      { frame: 2, opacity: 0.7, scale: 1.5, x: 0, y: 0, rotation: 0 },
      { frame: 4, opacity: 1.0, scale: 0.95, x: 0, y: 0, rotation: 0 },
      { frame: 6, opacity: 1.0, scale: 1.02, x: 0, y: 0, rotation: 0 },
      { frame: 7, opacity: 1.0, scale: 1.0, x: 0, y: 0, rotation: 0 },
    ],
  },
  {
    name: 'typewriter_reveal',
    fps: 30,
    duration_frames: 20,
    properties: ['opacity', 'y'],
    transform_origin: 'center center',
    keyframes: [
      { frame: 0, opacity: 0, scale: 1, x: 0, y: 5, rotation: 0 },
      { frame: 3, opacity: 0.15, scale: 1, x: 0, y: 4, rotation: 0 },
      { frame: 6, opacity: 0.3, scale: 1, x: 0, y: 3, rotation: 0 },
      { frame: 9, opacity: 0.5, scale: 1, x: 0, y: 2, rotation: 0 },
      { frame: 12, opacity: 0.7, scale: 1, x: 0, y: 1, rotation: 0 },
      { frame: 15, opacity: 0.85, scale: 1, x: 0, y: 0.5, rotation: 0 },
      { frame: 19, opacity: 1.0, scale: 1, x: 0, y: 0, rotation: 0 },
    ],
  },
  {
    name: 'pulse',
    fps: 30,
    duration_frames: 15,
    properties: ['scale'],
    transform_origin: 'center center',
    keyframes: [
      { frame: 0, opacity: 1, scale: 1.0, x: 0, y: 0, rotation: 0 },
      { frame: 4, opacity: 1, scale: 1.05, x: 0, y: 0, rotation: 0 },
      { frame: 7, opacity: 1, scale: 1.1, x: 0, y: 0, rotation: 0 },
      { frame: 11, opacity: 1, scale: 1.05, x: 0, y: 0, rotation: 0 },
      { frame: 14, opacity: 1, scale: 1.0, x: 0, y: 0, rotation: 0 },
    ],
  },
];

// ─── Compute and Print Hashes ──────────────────────────────────────────────────

console.log('=== Keyframe Registry Seed Hashes ===\n');
console.log('Generated at:', new Date().toISOString());
console.log('Algorithm: SHA-256 of canonical JSON (name, fps, duration_frames, keyframes, properties, transform_origin)\n');

const results = [];

for (const anim of animations) {
  const hash = computeParamsHash(anim);
  results.push({ name: anim.name, hash });
  console.log(`  ${anim.name.padEnd(20)} → ${hash}`);
}

console.log('\n--- SQL-ready values ---\n');
for (const { name, hash } of results) {
  console.log(`  -- ${name}`);
  console.log(`  '${hash}',`);
}

console.log('\nDone. Paste these hashes into database/seed_keyframe_styles.sql');

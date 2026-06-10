/**
 * Performance Benchmark Script for Remotion Render Pipeline
 *
 * Requirements:
 * - Req 18.1: 60s video with all features → render completes within 300s
 * - Req 18.2: <30s video with minimal overlays → render completes within 120s
 * - Req 18.3: Render duration logged to stdout
 *
 * Usage:
 *   npx ts-node scripts/benchmark.ts [--video path/to/video.mp4]
 *
 * Prerequisites:
 *   - Remotion bundle built: npm run build
 *   - A test video file available
 *   - Node.js 18+
 */

import { execSync } from "child_process";
import { existsSync } from "fs";
import path from "path";
import {
    FULL_FEATURES_CONFIG,
    MINIMAL_CONFIG,
    PERFORMANCE_THRESHOLDS,
} from "./benchmark-config";

// ─── CLI Argument Parsing ────────────────────────────────────────────────────

function parseArgs(): { videoPath: string } {
    const args = process.argv.slice(2);
    let videoPath = "";

    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--video" && args[i + 1]) {
            videoPath = args[i + 1];
            i++;
        }
    }

    if (!videoPath) {
        videoPath = path.resolve(__dirname, "../test-fixtures/sample-video.mp4");
    }

    return { videoPath };
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface BenchmarkResult {
    name: string;
    durationSeconds: number;
    threshold: number;
    passed: boolean;
}

interface BenchmarkScenario {
    name: string;
    durationSeconds: number;
    config: typeof FULL_FEATURES_CONFIG | typeof MINIMAL_CONFIG;
    threshold: number;
}

// ─── Benchmark Runner ────────────────────────────────────────────────────────

function buildProps(
    videoPath: string,
    config: typeof FULL_FEATURES_CONFIG | typeof MINIMAL_CONFIG,
    durationSeconds: number
) {
    // Generate minimal subtitle data covering the video duration
    const subtitles = [];
    for (let t = 0; t < durationSeconds; t += 2) {
        subtitles.push({
            start: t,
            end: Math.min(t + 2, durationSeconds),
            text: `Benchmark subtitle at ${t}s`,
            words: [
                { word: "Benchmark", start: t, end: t + 0.5 },
                { word: "subtitle", start: t + 0.5, end: t + 1.0 },
                { word: "at", start: t + 1.0, end: t + 1.3 },
                { word: `${t}s`, start: t + 1.3, end: t + 2.0 },
            ],
        });
    }

    return {
        videoSrc: videoPath,
        hookText: config.text.lines.map((l) => l.text).join("\n"),
        subtitles,
        hookStyle: {
            fontFamily: config.text.lines[0]?.font || "Bebas Neue",
            fontSize: config.text.font_size_normal,
            color: config.text.color,
            keywordColor: config.text.keyword_color,
            shadow: "2px 2px 4px rgba(0,0,0,0.8)",
            glow: "none",
            animationType: config.animation.type,
            displayDurationSeconds: Math.min(5, durationSeconds),
            config,
        },
        captionStyle: {
            fontFamily: "Bebas Neue",
            fontSize: 28,
            color: "#FFFFFF",
            highlightColor: "#FDE68A",
            highlightStyle: "glow",
            shadow: "1px 1px 3px rgba(0,0,0,0.6)",
            config: {},
        },
    };
}

function runBenchmark(scenario: BenchmarkScenario, videoPath: string, bundleDir: string): BenchmarkResult {
    const props = buildProps(videoPath, scenario.config, scenario.durationSeconds);
    const propsJson = JSON.stringify(props);
    const outputPath = path.resolve(__dirname, `../tmp/benchmark-${scenario.name}.mp4`);

    // Ensure tmp directory exists
    const tmpDir = path.dirname(outputPath);
    if (!existsSync(tmpDir)) {
        execSync(`mkdir -p "${tmpDir}"`);
    }

    const renderCmd = [
        "npx remotion render",
        `"${bundleDir}"`,
        "ClipComposition",
        `--output "${outputPath}"`,
        "--codec h264",
        "--crf 18",
        `--props '${propsJson.replace(/'/g, "'\\''")}'`,
    ].join(" ");

    console.log(`\n${"─".repeat(60)}`);
    console.log(`Benchmark: ${scenario.name}`);
    console.log(`Duration: ${scenario.durationSeconds}s video`);
    console.log(`Threshold: ${scenario.threshold}s`);
    console.log(`${"─".repeat(60)}`);

    const startTime = Date.now();

    try {
        execSync(renderCmd, {
            cwd: path.resolve(__dirname, ".."),
            stdio: "pipe",
            timeout: (scenario.threshold + 60) * 1000, // Give extra 60s buffer before killing
        });
    } catch (error: any) {
        const elapsed = (Date.now() - startTime) / 1000;
        if (error.killed) {
            console.error(`✗ Render timed out after ${elapsed.toFixed(1)}s (killed)`);
        } else {
            console.error(`✗ Render failed after ${elapsed.toFixed(1)}s`);
            console.error(`  Exit code: ${error.status}`);
            if (error.stderr) {
                console.error(`  stderr: ${error.stderr.toString().slice(0, 500)}`);
            }
        }
        return {
            name: scenario.name,
            durationSeconds: elapsed,
            threshold: scenario.threshold,
            passed: false,
        };
    }

    const elapsed = (Date.now() - startTime) / 1000;
    const passed = elapsed <= scenario.threshold;

    // Req 18.3: Log render duration to stdout
    console.log(`Render completed in ${Math.round(elapsed)}s`);

    if (passed) {
        console.log(`✓ PASSED (${elapsed.toFixed(1)}s ≤ ${scenario.threshold}s threshold)`);
    } else {
        console.log(`✗ FAILED (${elapsed.toFixed(1)}s > ${scenario.threshold}s threshold)`);
    }

    return {
        name: scenario.name,
        durationSeconds: elapsed,
        threshold: scenario.threshold,
        passed,
    };
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
    const { videoPath } = parseArgs();
    const bundleDir = process.env.REMOTION_BUNDLE_DIR || path.resolve(__dirname, "../build");

    console.log("╔══════════════════════════════════════════════════════════╗");
    console.log("║    Remotion Render Performance Benchmark                 ║");
    console.log("╚══════════════════════════════════════════════════════════╝");
    console.log("");
    console.log(`Video:  ${videoPath}`);
    console.log(`Bundle: ${bundleDir}`);
    console.log(`Time:   ${new Date().toISOString()}`);

    // Validate prerequisites
    if (!existsSync(videoPath)) {
        console.error(`\n✗ Video file not found: ${videoPath}`);
        console.error("  Use --video <path> to specify a test video file.");
        process.exit(2);
    }

    if (!existsSync(bundleDir)) {
        console.error(`\n✗ Remotion bundle not found at: ${bundleDir}`);
        console.error("  Run 'npm run build' first to create the bundle.");
        process.exit(2);
    }

    // Define benchmark scenarios
    const scenarios: BenchmarkScenario[] = [
        {
            name: "full-features-60s",
            durationSeconds: 60,
            config: FULL_FEATURES_CONFIG,
            threshold: PERFORMANCE_THRESHOLDS.fullFeatures60s,
        },
        {
            name: "minimal-30s",
            durationSeconds: 25, // Under 30s as per Req 18.2
            config: MINIMAL_CONFIG,
            threshold: PERFORMANCE_THRESHOLDS.minimal30s,
        },
    ];

    // Run benchmarks
    const results: BenchmarkResult[] = [];

    for (const scenario of scenarios) {
        const result = runBenchmark(scenario, videoPath, bundleDir);
        results.push(result);
    }

    // Summary
    console.log(`\n${"═".repeat(60)}`);
    console.log("BENCHMARK SUMMARY");
    console.log(`${"═".repeat(60)}`);

    let allPassed = true;
    for (const result of results) {
        const status = result.passed ? "✓ PASS" : "✗ FAIL";
        console.log(`  ${status}  ${result.name}: ${result.durationSeconds.toFixed(1)}s / ${result.threshold}s`);
        if (!result.passed) allPassed = false;
    }

    console.log(`${"═".repeat(60)}`);

    if (allPassed) {
        console.log("\n✓ All benchmarks passed.");
        process.exit(0);
    } else {
        console.log("\n✗ Some benchmarks failed.");
        process.exit(1);
    }
}

main();

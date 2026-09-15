#!/usr/bin/env bash
# Composes the raw phone-shaped capture(s) from demo-video.mjs into a real 4K master.
#
# Run from Git-Bash / a POSIX shell, never from inside the Node script: ffmpeg's -vf filter
# string needs unescaped commas and colons, and cmd.exe's quoting on Windows mangles it when
# invoked via child_process (verified — exits with a garbage status code). Bash quotes it
# correctly, so the transcode is a separate, manual step.
#
# What this does, not a naive upscale: chit is a real mobile layout (390x844 is the actual
# product, the same width every other screenshot in this repo uses), and recordVideo only
# renders sharply at a native viewport equal to its own recording size — so the capture stays
# at that real size and is scaled up cleanly afterwards, rather than trying to force a wide
# desktop-shaped recording out of a phone screen. The output is a genuine 3840x2160 canvas:
# the sharp phone recording centered, a soft blurred drop shadow under it, on chit's own
# near-black ink tone rather than plain black bars.
#
# demo-video.mjs writes two clips — the main walkthrough and a short locale glimpse recorded
# in a separate pass (a language switch needs a fresh page load, so it cannot land in the same
# continuous recording). They are concatenated here, before the 4K composite, so the expensive
# transcode only runs once.
set -euo pipefail

cd "$(dirname "$0")/.."
MAIN="shots/demo-video/chit-demo-main.webm"
LOCALE="shots/demo-video/chit-demo-locale.webm"
RAW="shots/demo-video/chit-demo-raw.mp4"
OUT="shots/demo-video/chit-demo-4k.mp4"

if [ ! -f "$MAIN" ]; then
  echo "missing $MAIN — run: node --experimental-strip-types scripts/demo-video.mjs" >&2
  exit 1
fi

if [ -f "$LOCALE" ]; then
  # Filter-based concat, not the concat demuxer: the two recordings come from separate
  # Playwright contexts and are not guaranteed byte-identical in container framing, which the
  # demuxer is strict about.
  ffmpeg -y -i "$MAIN" -i "$LOCALE" \
    -filter_complex "[0:v][1:v]concat=n=2:v=1:a=0,format=yuv420p[outv]" \
    -map "[outv]" -c:v libx264 -preset veryfast -crf 12 -pix_fmt yuv420p -r 30 \
    "$RAW"
else
  ffmpeg -y -i "$MAIN" -c:v libx264 -preset veryfast -crf 12 -pix_fmt yuv420p -r 30 "$RAW"
fi

# The background is an infinite lavfi color source, so the global -shortest flag alone does
# not reliably stop the graph once the real capture ends — overlay keeps drawing the
# background alone forever (verified: a first attempt ran for 8+ real hours, duplicating
# frames, before this was caught and killed). Each overlay gets its own shortest=1, and -t
# pins a hard cap at the capture's own probed length as a second, independent guard.
DURATION=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$RAW")

ffmpeg -y \
  -i "$RAW" \
  -f lavfi -i "color=c=0x111112:s=3840x2160" \
  -filter_complex "
    [0:v]scale=-2:1900:flags=lanczos,format=rgba[phone];
    [phone]split=2[shadow_src][sharp];
    [shadow_src]boxblur=28:2,colorchannelmixer=aa=0.5[shadow];
    [1:v][shadow]overlay=x=(W-w)/2+22:y=(H-h)/2+26:shortest=1:format=auto[bg1];
    [bg1][sharp]overlay=x=(W-w)/2:y=(H-h)/2:shortest=1:format=auto,format=yuv420p[out]
  " \
  -map "[out]" \
  -t "$DURATION" \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -r 30 -movflags +faststart \
  "$OUT"

echo
echo "wrote $OUT"
ffprobe -v error -select_streams v:0 \
  -show_entries stream=width,height,codec_name,pix_fmt,r_frame_rate \
  -show_entries format=duration,size \
  -of default=nw=1 "$OUT"

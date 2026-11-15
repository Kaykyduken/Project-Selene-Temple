# 30-second demo video: script

AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.

Rules: video of at most 30 seconds, public link, English captions (`demo.srt`, uploaded as subtitles or burned in).
Narration in English is optional; if an AI voice is used, declare it in the "Use of AI" field.
No people in the video. Record in a window about 1400 x 850, Educational mode, language EN, text size 4 or 5.
Close the guided tour first (Esc). The scene at 0:15 needs the local API running (`localhost`); the published
site has no API. Use the real values on screen; do not edit numbers.

| Time | On screen | Narration and caption (same text as `demo.srt`) |
|---|---|---|
| 0:00 to 0:04 | 3D Moon turning slowly, names visible | Where should we land on the Moon? Meet the Lunar Landing Site Navigator. |
| 0:04 to 0:10 | Click **Malapert Massif**: panel with Sun, Earth, dark | Pick a region near the south pole and see its Sun, its view of Earth, and its longest dark night. |
| 0:10 to 0:15 | Click **Apollo 11**: the Moon zooms, the NASA photo appears | Or visit Apollo's landing sites, with real NASA photos and history. |
| 0:15 to 0:22 | Map: click inside the red border, loading screen, result with "good or bad to land" | Click any point inside the red border. We compute its real terrain horizon from NASA LOLA data and JPL Horizons. |
| 0:22 to 0:26 | Switch to **Expert**: detailed charts | Expert mode shows every chart and source. |
| 0:26 to 0:30 | Back to the 3D Moon; title and site address on screen | Built for NASA Space Apps. Will you take the next step toward our next giant leap? |

If it runs over 30 seconds, drop the Expert scene. Without the API, replace the 0:15 scene with a region's simple
charts and the caption "See simple charts anyone can read."
Recording on Zorin OS: Ctrl+Shift+Alt+R. Upload to YouTube as Unlisted.

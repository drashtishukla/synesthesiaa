# Synesthesia

Synesthesia is a real-time, crowd-controlled music queue. Hosts create a room, guests join via link or QR code, and voting decides what plays next. The queue updates instantly for everyone in the room.

## Features 
- Live rooms with shared queues
- Add songs and vote (up/down)
- Real-time ordering driven by votes
- Host-controlled playback (Spotify Connect, YouTube, etc.)
- Embeddable views (planned)

## Tech Stack
- Next.js (App Router)
- TypeScript
- Tailwind CSS + shadcn/ui
- Convex (real-time backend)

## Quick Start

```bash
# Install dependencies
pnpm install

# Start Convex (first run will prompt login and create .env.local)
pnpm convex:dev

# Run the Next.js dev server
pnpm dev
```

Copy `.env.example` to `.env.local` if you need to pre-create the file. Convex will populate `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` during setup.

### YouTube Playback (Embed)
YouTube playback uses iframe embeds directly in the room view.
- Add songs by pasting a YouTube URL or ID.
- The top YouTube track in the queue is embedded for playback.

### YouTube Search (Logic + Setup)
Search hits `GET /api/youtube/search?q=...` and returns up to 8 results with
`id`, `title`, `channel`, and `thumbnailUrl`. The route tries the YouTube Data
API first, then falls back to YT Music if needed.

Primary path (YouTube Data API):
- Requires `YOUTUBE_API_KEY` in `.env.local`.
- Uses the YouTube Search API with `videoEmbeddable=true` and safe search.
- If the API call fails, the request can fall back to YT Music.

Fallback path (YT Music via `ytmusicapi`):
- Requires `YTMUSIC_HEADERS_PATH` to a headers JSON file.
- Runs `scripts/ytmusic_search.py` with `python` (override via `YTMUSIC_PYTHON`).
- Calls `ytmusicapi` search with `filter="songs"` and `limit=8`.

YT Music setup:
1. Install the Python dependency: `pip install -r scripts/requirements.txt`.
2. Generate a headers JSON file using `ytmusicapi` from a logged-in browser
   session (see ytmusicapi docs for the exact command).
3. Set `YTMUSIC_HEADERS_PATH` to the headers JSON file path.
4. Optional: set `YTMUSIC_PYTHON` if your Python binary is not `python`.

## Project Structure
- `app/` Next.js App Router UI
- `convex/` Convex schema + server functions
- `.env.example` environment template

## Scripts
- `pnpm dev` Next.js dev server
- `pnpm build` Production build
- `pnpm start` Start production server
- `pnpm convex:dev` Run Convex dev

## Notes
- The Convex functions are minimal scaffolding and safe to extend.
- Replace placeholder UI with room, queue, and host dashboards as needed.

## License
TBD

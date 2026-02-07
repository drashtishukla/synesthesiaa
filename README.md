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

### YouTube Search (API)
To enable search inside rooms:
- Create a YouTube Data API key.
- Add `YOUTUBE_API_KEY` to `.env.local`.

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

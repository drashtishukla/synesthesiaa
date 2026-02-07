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

### Spotify Search (Optional)
To enable Spotify search in rooms:
- Create a Spotify app in the Spotify Developer Dashboard.
- Add `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` to `.env.local`.

### Spotify Playback (Host)
To enable host playback controls:
- Set `SPOTIFY_REDIRECT_URI` (e.g. `http://localhost:3000/api/spotify/callback`).
- The host must connect a Spotify Premium account (Spotify Connect required).
- Make sure the redirect URI is added in your Spotify app settings.

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

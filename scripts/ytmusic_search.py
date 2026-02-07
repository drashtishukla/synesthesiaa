import json
import sys

from ytmusicapi import YTMusic


def normalize_results(items):
    results = []
    for item in items:
        video_id = item.get("videoId") or item.get("videoId")
        if not video_id:
            continue
        title = item.get("title") or "Unknown title"
        artists = item.get("artists") or []
        channel = ", ".join(
            [artist.get("name") for artist in artists if artist.get("name")]
        )
        if not channel:
            channel = item.get("artist") or item.get("author") or "YouTube Music"
        thumbnails = item.get("thumbnails") or []
        thumbnail_url = None
        if thumbnails:
            thumbnail_url = thumbnails[-1].get("url")
        results.append(
            {
                "id": video_id,
                "title": title,
                "channel": channel,
                "thumbnailUrl": thumbnail_url,
            }
        )
    return results


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: ytmusic_search.py <query> <headers_path>"}))
        sys.exit(1)

    query = sys.argv[1]
    headers_path = sys.argv[2]

    ytmusic = YTMusic(headers_path)
    items = ytmusic.search(query, filter="songs", limit=8)
    results = normalize_results(items)
    print(json.dumps({"results": results}))


if __name__ == "__main__":
    main()

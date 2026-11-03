exports.handler = async (event) => {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "public, max-age=300",
    "access-control-allow-origin": "*"
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers };
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return { statusCode: 503, headers, body: JSON.stringify({ error: "YouTube catalogue is not configured yet. Add YOUTUBE_API_KEY in Netlify environment variables." }) };
  const q = String(event.queryStringParameters?.q || "free full movies").trim().slice(0, 100);
  const pageToken = String(event.queryStringParameters?.pageToken || "").slice(0, 200);
  try {
    const params = new URLSearchParams({
      part: "snippet", type: "video", maxResults: "24", q: q + " full movie",
      videoEmbeddable: "true", videoSyndicated: "true", videoDuration: "long",
      safeSearch: "moderate", order: "relevance", key
    });
    if (pageToken) params.set("pageToken", pageToken);
    const response = await fetch("https://www.googleapis.com/youtube/v3/search?" + params);
    const data = await response.json();
    if (!response.ok) return { statusCode: response.status, headers, body: JSON.stringify({ error: data.error?.message || "Video search failed" }) };
    const items = (data.items || []).filter(x => x.id?.videoId).map(x => ({
      id: x.id.videoId, title: x.snippet.title, description: x.snippet.description,
      channel: x.snippet.channelTitle, publishedAt: x.snippet.publishedAt,
      poster: x.snippet.thumbnails?.high?.url || x.snippet.thumbnails?.medium?.url || "",
      source: "YouTube"
    }));
    return { statusCode: 200, headers, body: JSON.stringify({ items, nextPageToken: data.nextPageToken || null, source: "YouTube" }) };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Unable to contact the video catalogue." }) };
  }
};

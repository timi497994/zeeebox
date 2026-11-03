exports.handler = async (event) => {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "public, max-age=300",
    "access-control-allow-origin": "*"
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers };
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return { statusCode: 503, headers, body: JSON.stringify({ error: "YouTube catalogue is not configured yet. Add YOUTUBE_API_KEY in Netlify environment variables." }) };
  const requestedCategory = String(event.queryStringParameters?.q || "popular").trim().slice(0, 100);
  const categoryQueries = {
    popular: "free full length movies official channel",
    nollywood: "Nollywood full length movie official channel",
    hollywood: "Hollywood free full length movie official channel",
    african: "African cinema full length movie official channel",
    classics: "public domain classic feature film full movie",
    documentaries: "free full length documentary official channel"
  };
  const q = categoryQueries[requestedCategory.toLowerCase()] || requestedCategory;
  const pageToken = String(event.queryStringParameters?.pageToken || "").slice(0, 200);
  try {
    const params = new URLSearchParams({
      part: "snippet", type: "video", maxResults: "24", q,
      videoEmbeddable: "true", videoSyndicated: "true", videoDuration: "long",
      safeSearch: "moderate", order: "relevance", key
    });
    if (pageToken) params.set("pageToken", pageToken);
    const response = await fetch("https://www.googleapis.com/youtube/v3/search?" + params);
    const data = await response.json();
    if (!response.ok) return { statusCode: response.status, headers, body: JSON.stringify({ error: data.error?.message || "Video search failed" }) };
    const found = (data.items || []).filter(x => x.id?.videoId);
    let playableIds = new Set();
    if (found.length) {
      const detailParams = new URLSearchParams({ part: "contentDetails,status", id: found.map(x => x.id.videoId).join(","), key });
      const detailResponse = await fetch("https://www.googleapis.com/youtube/v3/videos?" + detailParams);
      const detailData = await detailResponse.json();
      if (!detailResponse.ok) return { statusCode: detailResponse.status, headers, body: JSON.stringify({ error: detailData.error?.message || "Could not verify video availability" }) };
      playableIds = new Set((detailData.items || []).filter(v => {
        if (v.status?.embeddable !== true || v.status?.privacyStatus !== "public") return false;
        const restriction = v.contentDetails?.regionRestriction;
        if (restriction?.blocked?.includes("NG")) return false;
        if (Array.isArray(restriction?.allowed) && !restriction.allowed.includes("NG")) return false;
        return true;
      }).map(v => v.id));
    }
    const items = found.filter(x => playableIds.has(x.id.videoId)).map(x => ({
      id: x.id.videoId, title: x.snippet.title, description: x.snippet.description,
      channel: x.snippet.channelTitle, publishedAt: x.snippet.publishedAt,
      poster: x.snippet.thumbnails?.high?.url || x.snippet.thumbnails?.medium?.url || "",
      source: "YouTube · Nigeria region checked"
    }));
    return { statusCode: 200, headers, body: JSON.stringify({ items, nextPageToken: data.nextPageToken || null, source: "YouTube" }) };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Unable to contact the video catalogue." }) };
  }
};

const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: HEADERS });
}

export async function onRequestGet({ params, env }) {
  if (!env.DB) {
    return json({ error: "D1 binding DB is not configured." }, 503);
  }

  const id = String(params.id || "");
  if (!/^[a-f0-9]{32}$/.test(id)) {
    return json({ error: "分享链接格式不正确。" }, 400);
  }

  const row = await env.DB.prepare(
    "SELECT scores_json FROM survey_results WHERE id = ? LIMIT 1",
  )
    .bind(id)
    .first();

  if (!row) {
    return json({ error: "没有找到这份结果。" }, 404);
  }

  return json({ result: JSON.parse(row.scores_json) });
}

export async function onRequestPost() {
  return json({ error: "Use POST /api/results to create a shared result." }, 405);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: HEADERS });
}

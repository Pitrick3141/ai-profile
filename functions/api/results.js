import { QUESTIONS } from "../../public/questionnaire.js";
import { normalizeAnswers, normalizeOrder, scoreQuestionnaire } from "../../public/scoring.js";

const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: HEADERS });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) {
    return json({ error: "D1 binding DB is not configured." }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "请求体必须是 JSON。" }, 400);
  }

  const answers = normalizeAnswers(body.answers);
  if (Object.keys(answers).length !== QUESTIONS.length) {
    return json({ error: `需要完整提交 ${QUESTIONS.length} 道题。` }, 400);
  }

  const durationMs = Number.isFinite(Number(body.durationMs)) ? Math.max(0, Math.round(Number(body.durationMs))) : null;
  const order = normalizeOrder(body.order, QUESTIONS.length);
  const scored = scoreQuestionnaire(QUESTIONS, answers, { durationMs, order });
  if (!scored.validity.complete) {
    return json({ error: "问卷尚未完整作答。" }, 400);
  }

  const { lookup, ...publicScores } = scored;
  const id = makeShareId();
  const createdAt = new Date().toISOString();
  const result = {
    id,
    createdAt,
    ...publicScores,
  };

  try {
    await env.DB.prepare(
      `INSERT INTO survey_results (
        id,
        created_at,
        questionnaire_version,
        completed_questions,
        duration_ms,
        answers_json,
        question_order_json,
        scores_json,
        user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        createdAt,
        scored.version,
        scored.completedQuestions,
        durationMs,
        JSON.stringify(answers),
        JSON.stringify(order),
        JSON.stringify(result),
        (request.headers.get("User-Agent") || "").slice(0, 300),
      )
      .run();
  } catch (error) {
    return json({ error: `D1 写入失败：${error.message || "unknown error"}` }, 500);
  }

  return json({
    id,
    sharePath: `/result/${id}`,
    result,
  });
}

export async function onRequestGet() {
  return json({ error: "Use GET /api/results/:id to read a shared result." }, 405);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: HEADERS });
}

function makeShareId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

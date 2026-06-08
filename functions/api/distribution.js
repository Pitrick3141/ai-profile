import { DIMENSION_MEANINGS, SUBDIMENSION_INFO, levelForRaw, round } from "../../public/scoring.js";

const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const MAX_RESULTS = 5000;
const SCORE_BANDS = [
  { label: "0-2", min: 0, max: 2 },
  { label: "2-4", min: 2, max: 4 },
  { label: "4-6", min: 4, max: 6 },
  { label: "6-8", min: 6, max: 8 },
  { label: "8-10", min: 8, max: 10 },
];

const DIMENSION_NAMES = Object.keys(DIMENSION_MEANINGS);
const SUBDIMENSION_NAMES = Object.keys(SUBDIMENSION_INFO);

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: HEADERS });
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) {
    return json({ error: "D1 binding DB is not configured." }, 503);
  }

  const url = new URL(request.url);
  const id = String(url.searchParams.get("id") || "");
  if (id && !/^[a-f0-9]{32}$/.test(id)) {
    return json({ error: "结果 ID 格式不正确。" }, 400);
  }

  let personalResult = null;
  if (id) {
    const row = await env.DB.prepare("SELECT id, scores_json FROM survey_results WHERE id = ? LIMIT 1")
      .bind(id)
      .first();
    if (!row) {
      return json({ error: "没有找到这份结果。" }, 404);
    }
    personalResult = parseResultRow(row);
  }

  const rows = await env.DB.prepare(
    "SELECT id, scores_json FROM survey_results ORDER BY created_at DESC LIMIT ?",
  )
    .bind(MAX_RESULTS)
    .all();

  const records = (rows.results || []).map(parseResultRow).filter(Boolean);
  if (personalResult && !records.some((record) => record.id === personalResult.id)) {
    records.push(personalResult);
  }

  return json({
    total: records.length,
    generatedAt: new Date().toISOString(),
    sampleLimit: MAX_RESULTS,
    personal: personalResult
      ? {
          id: personalResult.id,
          profileLabel: personalResult.profile?.mainLabel || "",
          testMode: personalResult.testMode || "full",
        }
      : null,
    profileDistribution: buildProfileDistribution(records),
    dimensions: buildScoreDistributions(records, DIMENSION_NAMES, "dimensionScores", personalResult),
    subdimensions: buildScoreDistributions(records, SUBDIMENSION_NAMES, "subdimensionScores", personalResult),
  });
}

export async function onRequestPost() {
  return json({ error: "Use GET /api/distribution to read aggregate distributions." }, 405);
}

function parseResultRow(row) {
  try {
    const result = JSON.parse(row.scores_json);
    if (!result || typeof result !== "object") return null;
    return { ...result, id: result.id || row.id };
  } catch {
    return null;
  }
}

function buildProfileDistribution(records) {
  const counts = new Map();
  for (const record of records) {
    const label = record.profile?.mainLabel || "未知类型";
    counts.set(label, (counts.get(label) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([label, count]) => ({
      label,
      count,
      percent: records.length ? round((count / records.length) * 100, 1) : 0,
    }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "zh-CN"));
}

function buildScoreDistributions(records, names, scoreKey, personalResult) {
  const personalScores = scoreMap(personalResult?.[scoreKey] || []);
  return names.map((name) => {
    const values = records
      .map((record) => scoreMap(record[scoreKey] || []).get(name))
      .filter((value) => Number.isFinite(value));
    const personalRaw = personalScores.get(name);

    return {
      name,
      count: values.length,
      meanRaw: values.length ? round(mean(values), 2) : null,
      mean10: values.length ? round(rawToScore10(mean(values)), 1) : null,
      medianRaw: values.length ? round(median(values), 2) : null,
      median10: values.length ? round(rawToScore10(median(values)), 1) : null,
      levels: buildLevelDistribution(values),
      scoreBands: buildBandDistribution(values),
      personal: buildPersonalPosition(values, personalRaw),
    };
  });
}

function scoreMap(scores) {
  return new Map(
    scores
      .filter((score) => Number.isFinite(Number(score.rawScore)))
      .map((score) => [score.name, Number(score.rawScore)]),
  );
}

function buildLevelDistribution(values) {
  const levels = ["很低", "较低", "中等或不确定", "较高", "很高"];
  return levels.map((level) => {
    const count = values.filter((value) => levelForRaw(value) === level).length;
    return {
      label: level,
      count,
      percent: values.length ? round((count / values.length) * 100, 1) : 0,
    };
  });
}

function buildBandDistribution(values) {
  return SCORE_BANDS.map((band, index) => {
    const count = values.filter((value) => isInBand(rawToScore10(value), band, index)).length;
    return {
      label: band.label,
      min: band.min,
      max: band.max,
      count,
      percent: values.length ? round((count / values.length) * 100, 1) : 0,
    };
  });
}

function buildPersonalPosition(values, personalRaw) {
  if (!Number.isFinite(personalRaw) || !values.length) {
    return null;
  }

  const score10 = rawToScore10(personalRaw);
  const less = values.filter((value) => value < personalRaw).length;
  const equal = values.filter((value) => value === personalRaw).length;
  const greater = values.filter((value) => value > personalRaw).length;

  return {
    rawScore: round(personalRaw, 2),
    score10: round(score10, 1),
    score100: round(((personalRaw - 1) / 6) * 100, 1),
    level: levelForRaw(personalRaw),
    percentile: round(((less + equal * 0.5) / values.length) * 100, 1),
    rankDescending: greater + 1,
    sampleCount: values.length,
    bandLabel: bandForScore10(score10),
  };
}

function bandForScore10(score10) {
  const band = SCORE_BANDS.find((item, index) => isInBand(score10, item, index));
  return band?.label || "";
}

function isInBand(score10, band, index) {
  return index === SCORE_BANDS.length - 1
    ? score10 >= band.min && score10 <= band.max
    : score10 >= band.min && score10 < band.max;
}

function rawToScore10(rawScore) {
  return ((rawScore - 1) / 6) * 10;
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values) {
  const sorted = values.slice().sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: HEADERS });
}

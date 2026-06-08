import { QUESTIONS } from "./questionnaire.js";

export const DEFAULT_TEST_MODE = "brief";

export const TEST_MODES = {
  brief: {
    id: "brief",
    label: "简易版",
    shortLabel: "简易版",
    questionCount: 40,
    estimate: "约 4-6 分钟",
    description: "按原问卷的一级维度比例抽取，覆盖全部 17 个子维度。",
    questionIds: [
      1, 2, 6, 7, 11,
      13, 15, 17, 19, 22, 25, 26,
      30, 31, 34, 36, 38,
      42, 44, 46, 48, 50, 54, 56,
      60, 62, 63, 66, 68, 70, 72, 74, 78, 81,
      84, 87, 89, 91, 94, 97,
    ],
  },
  full: {
    id: "full",
    label: "完整版",
    shortLabel: "完整版",
    questionCount: QUESTIONS.length,
    estimate: "约 8-12 分钟",
    description: "使用完整 98 题，分数稳定性更高，适合正式记录或精细比较。",
    questionIds: QUESTIONS.map((question) => question.id),
  },
};

const QUESTIONS_BY_ID = new Map(QUESTIONS.map((question) => [question.id, question]));

export function normalizeTestMode(mode, fallback = DEFAULT_TEST_MODE) {
  return TEST_MODES[mode] ? mode : fallback;
}

export function getQuestionSet(mode = DEFAULT_TEST_MODE) {
  const normalizedMode = normalizeTestMode(mode);
  const config = TEST_MODES[normalizedMode];
  const questions = config.questionIds
    .map((id) => QUESTIONS_BY_ID.get(id))
    .filter(Boolean);

  return {
    ...config,
    questions,
    questionIds: questions.map((question) => question.id),
  };
}

export function inferQuestionSetFromIds(ids) {
  const normalizedIds = new Set((ids || []).map(Number).filter(Number.isInteger));
  for (const mode of Object.keys(TEST_MODES)) {
    const questionIds = TEST_MODES[mode].questionIds;
    if (questionIds.length === normalizedIds.size && questionIds.every((id) => normalizedIds.has(id))) {
      return getQuestionSet(mode);
    }
  }
  return getQuestionSet("full");
}

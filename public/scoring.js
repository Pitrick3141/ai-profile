export const QUESTIONNAIRE_VERSION = "ai-attitude-six-dimension-v1";

export const LIKERT_OPTIONS = [
  { value: 1, label: "完全不同意" },
  { value: 2, label: "不同意" },
  { value: 3, label: "比较不同意" },
  { value: 4, label: "不确定/一般" },
  { value: 5, label: "比较同意" },
  { value: 6, label: "同意" },
  { value: 7, label: "完全同意" },
];

export const DIMENSION_MEANINGS = {
  威胁感知: "高分表示更强的 AI 风险担忧与个人替代/身份威胁感。",
  技术信任度: "高分表示更相信 AI 的准确性、公平性和稳定性。",
  控制与治理偏好: "高分表示更强的人工控制与治理约束偏好。",
  赋能与采用倾向: "高分表示认为 AI 有用、愿意采用，并相信自己能学会和用好 AI。",
  伦理敏感度: "高分表示高度关注隐私、偏见、透明度、责任归属等伦理问题。",
  人机关系观: "高分表示更强的关系化、伙伴化或拟人化倾向。",
};

export const SUBDIMENSION_INFO = {
  社会风险感: {
    dimension: "威胁感知",
    description: "对 AI 造成社会不平等、虚假信息、系统性风险、权力集中等宏观后果的担忧。",
  },
  个人替代威胁感: {
    dimension: "威胁感知",
    description: "对 AI 替代自身工作、削弱个人价值、冲击职业发展或身份认同的担忧。",
  },
  准确性信任: {
    dimension: "技术信任度",
    description: "相信 AI 输出、判断、建议在多数情境下准确、可靠、可参考的程度。",
  },
  公平性信任: {
    dimension: "技术信任度",
    description: "相信 AI 系统在评价、推荐、分配机会时不会系统性歧视或偏向特定群体的程度。",
  },
  稳定性信任: {
    dimension: "技术信任度",
    description: "相信 AI 系统在不同时间、任务、场景下保持一致和稳定表现的程度。",
  },
  AI自主性接受: {
    dimension: "控制与治理偏好",
    description: "接受 AI 在任务执行、建议生成、部分决策中拥有自主权的程度。",
  },
  监管强度偏好: {
    dimension: "控制与治理偏好",
    description: "支持法律、平台、企业或组织对 AI 进行审查、标识、限制和责任约束的程度。",
  },
  效用感: {
    dimension: "赋能与采用倾向",
    description: "认为 AI 能提升效率、学习、创造力、决策质量和问题解决能力的程度。",
  },
  采用意愿: {
    dimension: "赋能与采用倾向",
    description: "主动尝试、持续使用、把 AI 纳入工作生活流程的意愿。",
  },
  自我效能感: {
    dimension: "赋能与采用倾向",
    description: "相信自己能够理解、学习、配置、判断和有效使用 AI 的程度。",
  },
  隐私: {
    dimension: "伦理敏感度",
    description: "关注 AI 收集、使用、保留、泄露个人数据及敏感信息的程度。",
  },
  偏见: {
    dimension: "伦理敏感度",
    description: "关注 AI 可能产生群体歧视、机会不公或隐性偏差的程度。",
  },
  透明度: {
    dimension: "伦理敏感度",
    description: "要求 AI 决策逻辑、数据来源、生成内容和限制条件可解释、可标识、可追踪的程度。",
  },
  责任归属: {
    dimension: "伦理敏感度",
    description: "关注 AI 错误、损害、误导或高风险决策应由谁承担责任，以及是否存在申诉和审计机制的程度。",
  },
  工具化: {
    dimension: "人机关系观",
    description: "倾向于把 AI 视为功能性工具，而非具有情感、人格或关系意义的对象。",
  },
  伙伴化: {
    dimension: "人机关系观",
    description: "愿意把 AI 视为助手、协作者、教练、长期工作或学习伙伴的程度。",
  },
  "拟人化/情感依赖": {
    dimension: "人机关系观",
    description: "将 AI 视为能理解、陪伴、回应情绪或形成情感连接对象的程度。",
  },
};

const FIRST_DIMENSION_FORMULAS = [
  {
    name: "威胁感知",
    inputs: [{ subdimension: "社会风险感" }, { subdimension: "个人替代威胁感" }],
  },
  {
    name: "技术信任度",
    inputs: [{ subdimension: "准确性信任" }, { subdimension: "公平性信任" }, { subdimension: "稳定性信任" }],
  },
  {
    name: "控制与治理偏好",
    inputs: [
      { subdimension: "AI自主性接受", displayName: "人工控制偏好", transform: "reverse" },
      { subdimension: "监管强度偏好" },
    ],
  },
  {
    name: "赋能与采用倾向",
    inputs: [{ subdimension: "效用感" }, { subdimension: "采用意愿" }, { subdimension: "自我效能感" }],
  },
  {
    name: "伦理敏感度",
    inputs: [{ subdimension: "隐私" }, { subdimension: "偏见" }, { subdimension: "透明度" }, { subdimension: "责任归属" }],
  },
  {
    name: "人机关系观",
    inputs: [
      { subdimension: "工具化", displayName: "关系化倾向", transform: "reverse" },
      { subdimension: "伙伴化" },
      { subdimension: "拟人化/情感依赖" },
    ],
  },
];

const PROFILE_RULES = [
  {
    label: "防御怀疑型",
    priority: 98,
    when: ({ first }) => first["威胁感知"] >= 5 && first["技术信任度"] <= 3.5 && first["赋能与采用倾向"] <= 4,
    summary: "对 AI 风险和替代压力敏感，采用意愿较弱。",
  },
  {
    label: "技术加速型",
    priority: 96,
    when: ({ first }) => first["赋能与采用倾向"] >= 5 && first["技术信任度"] >= 5 && first["控制与治理偏好"] <= 3.5,
    summary: "偏向开放发展和快速部署，对约束需求较低。",
  },
  {
    label: "审慎采用型",
    priority: 94,
    when: ({ first }) => first["赋能与采用倾向"] >= 4.5 && first["伦理敏感度"] >= 5 && first["控制与治理偏好"] >= 5,
    summary: "愿意用 AI，同时强调规则、责任和边界。",
  },
  {
    label: "关系陪伴型",
    priority: 92,
    when: ({ first, sub }) =>
      first["人机关系观"] >= 5 && (sub["伙伴化"] >= 5 || sub["拟人化/情感依赖"] >= 5),
    summary: "较容易接受 AI 作为助手、陪伴者、教练或情绪交流对象。",
  },
  {
    label: "工具主义高效型",
    priority: 90,
    when: ({ first }) => first["赋能与采用倾向"] >= 5 && first["人机关系观"] <= 3.5,
    summary: "愿意使用 AI 提升效率，但不倾向于人格化或情感化 AI。",
  },
  {
    label: "稳健协作型",
    priority: 88,
    when: ({ first }) =>
      first["赋能与采用倾向"] >= 5 &&
      first["技术信任度"] >= 4.5 &&
      first["控制与治理偏好"] >= 4.5 &&
      first["伦理敏感度"] >= 4.5 &&
      first["人机关系观"] >= 4,
    summary: "既愿意把 AI 纳入协作，也保留对质量、责任和边界的持续校准。",
  },
  {
    label: "风险预警型",
    priority: 86,
    when: ({ first }) => first["威胁感知"] >= 5.5 && first["伦理敏感度"] >= 4.8 && first["控制与治理偏好"] >= 4.5,
    summary: "对 AI 的社会后果和治理边界保持高敏感度，倾向提前识别风险。",
  },
  {
    label: "能力建设型",
    priority: 84,
    when: ({ first, sub }) => first["赋能与采用倾向"] >= 4.3 && sub["自我效能感"] <= 3.8 && sub["效用感"] >= 4.5,
    summary: "认可 AI 的价值，但更需要方法、练习和支持来建立使用信心。",
  },
  {
    label: "隐私守门型",
    priority: 82,
    when: ({ sub }) => sub["隐私"] >= 5.6,
    summary: "对数据收集、敏感信息和使用边界格外谨慎，重视可控的隐私保护。",
  },
  {
    label: "透明审查型",
    priority: 80,
    when: ({ sub }) => sub["透明度"] >= 5.6 && sub["责任归属"] >= 5,
    summary: "希望 AI 的依据、限制和责任链条可解释、可追踪、可申诉。",
  },
  {
    label: "自主实验型",
    priority: 78,
    when: ({ first, sub }) => sub["AI自主性接受"] >= 5 && first["控制与治理偏好"] <= 4.2 && first["赋能与采用倾向"] >= 4.8,
    summary: "愿意尝试更自动化的 AI 流程，倾向在实践中快速验证边界。",
  },
  {
    label: "实用探索型",
    priority: 76,
    when: ({ first }) =>
      first["赋能与采用倾向"] >= 4.3 &&
      first["赋能与采用倾向"] < 5.3 &&
      first["技术信任度"] >= 3.8 &&
      first["威胁感知"] <= 5,
    summary: "愿意尝试有明确收益的 AI 用法，同时保留观察和筛选。",
  },
  {
    label: "冷静旁观型",
    priority: 74,
    when: ({ first }) => first["赋能与采用倾向"] <= 3.8 && first["威胁感知"] <= 4.5 && first["人机关系观"] <= 4.2,
    summary: "对 AI 不急于投入，也不一定强烈排斥，更倾向保持距离观察。",
  },
  {
    label: "伦理监管型",
    priority: 72,
    when: ({ first }) => first["伦理敏感度"] >= 5.5 && first["控制与治理偏好"] >= 5,
    summary: "高度关注隐私、公平、透明和责任问题。",
  },
  {
    label: "积极采用型",
    priority: 70,
    when: ({ first }) => first["赋能与采用倾向"] >= 5 && first["技术信任度"] >= 4.5 && first["威胁感知"] <= 4.5,
    summary: "认为 AI 有价值，也愿意在实际生活或工作中使用。",
  },
];

export function normalizeAnswers(answers) {
  const normalized = {};
  if (!answers || typeof answers !== "object") {
    return normalized;
  }

  for (const [key, value] of Object.entries(answers)) {
    const id = Number(key);
    const score = Number(value);
    if (Number.isInteger(id) && Number.isInteger(score) && score >= 1 && score <= 7) {
      normalized[id] = score;
    }
  }
  return normalized;
}

export function normalizeOrder(order, questionCount) {
  if (!Array.isArray(order)) {
    return [];
  }

  const seen = new Set();
  const normalized = [];
  for (const raw of order) {
    const id = Number(raw);
    if (Number.isInteger(id) && id >= 1 && id <= questionCount && !seen.has(id)) {
      seen.add(id);
      normalized.push(id);
    }
  }
  return normalized;
}

export function scoreQuestionnaire(questions, answers, meta = {}) {
  const normalizedAnswers = normalizeAnswers(answers);
  const expectedWeights = {};
  const scoredWeights = {};
  const numerators = {};
  const answeredQuestionIds = new Set();

  for (const question of questions) {
    const rawAnswer = normalizedAnswers[question.id];
    if (rawAnswer !== undefined) {
      answeredQuestionIds.add(question.id);
    }

    for (const link of question.scoring) {
      expectedWeights[link.subdimension] = (expectedWeights[link.subdimension] || 0) + link.weight;
      if (rawAnswer === undefined) {
        continue;
      }

      const scored = link.direction === "反向" ? 8 - rawAnswer : rawAnswer;
      numerators[link.subdimension] = (numerators[link.subdimension] || 0) + scored * link.weight;
      scoredWeights[link.subdimension] = (scoredWeights[link.subdimension] || 0) + link.weight;
    }
  }

  const subdimensionScores = Object.keys(SUBDIMENSION_INFO).map((name) => {
    const expectedWeight = expectedWeights[name] || 0;
    const answeredWeight = scoredWeights[name] || 0;
    const rawScore = answeredWeight > 0 ? numerators[name] / answeredWeight : null;
    const valid = expectedWeight > 0 && answeredWeight / expectedWeight >= 0.7;
    return {
      name,
      dimension: SUBDIMENSION_INFO[name].dimension,
      description: SUBDIMENSION_INFO[name].description,
      rawScore,
      score100: rawScore === null ? null : toScore100(rawScore),
      level: rawScore === null ? "数据不足" : levelForRaw(rawScore),
      valid,
      answeredWeight: round(answeredWeight, 2),
      expectedWeight: round(expectedWeight, 2),
    };
  });

  const subByName = Object.fromEntries(subdimensionScores.map((item) => [item.name, item]));
  const dimensionScores = FIRST_DIMENSION_FORMULAS.map((formula) => {
    const transformedInputs = formula.inputs.map((input) => {
      const source = subByName[input.subdimension];
      const rawScore = source?.rawScore ?? null;
      const transformedScore = rawScore === null ? null : input.transform === "reverse" ? 8 - rawScore : rawScore;
      return {
        name: input.displayName || input.subdimension,
        sourceName: input.subdimension,
        rawScore: transformedScore,
        score100: transformedScore === null ? null : toScore100(transformedScore),
        valid: Boolean(source?.valid) && transformedScore !== null,
      };
    });
    const validInputs = transformedInputs.filter((input) => input.valid);
    const valid = transformedInputs.length > 0 && validInputs.length / transformedInputs.length >= 0.7;
    const rawScore = validInputs.length ? mean(validInputs.map((input) => input.rawScore)) : null;

    return {
      name: formula.name,
      rawScore,
      score100: rawScore === null ? null : toScore100(rawScore),
      level: rawScore === null ? "数据不足" : levelForRaw(rawScore),
      valid,
      meaning: DIMENSION_MEANINGS[formula.name],
      inputs: transformedInputs,
    };
  });

  const dimensionByName = Object.fromEntries(
    dimensionScores.map((item) => [item.name, item.rawScore === null ? null : item.rawScore]),
  );
  const subdimensionByName = Object.fromEntries(
    subdimensionScores.map((item) => [item.name, item.rawScore === null ? null : item.rawScore]),
  );
  const profile = deriveProfile(dimensionScores, subdimensionScores);
  const completedQuestions = answeredQuestionIds.size;
  const completionRate = questions.length ? completedQuestions / questions.length : 0;
  const order = normalizeOrder(meta.order, questions.length);
  const longestSameRun = longestRun(normalizedAnswers, order.length ? order : questions.map((question) => question.id));
  const durationMs = Number.isFinite(Number(meta.durationMs)) ? Math.max(0, Math.round(Number(meta.durationMs))) : null;

  return {
    version: QUESTIONNAIRE_VERSION,
    completedQuestions,
    questionCount: questions.length,
    completionRate,
    durationMs,
    dimensionScores,
    subdimensionScores,
    profile,
    validity: {
      complete: completedQuestions === questions.length,
      enoughAnswered: completionRate >= 0.9,
      longestSameRun,
      straightLineWarning: longestSameRun >= 20,
      tooFastWarning: durationMs !== null && durationMs < 180000,
      validDimensionCount: dimensionScores.filter((item) => item.valid).length,
      validSubdimensionCount: subdimensionScores.filter((item) => item.valid).length,
    },
    lookup: {
      first: dimensionByName,
      sub: subdimensionByName,
    },
  };
}

export function deriveProfile(dimensionScores, subdimensionScores) {
  const first = Object.fromEntries(
    dimensionScores.map((item) => [item.name, item.rawScore === null ? null : item.rawScore]),
  );
  const sub = Object.fromEntries(
    subdimensionScores.map((item) => [item.name, item.rawScore === null ? null : item.rawScore]),
  );
  const labels = PROFILE_RULES.filter((rule) => safeRule(rule, { first, sub }))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
    .map((rule) => ({
      label: rule.label,
      summary: rule.summary,
    }));
  const rankedDimensions = dimensionScores
    .filter((item) => item.rawScore !== null)
    .slice()
    .sort((a, b) => b.rawScore - a.rawScore);
  const high = rankedDimensions.slice(0, 3);
  const low = rankedDimensions.slice(-3).reverse();
  const mainLabel = labels[0]?.label || "均衡观察型";
  const mainSummary =
    labels[0]?.summary ||
    "各维度没有落入明显单一标签，更适合结合高低分组合来理解当前 AI 态度。";

  return {
    labels,
    mainLabel,
    mainSummary,
    topDimensions: high.map(compactScore),
    lowDimensions: low.map(compactScore),
    narrative: buildNarrative(mainLabel, mainSummary, high, low),
  };
}

export function toScore100(rawScore) {
  return round(((rawScore - 1) / 6) * 100, 1);
}

export function toScore10(rawScore) {
  return round(((rawScore - 1) / 6) * 10, 1);
}

export function levelForRaw(rawScore) {
  if (rawScore === null || Number.isNaN(rawScore)) return "数据不足";
  if (rawScore < 2.5) return "很低";
  if (rawScore < 3.5) return "较低";
  if (rawScore < 4.5) return "中等或不确定";
  if (rawScore < 5.5) return "较高";
  return "很高";
}

export function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function mean(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function compactScore(item) {
  return {
    name: item.name,
    rawScore: round(item.rawScore, 2),
    score100: toScore100(item.rawScore),
    score10: toScore10(item.rawScore),
    level: item.level,
  };
}

function safeRule(rule, scoreMaps) {
  try {
    return rule.when(scoreMaps);
  } catch {
    return false;
  }
}

function buildNarrative(label, summary, high, low) {
  const highText = high.length ? high.map((item) => `${item.name}${formatScore10Text(item.rawScore)}`).join("、") : "暂无";
  const lowText = low.length ? low.map((item) => `${item.name}${formatScore10Text(item.rawScore)}`).join("、") : "暂无";
  return `${label}：${summary} 当前高分维度为 ${highText}；相对低分维度为 ${lowText}。这些结果描述的是当下态度画像，不是固定人格判断。`;
}

function formatScore10Text(rawScore) {
  return `${toScore10(rawScore).toFixed(1)}/10`;
}

function longestRun(answers, order) {
  let longest = 0;
  let current = 0;
  let previous = null;

  for (const questionId of order) {
    const value = answers[questionId];
    if (value === undefined) {
      current = 0;
      previous = null;
      continue;
    }
    if (value === previous) {
      current += 1;
    } else {
      current = 1;
      previous = value;
    }
    longest = Math.max(longest, current);
  }

  return longest;
}

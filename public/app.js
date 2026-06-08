import { QUESTIONS } from "./questionnaire.js";
import { DEFAULT_TEST_MODE, TEST_MODES, getQuestionSet, inferQuestionSetFromIds, normalizeTestMode } from "./questionSets.js";
import { LIKERT_OPTIONS, round, scoreQuestionnaire } from "./scoring.js";

const STORAGE_KEY = "ai-attitude-questionnaire-state-v1";
const ROLE_VARIANT_KEY = "ai-attitude-role-variant-v1";
const app = document.querySelector("#app");
const questionsById = new Map(QUESTIONS.map((question) => [question.id, question]));

const PROFILE_VISUALS = {
  防御怀疑型: {
    asset: "/assets/role-defensive-skeptic.webp",
    accent: "#7f2d2d",
    soft: "#f4e6e2",
    title: "风险边界观察者",
  },
  技术加速型: {
    asset: "/assets/role-tech-accelerator.webp",
    accent: "#0f766e",
    soft: "#dff4ec",
    title: "快速部署推动者",
  },
  审慎采用型: {
    asset: "/assets/role-cautious-adopter.webp",
    accent: "#9a620e",
    soft: "#fff2df",
    title: "规则感采用者",
  },
  关系陪伴型: {
    asset: "/assets/role-relational-companion.webp",
    accent: "#be4b43",
    soft: "#fde8e2",
    title: "关系型协作者",
  },
  工具主义高效型: {
    asset: "/assets/role-pragmatic-efficiency.webp",
    accent: "#334155",
    soft: "#e8eef0",
    title: "效率工具派",
  },
  稳健协作型: {
    asset: "/assets/role-balanced-collaborator.webp",
    accent: "#526d42",
    soft: "#edf3e7",
    title: "稳健协作派",
  },
  风险预警型: {
    asset: "/assets/role-risk-sentinel.webp",
    accent: "#b45309",
    soft: "#fff3d6",
    title: "前置风险哨兵",
  },
  能力建设型: {
    asset: "/assets/role-capability-builder.webp",
    accent: "#256f8f",
    soft: "#e1f2f6",
    title: "能力成长者",
  },
  隐私守门型: {
    asset: "/assets/role-privacy-guardian.webp",
    accent: "#047857",
    soft: "#def4ea",
    title: "数据边界守门人",
  },
  透明审查型: {
    asset: "/assets/role-transparency-auditor.webp",
    accent: "#256e8d",
    soft: "#e3f1f5",
    title: "透明度审查者",
  },
  自主实验型: {
    asset: "/assets/role-autonomous-experimenter.webp",
    accent: "#0d9488",
    soft: "#daf7ed",
    title: "自主流程实验者",
  },
  实用探索型: {
    asset: "/assets/role-practical-explorer.webp",
    accent: "#8a6f18",
    soft: "#f5efd7",
    title: "实用探索者",
  },
  冷静旁观型: {
    asset: "/assets/role-calm-observer.webp",
    accent: "#60716b",
    soft: "#e9efeb",
    title: "冷静观察者",
  },
  伦理监管型: {
    asset: "/assets/role-ethics-regulator.webp",
    accent: "#93640f",
    soft: "#f7edcf",
    title: "伦理监管者",
  },
  积极采用型: {
    asset: "/assets/role-active-adopter.webp",
    accent: "#2f7d32",
    soft: "#e3f3df",
    title: "积极采用者",
  },
  均衡观察型: {
    asset: "/assets/role-balanced-observer.webp",
    accent: "#56766a",
    soft: "#e8f0eb",
    title: "均衡观察者",
  },
};

let surveyState = loadSurveyState();
let sharedState = null;
let saveInFlight = false;
let copyMessage = "";
let selectedRoleVariant = loadRoleVariant();
let shareImageMessage = "";
let distributionState = { id: "", status: "idle", data: null, error: "" };

window.addEventListener("popstate", renderRoute);
window.addEventListener("keydown", handleKeydown);
app.addEventListener("click", handleClick);

renderRoute();

function renderRoute() {
  const sharedId = getSharedId();
  if (sharedId) {
    if (!sharedState || sharedState.id !== sharedId) {
      sharedState = { id: sharedId, status: "loading", result: null, error: "" };
      renderSharedResult();
      fetchSharedResult(sharedId);
      return;
    }
    renderSharedResult();
    return;
  }

  sharedState = null;
  surveyState = surveyState || createSurveyState();
  if (isComplete(surveyState) && !surveyState.completedAt) {
    surveyState.completedAt = Date.now();
    saveSurveyState();
  }
  renderSurveyOrResult();
}

function renderSurveyOrResult() {
  if (!surveyState.hasStarted && !hasAnyAnswer(surveyState)) {
    app.innerHTML = renderLanding();
    return;
  }

  if (isComplete(surveyState)) {
    const result = currentScore();
    if (surveyState.savedId) {
      result.id = surveyState.savedId;
    }
    app.innerHTML = renderReport(result, {
      mode: "personal",
      saveStatus: surveyState.saveStatus || "idle",
      shareUrl: surveyState.shareUrl || "",
      savedId: surveyState.savedId || "",
      copyMessage,
    });
    if ((!surveyState.saveStatus || surveyState.saveStatus === "idle") && !saveInFlight) {
      queueMicrotask(() => persistResult());
    }
    queueMicrotask(() => ensureDistribution(result));
    return;
  }

  app.innerHTML = renderSurvey();
}

function renderLanding() {
  return `
    <section class="landing-page">
      <div class="landing-hero">
        <div class="landing-copy">
          <span class="landing-kicker">AI Attitude Profile</span>
          <h1>AI 态度六维画像问卷</h1>
          <p>通过 7 点量表题，了解你对 AI 的风险、信任、治理、采用、伦理和人机关系的当前态度画像。</p>
          <div class="mode-choice" role="group" aria-label="选择问卷版本">
            ${Object.values(TEST_MODES)
              .map(
                (mode) => `
                  <button class="mode-option ${mode.id === DEFAULT_TEST_MODE ? "is-recommended" : ""}" type="button" data-action="begin-survey" data-mode="${escapeAttribute(mode.id)}">
                    <strong>${escapeHtml(mode.label)}</strong>
                    <span>${mode.questionCount} 题 · ${escapeHtml(mode.estimate)}</span>
                    <small>${escapeHtml(mode.description)}</small>
                  </button>
                `,
              )
              .join("")}
          </div>
          <div class="landing-actions">
            <span class="landing-note">题目随机呈现 · 完成后生成分享链接 · 可查看总体分布和个人位置</span>
          </div>
        </div>
      </div>
      <div class="landing-summary" aria-label="问卷说明">
        <div>
          <strong>六个一级维度</strong>
          <span>威胁感知、技术信任度、控制与治理偏好、赋能与采用倾向、伦理敏感度、人机关系观。</span>
        </div>
        <div>
          <strong>即时计算结果</strong>
          <span>完成后展示雷达图、子维度明细、高低分组合和谨慎的画像标签。</span>
        </div>
        <div>
          <strong>可分享报告</strong>
          <span>结果保存到 D1 数据库，其他人可以通过链接查看结果并开始自己的测试。</span>
        </div>
      </div>
    </section>
  `;
}

function renderSurvey() {
  const questionSet = currentQuestionSet();
  const questions = questionSet.questions;
  const answered = answeredCount(surveyState);
  const total = questions.length;
  const progress = Math.round((answered / total) * 1000) / 10;
  const currentQuestionId = surveyState.order[surveyState.currentIndex];
  const question = questionsById.get(currentQuestionId);
  const selectedValue = surveyState.answers[question.id];

  return `
    <header class="topbar">
      <div class="brand">
        <h1>AI 态度六维画像问卷</h1>
        <p>${escapeHtml(questionSet.label)} · ${total} 个陈述，7 点量表。结果会生成六个一级维度、17 个子维度、画像标签和可分享报告。</p>
      </div>
      <div class="status-strip" aria-label="作答进度">
        <div class="status-number">
          <span>${answered} / ${total}</span>
          <strong>${progress}%</strong>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>
      </div>
    </header>

    <section class="survey-layout">
      <article class="question-panel">
        <div class="question-meta">
          <span class="pill">第 ${surveyState.currentIndex + 1} / ${total} 题</span>
        </div>
        <h2 class="question-text">${escapeHtml(question.text)}</h2>
        <div class="scale-grid" role="radiogroup" aria-label="同意程度">
          ${LIKERT_OPTIONS.map((option) => renderScaleButton(option, selectedValue)).join("")}
        </div>
        <div class="question-actions">
          <div class="button-group">
            <button class="btn subtle" type="button" data-action="next-unanswered">下一道未答题</button>
            <button class="btn warning" type="button" data-action="reset">重新开始</button>
          </div>
          <div class="button-group">
            <button class="btn" type="button" data-action="prev" ${surveyState.currentIndex === 0 ? "disabled" : ""}>上一题</button>
            <button class="btn primary" type="button" data-action="next">
              ${surveyState.currentIndex === total - 1 ? "完成" : "下一题"}
            </button>
          </div>
        </div>
      </article>

      <aside class="side-panel">
        <h2>题目导航</h2>
        <div class="question-map">
          ${surveyState.order.map((id, index) => renderMapDot(id, index)).join("")}
        </div>
        <div class="legend" aria-hidden="true">
          <span class="legend-item"><span class="legend-swatch current"></span>当前</span>
          <span class="legend-item"><span class="legend-swatch answered"></span>已答</span>
          <span class="legend-item"><span class="legend-swatch"></span>未答</span>
        </div>
      </aside>
    </section>
  `;
}

function renderScaleButton(option, selectedValue) {
  const selected = option.value === selectedValue;
  return `
    <button
      class="scale-button ${selected ? "is-selected" : ""}"
      type="button"
      data-action="answer"
      data-value="${option.value}"
      aria-pressed="${selected ? "true" : "false"}"
    >
      <strong>${option.value}</strong>
      <span>${escapeHtml(option.label)}</span>
    </button>
  `;
}

function renderMapDot(questionId, index) {
  const answered = surveyState.answers[questionId] !== undefined;
  const current = surveyState.currentIndex === index;
  const label = `第 ${index + 1} 题，${answered ? "已答" : "未答"}`;
  return `
    <button
      class="map-dot ${answered ? "is-answered" : ""} ${current ? "is-current" : ""}"
      type="button"
      data-action="jump"
      data-index="${index}"
      aria-label="${label}"
    ></button>
  `;
}

function renderSharedResult() {
  if (sharedState.status === "loading") {
    app.innerHTML = `
      <section class="loading">
        <div>
          <strong>正在读取分享结果</strong>
          <span>稍等片刻。</span>
        </div>
      </section>
    `;
    return;
  }

  if (sharedState.status === "error") {
    app.innerHTML = `
      <section class="notice-panel">
        <h1>没有找到这份结果</h1>
        <p>${escapeHtml(sharedState.error || "分享链接可能已经失效，或后端数据库暂时不可用。")}</p>
        <button class="btn primary" type="button" data-action="start-own-test">开始我的测试</button>
      </section>
    `;
    return;
  }

  const shareUrl = absoluteResultUrl(sharedState.result.id);
  app.innerHTML = renderReport(sharedState.result, {
    mode: "shared",
    saveStatus: "shared",
    shareUrl,
    savedId: sharedState.result.id,
    copyMessage,
  });
  queueMicrotask(() => ensureDistribution(sharedState.result));
}

function renderReport(result, options) {
  const dimensions = result.dimensionScores || [];
  const subdimensions = result.subdimensionScores || [];
  const primaryLabel = result.profile?.mainLabel || "均衡观察型";
  const visual = getProfileVisual(primaryLabel);
  const labels = result.profile?.labels?.length
    ? result.profile.labels
    : [{ label: primaryLabel }];
  const metaText = result.createdAt ? `生成于 ${formatDate(result.createdAt)}` : formatDuration(result.durationMs);
  const questionSetText = result.questionSetLabel || TEST_MODES[result.testMode]?.label || "";
  const detailMeta = [questionSetText, metaText].filter(Boolean).join(" · ");

  return `
    <header class="topbar">
      <div class="brand">
        <h1>AI 态度六维画像问卷</h1>
        <p>${escapeHtml(detailMeta)}</p>
      </div>
      <div class="button-group">
        <button class="btn primary" type="button" data-action="start-own-test">开始我的测试</button>
        ${options.mode === "personal" ? `<button class="btn warning" type="button" data-action="reset">重新开始</button>` : ""}
      </div>
    </header>

    <section class="result-panel">
      <div class="report-header">
        <div class="report-title">
          <div class="label-stack">
            ${labels.map((item) => `<span class="profile-label">${escapeHtml(item.label)}</span>`).join("")}
          </div>
          <h1>${escapeHtml(result.profile?.mainLabel || "AI 态度画像")}</h1>
          <p>${escapeHtml(reportNarrative(result))}</p>
        </div>
        <div class="report-visual-stack">
          ${renderCharacterPanel(primaryLabel, visual)}
          <div class="chart-shell">${renderRadarChart(dimensions)}</div>
        </div>
      </div>

      <div class="report-grid">
        <div class="score-section">
          <h2>六个一级维度</h2>
          <div class="score-list">
            ${dimensions.map(renderDimensionRow).join("")}
          </div>
        </div>

        <div class="score-section">
          <h2>高低分组合</h2>
          ${renderInsightList("高分特征", result.profile?.topDimensions || [])}
          ${renderInsightList("相对低分", result.profile?.lowDimensions || [])}
          ${renderValidity(result.validity)}
        </div>

        <div class="share-box">
          ${renderShareBox(options)}
        </div>

        ${renderDistributionPanel(result)}

        <div class="detail-section">
          <h2>17 个子维度</h2>
          <div class="detail-grid">
            ${subdimensions.map(renderSubdimension).join("")}
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderDimensionRow(dimension) {
  const score100 = dimension.score100 ?? 0;
  return `
    <div class="score-row">
      <div class="score-head">
        <span class="score-name">${escapeHtml(dimension.name)}</span>
        <span class="score-value">${formatScore10(dimension)} · ${escapeHtml(dimension.level)}</span>
      </div>
      <div class="bar-track"><div class="bar-fill" style="width:${clamp(score100, 0, 100)}%"></div></div>
      <div class="score-note">${escapeHtml(dimension.meaning || "")}</div>
    </div>
  `;
}

function renderCharacterPanel(label, visual) {
  const nextVariant = selectedRoleVariant === 1 ? 2 : 1;
  return `
    <div class="character-panel" style="--role-accent:${escapeAttribute(visual.accent)}; --role-soft:${escapeAttribute(visual.soft)}">
      <div class="character-head">
        <div>
          <span>画像角色</span>
          <strong>${escapeHtml(visual.title)}</strong>
        </div>
      </div>
      <div class="character-stage" aria-label="${escapeAttribute(label)}角色">
        <div class="character-sprite variant-${selectedRoleVariant}" style="background-image:url('${escapeAttribute(visual.asset)}')"></div>
      </div>
      <div class="role-toggle">
        <button type="button" data-action="select-role" data-variant="${nextVariant}" aria-label="切换画像角色">切换角色</button>
      </div>
    </div>
  `;
}

function renderSubdimension(item) {
  return `
    <div class="sub-score">
      <strong>${escapeHtml(item.name)} · ${formatScore10(item)}</strong>
      <span>${escapeHtml(item.level)}。${escapeHtml(item.description || "")}</span>
    </div>
  `;
}

function renderInsightList(title, items) {
  if (!items.length) {
    return `<div class="insight-group"><h3>${escapeHtml(title)}</h3><p class="empty-message">暂无足够数据。</p></div>`;
  }

  return `
    <div class="insight-group">
      <h3>${escapeHtml(title)}</h3>
      <ul class="insight-list">
        ${items
          .map(
            (item) => `
              <li>
                <span>${escapeHtml(item.name)}</span>
                <strong>${formatScore10(item)}</strong>
              </li>
            `,
          )
          .join("")}
      </ul>
    </div>
  `;
}

function reportNarrative(result) {
  const profile = result.profile || {};
  const highText = formatScoreList(profile.topDimensions || []);
  const lowText = formatScoreList(profile.lowDimensions || []);
  const label = profile.mainLabel || "AI 态度画像";
  const summary = profile.mainSummary || "这些维度描述的是你当前对 AI 的态度组合。";
  return `${label}：${summary} 当前高分维度为 ${highText}；相对低分维度为 ${lowText}。这些结果描述的是当下态度画像，不是固定人格判断。`;
}

function formatScoreList(items) {
  if (!items.length) return "暂无";
  return items.map((item) => `${item.name} ${formatScore10(item)}`).join("、");
}

function renderValidity(validity = {}) {
  const messages = [];
  if (validity.straightLineWarning) {
    messages.push(`连续同一选项最长 ${validity.longestSameRun} 题，正式研究中建议复核。`);
  }
  if (validity.tooFastWarning) {
    messages.push("完成时间较短，正式研究中建议结合场景复核。");
  }
  if (!messages.length) {
    messages.push("这份问卷结果用于态度画像，不作为人格、能力或临床判断。");
  }

  return `<p class="score-note">${messages.map(escapeHtml).join(" ")}</p>`;
}

function renderShareBox(options) {
  if (options.saveStatus === "saving") {
    return `
      <p class="share-title">正在生成分享链接</p>
      <p class="share-message">结果会保存到 Cloudflare D1 数据库。</p>
    `;
  }

  if (options.saveStatus === "error") {
    return `
      <p class="share-title">分享链接尚未生成</p>
      <button class="btn primary" type="button" data-action="retry-save">重试保存</button>
      <p class="share-message error">${escapeHtml(surveyState.saveError || "后端暂时不可用。")}</p>
    `;
  }

  if (!options.shareUrl) {
    return `
      <p class="share-title">分享链接</p>
      <p class="share-message">结果已在本页计算，保存成功后会显示链接。</p>
    `;
  }

  return `
    <p class="share-title">分享链接</p>
    <div class="qr-preview">${renderQrSvg(options.shareUrl)}</div>
    <div class="share-row">
      <input id="share-url" type="text" readonly value="${escapeAttribute(options.shareUrl)}" aria-label="分享链接" />
      <button class="btn primary" type="button" data-action="copy-share" data-copy-value="${escapeAttribute(options.shareUrl)}">复制</button>
    </div>
    <div class="share-row secondary">
      <button class="btn subtle" type="button" data-action="download-share-image" data-share-url="${escapeAttribute(options.shareUrl)}">生成分享截图</button>
    </div>
    <p class="share-message">${escapeHtml(copyMessage || "通过这个链接可以查看结果，也可以开始新的测试。")}</p>
    ${shareImageMessage ? `<p class="share-message">${escapeHtml(shareImageMessage)}</p>` : ""}
  `;
}

function renderDistributionPanel(result) {
  const resultId = result.id || "";
  if (!resultId) {
    return `
      <div class="detail-section distribution-section">
        <h2>总体分布</h2>
        <p class="empty-message">分享链接生成后会显示总体分布和你的相对位置。</p>
      </div>
    `;
  }

  if (distributionState.id !== resultId || distributionState.status === "idle" || distributionState.status === "loading") {
    return `
      <div class="detail-section distribution-section">
        <h2>总体分布</h2>
        <p class="empty-message">正在读取总体分布。</p>
      </div>
    `;
  }

  if (distributionState.status === "error") {
    return `
      <div class="detail-section distribution-section">
        <div class="distribution-head">
          <h2>总体分布</h2>
          <button class="btn subtle" type="button" data-action="reload-distribution" data-result-id="${escapeAttribute(resultId)}">重试</button>
        </div>
        <p class="share-message error">${escapeHtml(distributionState.error || "总体分布暂时不可用。")}</p>
      </div>
    `;
  }

  const data = distributionState.data || {};
  return `
    <div class="detail-section distribution-section">
      <div class="distribution-head">
        <div>
          <h2>总体分布</h2>
          <p>${escapeHtml(data.total ? `基于 ${data.total} 份已保存结果` : "暂无足够结果")}</p>
        </div>
        <button class="btn subtle" type="button" data-action="reload-distribution" data-result-id="${escapeAttribute(resultId)}">刷新</button>
      </div>
      ${renderProfileDistribution(data.profileDistribution || [], result.profile?.mainLabel || data.personal?.profileLabel)}
      ${renderScoreDistributionGroup("六维分数分布", result.dimensionScores || [], data.dimensions || [])}
      ${renderScoreDistributionGroup("17 个子维度位置", result.subdimensionScores || [], data.subdimensions || [], { compact: true })}
    </div>
  `;
}

function renderProfileDistribution(items, personalLabel) {
  if (!items.length) {
    return `<div class="distribution-block"><h3>画像类型分布</h3><p class="empty-message">暂无类型分布。</p></div>`;
  }

  const maxCount = Math.max(...items.map((item) => item.count || 0), 1);
  return `
    <div class="distribution-block">
      <h3>画像类型分布</h3>
      <div class="distribution-list">
        ${items
          .map((item) => {
            const isMine = item.label === personalLabel;
            return `
              <div class="distribution-row ${isMine ? "is-mine" : ""}">
                <div class="distribution-row-head">
                  <span>${escapeHtml(item.label)}</span>
                  <strong>${item.count} · ${formatPercent(item.percent)}</strong>
                </div>
                <div class="distribution-track"><div class="distribution-fill" style="width:${clamp(((item.count || 0) / maxCount) * 100, 0, 100)}%"></div></div>
              </div>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function renderScoreDistributionGroup(title, scores, distributions, options = {}) {
  if (!scores.length) {
    return "";
  }

  const byName = new Map(distributions.map((item) => [item.name, item]));
  return `
    <div class="distribution-block">
      <h3>${escapeHtml(title)}</h3>
      <div class="${options.compact ? "position-grid compact" : "position-grid"}">
        ${scores.map((score) => renderScorePosition(score, byName.get(score.name), options)).join("")}
      </div>
    </div>
  `;
}

function renderScorePosition(score, distribution, options = {}) {
  const personal = distribution?.personal || {};
  const scoreText = formatScore10(score);
  const percentileText = Number.isFinite(personal.percentile)
    ? `第 ${round(personal.percentile, 1).toFixed(1)} 百分位`
    : "暂无位置";
  const sampleText = distribution?.count ? `${distribution.count} 份样本` : "暂无样本";

  return `
    <div class="position-item">
      <div class="position-head">
        <strong>${escapeHtml(score.name)}</strong>
        <span>${scoreText} · ${escapeHtml(percentileText)}</span>
      </div>
      ${options.compact ? "" : renderBandDistribution(distribution?.scoreBands || [], personal.bandLabel)}
      <p>${escapeHtml(sampleText)}${distribution?.mean10 !== null && distribution?.mean10 !== undefined ? ` · 均值 ${round(distribution.mean10, 1).toFixed(1)}/10` : ""}</p>
    </div>
  `;
}

function renderBandDistribution(bands, personalBandLabel) {
  if (!bands.length) {
    return `<div class="band-stack"></div>`;
  }

  const maxCount = Math.max(...bands.map((band) => band.count || 0), 1);
  return `
    <div class="band-stack" aria-label="分数分布">
      ${bands
        .map(
          (band) => `
            <span
              class="band-cell ${band.label === personalBandLabel ? "is-mine" : ""}"
              style="height:${band.count ? clamp(((band.count || 0) / maxCount) * 100, 8, 100) : 0}%"
              title="${escapeAttribute(`${band.label}：${band.count}，${formatPercent(band.percent)}`)}"
            ></span>
          `,
        )
        .join("")}
    </div>
    <div class="band-labels" aria-hidden="true">
      <span>0</span>
      <span>5</span>
      <span>10</span>
    </div>
  `;
}

function renderQrSvg(value) {
  try {
    const matrix = createQrMatrix(value);
    const quiet = 4;
    const size = matrix.length + quiet * 2;
    const cells = [];
    for (let row = 0; row < matrix.length; row += 1) {
      for (let col = 0; col < matrix.length; col += 1) {
        if (matrix[row][col]) {
          cells.push(`M${col + quiet},${row + quiet}h1v1h-1z`);
        }
      }
    }
    return `
      <svg class="qr-svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="分享链接二维码">
        <rect width="${size}" height="${size}" fill="#fff"></rect>
        <path d="${cells.join("")}" fill="#1e2a27"></path>
      </svg>
    `;
  } catch {
    return `<div class="qr-fallback">二维码将在生成分享截图时创建</div>`;
  }
}

function renderRadarChart(dimensions) {
  if (!dimensions.length) {
    return "";
  }

  const cx = 180;
  const cy = 160;
  const radius = 92;
  const axes = dimensions.map((dimension, index) => {
    const angle = -Math.PI / 2 + (index / dimensions.length) * Math.PI * 2;
    const scoreRadius = ((dimension.score100 || 0) / 100) * radius;
    return {
      label: dimension.name,
      axisX: cx + Math.cos(angle) * radius,
      axisY: cy + Math.sin(angle) * radius,
      pointX: cx + Math.cos(angle) * scoreRadius,
      pointY: cy + Math.sin(angle) * scoreRadius,
      labelX: cx + Math.cos(angle) * (radius + 38),
      labelY: cy + Math.sin(angle) * (radius + 28),
      anchor: Math.cos(angle) > 0.25 ? "start" : Math.cos(angle) < -0.25 ? "end" : "middle",
    };
  });
  const polygon = axes.map((axis) => `${axis.pointX},${axis.pointY}`).join(" ");
  const grid = [0.25, 0.5, 0.75, 1]
    .map((scale) => {
      const points = dimensions
        .map((_, index) => {
          const angle = -Math.PI / 2 + (index / dimensions.length) * Math.PI * 2;
          return `${cx + Math.cos(angle) * radius * scale},${cy + Math.sin(angle) * radius * scale}`;
        })
        .join(" ");
      return `<polygon points="${points}" fill="none" stroke="#d9e1da" stroke-width="1" />`;
    })
    .join("");

  return `
    <svg class="radar-chart" viewBox="0 0 360 320" role="img" aria-label="六个一级维度雷达图">
      ${grid}
      ${axes.map((axis) => `<line x1="${cx}" y1="${cy}" x2="${axis.axisX}" y2="${axis.axisY}" stroke="#d9e1da" />`).join("")}
      <polygon points="${polygon}" fill="rgba(15,118,110,0.24)" stroke="#0f766e" stroke-width="3" />
      ${axes.map((axis) => `<circle cx="${axis.pointX}" cy="${axis.pointY}" r="4" fill="#d97706" />`).join("")}
      ${axes
        .map(
          (axis) => `
            <text x="${axis.labelX}" y="${axis.labelY}" text-anchor="${axis.anchor}" dominant-baseline="middle" fill="#1e2a27" font-size="13" font-weight="700">
              ${escapeSvg(axis.label)}
            </text>
          `,
        )
        .join("")}
    </svg>
  `;
}

function handleClick(event) {
  const control = event.target.closest("[data-action]");
  if (!control) return;

  const action = control.dataset.action;
  if (action === "answer") {
    setAnswer(Number(control.dataset.value));
  } else if (action === "prev") {
    moveBy(-1);
  } else if (action === "next") {
    moveBy(1);
  } else if (action === "next-unanswered") {
    jumpToNextUnanswered();
  } else if (action === "jump") {
    jumpTo(Number(control.dataset.index));
  } else if (action === "reset") {
    resetSurvey();
  } else if (action === "retry-save") {
    persistResult();
  } else if (action === "copy-share") {
    copyShare(control.dataset.copyValue || "");
  } else if (action === "start-own-test") {
    startOwnTest();
  } else if (action === "begin-survey") {
    beginSurvey(control.dataset.mode || DEFAULT_TEST_MODE);
  } else if (action === "select-role") {
    selectRoleVariant(Number(control.dataset.variant));
  } else if (action === "download-share-image") {
    downloadShareImage(control.dataset.shareUrl || "");
  } else if (action === "reload-distribution") {
    loadDistribution(control.dataset.resultId || "", { force: true });
  }
}

function selectRoleVariant(variant) {
  if (![1, 2].includes(variant)) return;
  selectedRoleVariant = variant;
  shareImageMessage = "";
  try {
    localStorage.setItem(ROLE_VARIANT_KEY, String(variant));
  } catch {
    // Role choice remains in memory if browser storage is unavailable.
  }
  renderRoute();
}

function handleKeydown(event) {
  if (shouldIgnoreKeyboardShortcut(event)) return;
  if (getSharedId() || !surveyState?.hasStarted || isComplete(surveyState)) return;

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    moveBy(-1);
    return;
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    moveBy(1);
    return;
  }

  if (/^[1-7]$/.test(event.key)) {
    event.preventDefault();
    setAnswer(Number(event.key));
  }
}

function shouldIgnoreKeyboardShortcut(event) {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return true;
  const target = event.target;
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

function setAnswer(value) {
  const questionId = surveyState.order[surveyState.currentIndex];
  surveyState.answers[questionId] = value;

  if (isComplete(surveyState) && !surveyState.completedAt) {
    surveyState.completedAt = Date.now();
    surveyState.saveStatus = "idle";
    saveSurveyState();
    renderSurveyOrResult();
    return;
  }

  saveSurveyState();
  renderSurveyOrResult();
}

function moveBy(delta) {
  const nextIndex = clamp(surveyState.currentIndex + delta, 0, surveyState.order.length - 1);
  if (surveyState.currentIndex === surveyState.order.length - 1 && delta > 0 && isComplete(surveyState)) {
    surveyState.completedAt = surveyState.completedAt || Date.now();
    saveSurveyState();
    renderSurveyOrResult();
    return;
  }
  surveyState.currentIndex = nextIndex;
  saveSurveyState();
  renderSurveyOrResult();
}

function jumpTo(index) {
  if (!Number.isInteger(index) || index < 0 || index >= surveyState.order.length) return;
  surveyState.currentIndex = index;
  saveSurveyState();
  renderSurveyOrResult();
}

function jumpToNextUnanswered() {
  const start = surveyState.currentIndex + 1;
  const indexes = [...surveyState.order.keys()];
  const next =
    indexes.slice(start).find((index) => surveyState.answers[surveyState.order[index]] === undefined) ??
    indexes.slice(0, start).find((index) => surveyState.answers[surveyState.order[index]] === undefined);
  if (next === undefined) {
    if (isComplete(surveyState)) {
      surveyState.completedAt = surveyState.completedAt || Date.now();
    }
  } else {
    surveyState.currentIndex = next;
  }
  saveSurveyState();
  renderSurveyOrResult();
}

function resetSurvey() {
  const confirmed = window.confirm("确定重新开始吗？当前未分享的作答进度会被清除。");
  if (!confirmed) return;
  surveyState = createSurveyState(surveyState?.testMode || DEFAULT_TEST_MODE);
  copyMessage = "";
  shareImageMessage = "";
  distributionState = { id: "", status: "idle", data: null, error: "" };
  saveSurveyState();
  history.pushState(null, "", "/");
  renderRoute();
}

function startOwnTest() {
  surveyState = createSurveyState(DEFAULT_TEST_MODE);
  sharedState = null;
  copyMessage = "";
  shareImageMessage = "";
  distributionState = { id: "", status: "idle", data: null, error: "" };
  saveSurveyState();
  history.pushState(null, "", "/");
  renderRoute();
}

function beginSurvey(mode = DEFAULT_TEST_MODE) {
  const testMode = normalizeTestMode(mode);
  if (!surveyState || isComplete(surveyState) || surveyState.testMode !== testMode) {
    surveyState = createSurveyState(testMode);
  }
  surveyState.hasStarted = true;
  surveyState.testMode = testMode;
  surveyState.startedAt = Date.now();
  surveyState.completedAt = null;
  surveyState.saveStatus = "idle";
  surveyState.savedId = "";
  surveyState.shareUrl = "";
  surveyState.saveError = "";
  copyMessage = "";
  shareImageMessage = "";
  distributionState = { id: "", status: "idle", data: null, error: "" };
  saveSurveyState();
  renderRoute();
}

async function persistResult() {
  if (!surveyState || !isComplete(surveyState) || saveInFlight) return;
  saveInFlight = true;
  surveyState.saveStatus = "saving";
  surveyState.saveError = "";
  saveSurveyState();
  renderSurveyOrResult();

  try {
    const response = await fetch("/api/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        testMode: surveyState.testMode || DEFAULT_TEST_MODE,
        answers: surveyState.answers,
        order: surveyState.order,
        durationMs: surveyDurationMs(),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `保存失败：${response.status}`);
    }

    surveyState.saveStatus = "saved";
    surveyState.savedId = data.id;
    surveyState.shareUrl = absolutePath(data.sharePath || `/result/${data.id}`);
    saveSurveyState();
    distributionState = { id: "", status: "idle", data: null, error: "" };
    sharedState = {
      id: data.id,
      status: "loaded",
      result: data.result,
      error: "",
    };
    history.replaceState(null, "", data.sharePath || `/result/${data.id}`);
    renderRoute();
  } catch (error) {
    surveyState.saveStatus = "error";
    surveyState.saveError =
      error instanceof Error
        ? error.message
        : "保存结果时出现未知错误。使用 wrangler pages dev 或部署到 Cloudflare 后可连接 D1。";
    saveSurveyState();
    renderSurveyOrResult();
  } finally {
    saveInFlight = false;
  }
}

async function fetchSharedResult(id) {
  try {
    const response = await fetch(`/api/results/${encodeURIComponent(id)}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `读取失败：${response.status}`);
    }
    sharedState = { id, status: "loaded", result: data.result, error: "" };
    distributionState = { id: "", status: "idle", data: null, error: "" };
  } catch (error) {
    sharedState = {
      id,
      status: "error",
      result: null,
      error: error instanceof Error ? error.message : "读取结果失败。",
    };
  }
  renderRoute();
}

function ensureDistribution(result) {
  const id = result?.id || "";
  if (!id) return;
  if (distributionState.id === id && ["loading", "loaded", "error"].includes(distributionState.status)) return;
  loadDistribution(id);
}

async function loadDistribution(id, options = {}) {
  if (!id) return;
  if (!options.force && distributionState.id === id && distributionState.status === "loading") return;

  distributionState = { id, status: "loading", data: null, error: "" };
  renderRoute();

  try {
    const response = await fetch(`/api/distribution?id=${encodeURIComponent(id)}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `读取分布失败：${response.status}`);
    }
    distributionState = { id, status: "loaded", data, error: "" };
  } catch (error) {
    distributionState = {
      id,
      status: "error",
      data: null,
      error: error instanceof Error ? error.message : "读取总体分布失败。",
    };
  }
  renderRoute();
}

async function copyShare(value) {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    copyMessage = "链接已复制。";
  } catch {
    copyMessage = "复制失败，可以直接选中链接。";
  }
  renderRoute();
}

async function downloadShareImage(shareUrl) {
  const result = activeReportResult();
  if (!result || !shareUrl) {
    shareImageMessage = "分享链接生成后才能生成截图。";
    renderRoute();
    return;
  }

  try {
    const blob = await createShareImageBlob(result, shareUrl, selectedRoleVariant);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ai-profile-${getProfileSlug(result.profile?.mainLabel)}.png`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    shareImageMessage = "分享截图已生成并下载。";
  } catch (error) {
    shareImageMessage = error instanceof Error ? error.message : "生成分享截图失败。";
  }
  renderRoute();
}

function activeReportResult() {
  if (sharedState?.status === "loaded") return sharedState.result;
  if (surveyState && isComplete(surveyState)) return currentScore();
  return null;
}

async function createShareImageBlob(result, shareUrl, variant) {
  const label = result.profile?.mainLabel || "均衡观察型";
  const visual = getProfileVisual(label);
  const roleImage = await loadImage(visual.asset);
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1440;
  const ctx = canvas.getContext("2d");
  const summary = reportNarrative(result);

  ctx.fillStyle = "#f7f9f5";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = visual.soft;
  ctx.fillRect(0, 0, canvas.width, 420);
  drawRoundedRect(ctx, 54, 54, 972, 1332, 28, "#ffffff");
  drawRoundedRect(ctx, 78, 78, 924, 126, 20, visual.soft);

  ctx.fillStyle = visual.accent;
  ctx.font = "700 28px Microsoft YaHei, sans-serif";
  ctx.fillText("AI 态度六维画像", 104, 128);
  ctx.fillStyle = "#62706a";
  ctx.font = "400 22px Microsoft YaHei, sans-serif";
  ctx.fillText("AI Attitude Profile", 104, 166);

  ctx.fillStyle = "#1e2a27";
  ctx.font = "800 54px Microsoft YaHei, sans-serif";
  drawCanvasText(ctx, label, 104, 280, 456, 64, 2);
  ctx.fillStyle = visual.accent;
  ctx.font = "700 26px Microsoft YaHei, sans-serif";
  ctx.fillText(visual.title, 106, 354);

  const cropWidth = roleImage.naturalWidth / 2;
  const cropX = variant === 1 ? 0 : cropWidth;
  drawImageCover(ctx, roleImage, cropX, 0, cropWidth, roleImage.naturalHeight, 626, 230, 300, 326);

  ctx.fillStyle = "#42524c";
  drawCanvasTextFit(ctx, summary, 104, 414, 500, 31, 780, {
    fontFamily: "Microsoft YaHei, sans-serif",
    fontWeight: 400,
    maxFontSize: 22,
    minFontSize: 16,
  });

  const dimensions = (result.dimensionScores || []).slice(0, 6);
  let y = 800;
  ctx.font = "700 28px Microsoft YaHei, sans-serif";
  ctx.fillStyle = "#1e2a27";
  ctx.fillText("六维概览", 104, y);
  y += 34;
  for (const dimension of dimensions) {
    const score = formatScore10(dimension);
    ctx.fillStyle = "#1e2a27";
    ctx.font = "700 23px Microsoft YaHei, sans-serif";
    ctx.fillText(dimension.name, 104, y + 26);
    ctx.fillStyle = "#62706a";
    ctx.font = "700 22px Microsoft YaHei, sans-serif";
    ctx.fillText(score, 360, y + 26);
    ctx.fillStyle = "#e1e9e2";
    roundRectPath(ctx, 478, y + 8, 390, 18, 9);
    ctx.fill();
    ctx.fillStyle = visual.accent;
    roundRectPath(ctx, 478, y + 8, 390 * ((dimension.score100 || 0) / 100), 18, 9);
    ctx.fill();
    y += 48;
  }

  const qrMatrix = createQrMatrix(shareUrl);
  drawQrOnCanvas(ctx, qrMatrix, 104, 1138, 210);
  ctx.fillStyle = "#1e2a27";
  ctx.font = "700 28px Microsoft YaHei, sans-serif";
  ctx.fillText("扫码查看报告", 350, 1184);
  ctx.fillStyle = "#62706a";
  ctx.font = "400 21px Microsoft YaHei, sans-serif";
  drawCanvasText(ctx, shareUrl, 350, 1224, 590, 30, 3);

  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("浏览器未能生成分享截图。"));
    }, "image/png");
  });
}

function currentScore() {
  const questionSet = currentQuestionSet();
  return scoreQuestionnaire(questionSet.questions, surveyState.answers, {
    order: surveyState.order,
    durationMs: surveyDurationMs(),
    testMode: questionSet.id,
    questionSetLabel: questionSet.label,
  });
}

function getProfileVisual(label) {
  return PROFILE_VISUALS[label] || PROFILE_VISUALS["均衡观察型"];
}

function getProfileSlug(label = "balanced-observer") {
  const visual = getProfileVisual(label);
  const entry = Object.entries(PROFILE_VISUALS).find(([, item]) => item === visual);
  return (entry?.[1]?.asset || "balanced-observer")
    .replace("/assets/role-", "")
    .replace(".webp", "")
    .replace(/[^a-z0-9-]/gi, "");
}

function loadRoleVariant() {
  try {
    const value = Number(localStorage.getItem(ROLE_VARIANT_KEY));
    return value === 2 ? 2 : 1;
  } catch {
    return 1;
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("画像角色图片加载失败。"));
    image.src = src;
  });
}

function drawImageCover(ctx, image, sx, sy, sw, sh, dx, dy, dw, dh) {
  const sourceRatio = sw / sh;
  const targetRatio = dw / dh;
  let cropX = sx;
  let cropY = sy;
  let cropW = sw;
  let cropH = sh;
  if (sourceRatio > targetRatio) {
    cropW = sh * targetRatio;
    cropX = sx + (sw - cropW) / 2;
  } else {
    cropH = sw / targetRatio;
    cropY = sy + (sh - cropH) / 2;
  }
  ctx.drawImage(image, cropX, cropY, cropW, cropH, dx, dy, dw, dh);
}

function drawRoundedRect(ctx, x, y, width, height, radius, fillStyle) {
  ctx.fillStyle = fillStyle;
  roundRectPath(ctx, x, y, width, height, radius);
  ctx.fill();
}

function roundRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 4) {
  const lines = wrapCanvasText(ctx, text, maxWidth, maxLines);
  for (let index = 0; index < lines.length; index += 1) {
    ctx.fillText(lines[index], x, y + index * lineHeight);
  }
}

function drawCanvasTextFit(ctx, text, x, y, maxWidth, lineHeight, maxBottom, options = {}) {
  const fontFamily = options.fontFamily || "sans-serif";
  const fontWeight = options.fontWeight || 400;
  const minFontSize = options.minFontSize || 16;
  const maxFontSize = options.maxFontSize || 24;
  const maxLines = Math.max(1, Math.floor((maxBottom - y) / lineHeight) + 1);
  let lines = [];
  let fontSize = maxFontSize;

  for (; fontSize >= minFontSize; fontSize -= 1) {
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    lines = wrapCanvasText(ctx, text, maxWidth, maxLines, { ellipsis: false });
    if (lines.join("") === String(text || "")) break;
  }

  for (let index = 0; index < lines.length; index += 1) {
    ctx.fillText(lines[index], x, y + index * lineHeight);
  }
}

function wrapCanvasText(ctx, text, maxWidth, maxLines, options = {}) {
  const chars = String(text || "").split("");
  const lines = [];
  let line = "";
  for (const char of chars) {
    const next = line + char;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = char;
      if (lines.length === maxLines) break;
    } else {
      line = next;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (options.ellipsis !== false && lines.length === maxLines && chars.join("").length > lines.join("").length) {
    lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, Math.max(0, lines[maxLines - 1].length - 1))}…`;
  }
  return lines;
}

function drawQrOnCanvas(ctx, matrix, x, y, size) {
  const quiet = 4;
  const modules = matrix.length + quiet * 2;
  const cell = size / modules;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = "#1e2a27";
  for (let row = 0; row < matrix.length; row += 1) {
    for (let col = 0; col < matrix.length; col += 1) {
      if (matrix[row][col]) {
        ctx.fillRect(x + (col + quiet) * cell, y + (row + quiet) * cell, Math.ceil(cell), Math.ceil(cell));
      }
    }
  }
}

function surveyDurationMs() {
  if (!surveyState?.startedAt) return null;
  return (surveyState.completedAt || Date.now()) - surveyState.startedAt;
}

function currentQuestionSet(state = surveyState) {
  return getQuestionSet(state?.testMode || DEFAULT_TEST_MODE);
}

function answeredCount(state) {
  const questions = currentQuestionSet(state).questions;
  return questions.reduce((count, question) => count + (state.answers[question.id] !== undefined ? 1 : 0), 0);
}

function isComplete(state) {
  return answeredCount(state) === currentQuestionSet(state).questions.length;
}

function hasAnyAnswer(state) {
  return answeredCount(state) > 0;
}

function createSurveyState(mode = DEFAULT_TEST_MODE) {
  const questionSet = getQuestionSet(mode);
  return {
    testMode: questionSet.id,
    hasStarted: false,
    order: shuffle(questionSet.questionIds),
    answers: {},
    currentIndex: 0,
    startedAt: Date.now(),
    completedAt: null,
    saveStatus: "idle",
    savedId: "",
    shareUrl: "",
    saveError: "",
  };
}

function loadSurveyState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSurveyState();
    const parsed = JSON.parse(raw);
    const rawOrder = Array.isArray(parsed.order) ? parsed.order.map(Number).filter(Number.isInteger) : [];
    const questionSet = parsed.testMode
      ? getQuestionSet(parsed.testMode)
      : inferQuestionSetFromIds(rawOrder);
    const ids = new Set(questionSet.questionIds);
    const order = rawOrder.filter((id) => ids.has(id));
    if (order.length !== questionSet.questions.length || new Set(order).size !== questionSet.questions.length) {
      return createSurveyState();
    }

    const answers = {};
    for (const [key, value] of Object.entries(parsed.answers || {})) {
      const id = Number(key);
      const score = Number(value);
      if (ids.has(id) && Number.isInteger(score) && score >= 1 && score <= 7) {
        answers[id] = score;
      }
    }

    const hasStarted =
      Boolean(parsed.hasStarted) ||
      Object.keys(answers).length > 0 ||
      Boolean(parsed.completedAt) ||
      parsed.saveStatus === "saved";

    return {
      testMode: questionSet.id,
      hasStarted,
      order,
      answers,
      currentIndex: clamp(Number(parsed.currentIndex) || 0, 0, questionSet.questions.length - 1),
      startedAt: Number(parsed.startedAt) || Date.now(),
      completedAt: parsed.completedAt ? Number(parsed.completedAt) : null,
      saveStatus: parsed.saveStatus || "idle",
      savedId: parsed.savedId || "",
      shareUrl: parsed.shareUrl || "",
      saveError: parsed.saveError || "",
    };
  } catch {
    return createSurveyState();
  }
}

function saveSurveyState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(surveyState));
  } catch {
    // localStorage can be unavailable in locked-down browsers; the in-memory state still works.
  }
}

function shuffle(values) {
  const copy = values.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const random = crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
    const swapIndex = Math.floor(random * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function getSharedId() {
  const match = window.location.pathname.match(/^\/result\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function absolutePath(path) {
  return new URL(path, window.location.origin).toString();
}

function absoluteResultUrl(id) {
  return absolutePath(`/result/${encodeURIComponent(id)}`);
}

function formatScore10(item) {
  const score100 =
    item?.score100 ??
    (item?.rawScore === null || item?.rawScore === undefined ? null : ((item.rawScore - 1) / 6) * 100);
  return score100 === null || score100 === undefined ? "数据不足" : `${round(score100 / 10, 1).toFixed(1)}/10`;
}

function formatPercent(value) {
  return Number.isFinite(Number(value)) ? `${round(Number(value), 1).toFixed(1)}%` : "0.0%";
}

function formatDuration(durationMs) {
  if (!durationMs && durationMs !== 0) return "";
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.round((durationMs % 60000) / 1000);
  return `完成用时 ${minutes} 分 ${seconds} 秒`;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createQrMatrix(text) {
  const version = 5;
  const size = version * 4 + 17;
  const dataCodewords = 108;
  const errorCodewords = 26;
  const bytes = Array.from(new TextEncoder().encode(text));
  if (bytes.length > 106) {
    throw new Error("分享链接太长，无法生成当前版本二维码。");
  }

  const data = makeQrDataCodewords(bytes, dataCodewords);
  const divisor = reedSolomonDivisor(errorCodewords);
  const ecc = reedSolomonRemainder(data, divisor);
  const codewords = data.concat(ecc);
  const modules = Array.from({ length: size }, () => Array(size).fill(false));
  const isFunction = Array.from({ length: size }, () => Array(size).fill(false));

  const setFunction = (x, y, dark) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    modules[y][x] = Boolean(dark);
    isFunction[y][x] = true;
  };

  drawFinderPattern(setFunction, 0, 0);
  drawFinderPattern(setFunction, size - 7, 0);
  drawFinderPattern(setFunction, 0, size - 7);

  for (let i = 8; i < size - 8; i += 1) {
    setFunction(6, i, i % 2 === 0);
    setFunction(i, 6, i % 2 === 0);
  }

  drawAlignmentPattern(setFunction, 30, 30);
  setFunction(8, size - 8, true);
  drawFormatBits(setFunction, size, 0);

  const dataBits = [];
  for (const codeword of codewords) {
    for (let bit = 7; bit >= 0; bit -= 1) {
      dataBits.push(((codeword >>> bit) & 1) !== 0);
    }
  }

  let bitIndex = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;
    for (let vert = 0; vert < size; vert += 1) {
      const row = upward ? size - 1 - vert : vert;
      for (let col = right; col >= right - 1; col -= 1) {
        if (!isFunction[row][col]) {
          let dark = bitIndex < dataBits.length ? dataBits[bitIndex] : false;
          bitIndex += 1;
          if ((row + col) % 2 === 0) dark = !dark;
          modules[row][col] = dark;
        }
      }
    }
    upward = !upward;
  }

  return modules;
}

function makeQrDataCodewords(bytes, capacity) {
  const bits = [];
  appendBits(bits, 0x4, 4);
  appendBits(bits, bytes.length, 8);
  for (const byte of bytes) appendBits(bits, byte, 8);
  appendBits(bits, 0, Math.min(4, capacity * 8 - bits.length));
  while (bits.length % 8 !== 0) bits.push(false);

  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    let value = 0;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value << 1) | (bits[i + bit] ? 1 : 0);
    }
    data.push(value);
  }
  for (let pad = 0xec; data.length < capacity; pad ^= 0xec ^ 0x11) {
    data.push(pad);
  }
  return data;
}

function appendBits(bits, value, length) {
  for (let i = length - 1; i >= 0; i -= 1) {
    bits.push(((value >>> i) & 1) !== 0);
  }
}

function drawFinderPattern(setFunction, x, y) {
  for (let dy = -1; dy <= 7; dy += 1) {
    for (let dx = -1; dx <= 7; dx += 1) {
      const inPattern = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
      const dark =
        inPattern && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
      setFunction(x + dx, y + dy, dark);
    }
  }
}

function drawAlignmentPattern(setFunction, cx, cy) {
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      setFunction(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
}

function drawFormatBits(setFunction, size, mask) {
  const bits = getFormatBits(1, mask);
  for (let i = 0; i <= 5; i += 1) setFunction(8, i, getBit(bits, i));
  setFunction(8, 7, getBit(bits, 6));
  setFunction(8, 8, getBit(bits, 7));
  setFunction(7, 8, getBit(bits, 8));
  for (let i = 9; i < 15; i += 1) setFunction(14 - i, 8, getBit(bits, i));
  for (let i = 0; i < 8; i += 1) setFunction(size - 1 - i, 8, getBit(bits, i));
  for (let i = 8; i < 15; i += 1) setFunction(8, size - 15 + i, getBit(bits, i));
}

function getFormatBits(eccFormatBits, mask) {
  const data = (eccFormatBits << 3) | mask;
  let remainder = data;
  for (let i = 0; i < 10; i += 1) {
    remainder = (remainder << 1) ^ (((remainder >>> 9) & 1) ? 0x537 : 0);
  }
  return ((data << 10) | remainder) ^ 0x5412;
}

function getBit(value, index) {
  return ((value >>> index) & 1) !== 0;
}

function reedSolomonDivisor(degree) {
  let result = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = Array(result.length + 1).fill(0);
    for (let j = 0; j < result.length; j += 1) {
      next[j] ^= gfMultiply(result[j], 1);
      next[j + 1] ^= gfMultiply(result[j], gfPow(2, i));
    }
    result = next;
  }
  return result.slice(1);
}

function reedSolomonRemainder(data, divisor) {
  const result = Array(divisor.length).fill(0);
  for (const byte of data) {
    const factor = byte ^ result.shift();
    result.push(0);
    for (let i = 0; i < divisor.length; i += 1) {
      result[i] ^= gfMultiply(divisor[i], factor);
    }
  }
  return result;
}

function gfPow(value, power) {
  let result = 1;
  for (let i = 0; i < power; i += 1) {
    result = gfMultiply(result, value);
  }
  return result;
}

function gfMultiply(left, right) {
  let result = 0;
  let a = left;
  let b = right;
  while (b !== 0) {
    if (b & 1) result ^= a;
    a <<= 1;
    if (a & 0x100) a ^= 0x11d;
    b >>>= 1;
  }
  return result;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function escapeSvg(value) {
  return escapeHtml(value);
}

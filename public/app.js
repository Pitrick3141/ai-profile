import { QUESTIONS } from "./questionnaire.js";
import { LIKERT_OPTIONS, round, scoreQuestionnaire } from "./scoring.js";

const STORAGE_KEY = "ai-attitude-questionnaire-state-v1";
const app = document.querySelector("#app");
const questionsById = new Map(QUESTIONS.map((question) => [question.id, question]));

let surveyState = loadSurveyState();
let sharedState = null;
let saveInFlight = false;
let copyMessage = "";

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
          <p>通过 98 道 7 点量表题，了解你对 AI 的风险、信任、治理、采用、伦理和人机关系的当前态度画像。</p>
          <div class="landing-actions">
            <button class="btn primary landing-start" type="button" data-action="begin-survey">开始问卷</button>
            <span class="landing-note">约 8-12 分钟 · 题目随机呈现 · 完成后生成分享链接</span>
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
  const answered = answeredCount(surveyState);
  const total = QUESTIONS.length;
  const progress = Math.round((answered / total) * 1000) / 10;
  const currentQuestionId = surveyState.order[surveyState.currentIndex];
  const question = questionsById.get(currentQuestionId);
  const selectedValue = surveyState.answers[question.id];

  return `
    <header class="topbar">
      <div class="brand">
        <h1>AI 态度六维画像问卷</h1>
        <p>98 个陈述，7 点量表。结果会生成六个一级维度、17 个子维度、画像标签和可分享报告。</p>
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
            <button class="btn" type="button" data-action="prev" ${surveyState.currentIndex === 0 ? "disabled" : ""}>上一题</button>
            <button class="btn primary" type="button" data-action="next">
              ${surveyState.currentIndex === total - 1 ? "完成" : "下一题"}
            </button>
          </div>
          <div class="button-group">
            <button class="btn subtle" type="button" data-action="next-unanswered">下一道未答题</button>
            <button class="btn warning" type="button" data-action="reset">重新开始</button>
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
}

function renderReport(result, options) {
  const dimensions = result.dimensionScores || [];
  const subdimensions = result.subdimensionScores || [];
  const labels = result.profile?.labels?.length
    ? result.profile.labels
    : [{ label: result.profile?.mainLabel || "均衡观察型" }];
  const metaText = result.createdAt ? `生成于 ${formatDate(result.createdAt)}` : formatDuration(result.durationMs);

  return `
    <header class="topbar">
      <div class="brand">
        <h1>AI 态度六维画像问卷</h1>
        <p>${escapeHtml(metaText)}</p>
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
          <p>${escapeHtml(result.profile?.narrative || result.profile?.mainSummary || "")}</p>
        </div>
        <div class="chart-shell">${renderRadarChart(dimensions)}</div>
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
        <span class="score-value">${formatRaw(dimension.rawScore)} / ${formatScore100(dimension.score100)} · ${escapeHtml(dimension.level)}</span>
      </div>
      <div class="bar-track"><div class="bar-fill" style="width:${clamp(score100, 0, 100)}%"></div></div>
      <div class="score-note">${escapeHtml(dimension.meaning || "")}</div>
    </div>
  `;
}

function renderSubdimension(item) {
  return `
    <div class="sub-score">
      <strong>${escapeHtml(item.name)} · ${formatRaw(item.rawScore)} / ${formatScore100(item.score100)}</strong>
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
                <strong>${formatRaw(item.rawScore)} / ${formatScore100(item.score100)}</strong>
              </li>
            `,
          )
          .join("")}
      </ul>
    </div>
  `;
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
    <div class="share-row">
      <input id="share-url" type="text" readonly value="${escapeAttribute(options.shareUrl)}" aria-label="分享链接" />
      <button class="btn primary" type="button" data-action="copy-share" data-copy-value="${escapeAttribute(options.shareUrl)}">复制</button>
    </div>
    <p class="share-message">${escapeHtml(copyMessage || "通过这个链接可以查看结果，也可以开始新的测试。")}</p>
  `;
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
    beginSurvey();
  }
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
  surveyState = createSurveyState();
  copyMessage = "";
  saveSurveyState();
  history.pushState(null, "", "/");
  renderRoute();
}

function startOwnTest() {
  surveyState = createSurveyState();
  sharedState = null;
  copyMessage = "";
  saveSurveyState();
  history.pushState(null, "", "/");
  renderRoute();
}

function beginSurvey() {
  if (!surveyState || isComplete(surveyState)) {
    surveyState = createSurveyState();
  }
  surveyState.hasStarted = true;
  surveyState.startedAt = Date.now();
  surveyState.completedAt = null;
  surveyState.saveStatus = "idle";
  surveyState.savedId = "";
  surveyState.shareUrl = "";
  surveyState.saveError = "";
  copyMessage = "";
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

function currentScore() {
  return scoreQuestionnaire(QUESTIONS, surveyState.answers, {
    order: surveyState.order,
    durationMs: surveyDurationMs(),
  });
}

function surveyDurationMs() {
  if (!surveyState?.startedAt) return null;
  return (surveyState.completedAt || Date.now()) - surveyState.startedAt;
}

function answeredCount(state) {
  return QUESTIONS.reduce((count, question) => count + (state.answers[question.id] !== undefined ? 1 : 0), 0);
}

function isComplete(state) {
  return answeredCount(state) === QUESTIONS.length;
}

function hasAnyAnswer(state) {
  return answeredCount(state) > 0;
}

function createSurveyState() {
  return {
    hasStarted: false,
    order: shuffle(QUESTIONS.map((question) => question.id)),
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
    const ids = new Set(QUESTIONS.map((question) => question.id));
    const order = Array.isArray(parsed.order) ? parsed.order.map(Number).filter((id) => ids.has(id)) : [];
    if (order.length !== QUESTIONS.length || new Set(order).size !== QUESTIONS.length) {
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
      hasStarted,
      order,
      answers,
      currentIndex: clamp(Number(parsed.currentIndex) || 0, 0, QUESTIONS.length - 1),
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

function formatRaw(value) {
  return value === null || value === undefined ? "数据不足" : round(value, 2).toFixed(2);
}

function formatScore100(value) {
  return value === null || value === undefined ? "--" : `${round(value, 1).toFixed(1)}`;
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

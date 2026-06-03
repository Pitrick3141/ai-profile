# AI 态度六维画像问卷

一个部署到 Cloudflare Pages 的响应式问卷应用。前端根据 `AI_attitude_questionnaire_98_actual.csv` 生成的题库随机呈现 98 道题，完成后即时计算六个一级维度、17 个子维度、画像标签、雷达图和条形图。后端使用 Cloudflare Pages Functions，也就是 Workers runtime，连接 D1 数据库保存结果并生成分享链接。

## 项目结构

```text
public/
  index.html              # 前端入口
  app.js                  # 问卷、结果页、分享页
  scoring.js              # 前后端共用评分逻辑
  questionnaire.js        # 由 CSV 生成的题库模块
  _redirects              # /result/:id SPA 回退
functions/
  api/results.js          # POST /api/results
  api/results/[id].js     # GET /api/results/:id
migrations/
  0001_create_survey_results.sql
wrangler.toml             # Pages + D1 配置
```

## 本地开发

1. 创建 D1 数据库：

```bash
npm run d1:create
```

2. 将 Cloudflare 返回的 `database_id` 填入 `wrangler.toml`。

3. 应用本地迁移并启动 Pages dev：

```bash
npm run d1:migrate:local
npm run dev
```

默认会在本地启动 Cloudflare Pages dev，并让 `/api/results` 使用本地 D1。

## 部署

1. 应用远程 D1 迁移：

```bash
npm run d1:migrate:remote
```

2. 部署 Pages：

```bash
npm run deploy
```

如果使用 Cloudflare Dashboard 的 Git 集成，构建命令可以留空，构建输出目录为 `public`。D1 绑定名必须是 `DB`，数据库选择 `ai-profile-results`。

## 数据说明

保存到 D1 的字段包括：

- `answers_json`：完整原始作答，用于追溯与后续统计。
- `question_order_json`：本次随机题序。
- `scores_json`：公开结果报告，不包含逐题原始答案。
- `duration_ms`：完成用时。

分享页只通过 `scores_json` 展示公开报告，不返回逐题答案。

## 参考

- [Cloudflare Pages Functions bindings](https://developers.cloudflare.com/pages/functions/bindings/)
- [Cloudflare Pages Wrangler configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)

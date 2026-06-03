CREATE TABLE IF NOT EXISTS survey_results (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  questionnaire_version TEXT NOT NULL,
  completed_questions INTEGER NOT NULL,
  duration_ms INTEGER,
  answers_json TEXT NOT NULL,
  question_order_json TEXT,
  scores_json TEXT NOT NULL,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_survey_results_created_at
ON survey_results (created_at DESC);

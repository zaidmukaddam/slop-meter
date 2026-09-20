-- Slop Meter site database. Numbers and labels only: no table has a column that could hold paragraph text.

-- Budget counters for /api/rewrite. scope: rewrite-ip. key: sha256(ip).
create table if not exists usage (
  scope text not null,
  key text not null,
  period text not null, -- YYYY-MM-DD
  count int not null default 0,
  primary key (scope, key, period)
);

-- Opt-in "you're wrong" labels from the extension: the feature vector, what the meter said, what the reader said.
create table if not exists feedback (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  install_id uuid not null,
  vector real[] not null,
  predicted text not null check (predicted in ('human', 'machine', 'mixed', 'unsure')),
  label text not null check (label in ('human', 'machine', 'mixed', 'unsure')),
  p real not null check (p >= 0 and p <= 1),
  site_class text not null,
  spec int not null,
  model_version text not null
);
create index if not exists feedback_created_at on feedback (created_at);

-- Written daily by /api/cron/calibrate; the calibration page shows the latest row.
create table if not exists calibration_snapshots (
  id serial primary key,
  created_at timestamptz not null default now(),
  model_version text not null, -- feedback is filtered to the model that produced it
  n int not null,
  ece real,
  bins jsonb not null,         -- { human|machine|mixed: [{ bin, predicted, observed, n }] }
  unsure_by_week jsonb not null -- [{ week: 'YYYY-Www', n, unsureRate }]
);

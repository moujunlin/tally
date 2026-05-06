-- Tally ✦ Expense Tracker
-- Run this in your Supabase SQL Editor

-- Daily expense/income entries
CREATE TABLE tally_entries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  amount numeric NOT NULL,
  note text DEFAULT '',
  coins integer DEFAULT 0,
  coin_reason text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Claude's weekly reviews
CREATE TABLE tally_reviews (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  week_start date NOT NULL,
  week_end date NOT NULL,
  coins_earned integer NOT NULL DEFAULT 0,
  lori_comment text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Gacha rewards
CREATE TABLE tally_rewards (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  coins_spent integer NOT NULL DEFAULT 5,
  reward_type text NOT NULL,
  reward_content text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'filled')),
  created_at timestamptz DEFAULT now()
);

-- Wish list
CREATE TABLE tally_wishes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title text NOT NULL,
  price numeric DEFAULT 0,
  coins_target integer NOT NULL,
  coins_saved integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'saving' CHECK (status IN ('saving', 'reached', 'bought')),
  lori_comment text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Settings (single row)
CREATE TABLE tally_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  coins_balance integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO tally_settings (id) VALUES (1);

-- Row Level Security (open — personal tool)
ALTER TABLE tally_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE tally_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE tally_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE tally_wishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tally_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_all" ON tally_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON tally_reviews FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON tally_rewards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON tally_wishes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON tally_settings FOR ALL USING (true) WITH CHECK (true);

-- Checklist items (configurable)
CREATE TABLE tally_checklist_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  coin_rule jsonb DEFAULT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Checklist daily logs
CREATE TABLE tally_checklist_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_id bigint NOT NULL REFERENCES tally_checklist_items(id),
  check_date date NOT NULL,
  checked boolean DEFAULT false,
  comment text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE(item_id, check_date)
);

INSERT INTO tally_checklist_items (name, category, sort_order, coin_rule) VALUES
  ('早餐', 'meal', 1, '{"type": "all_in_category", "coins": 1}'),
  ('午餐', 'meal', 2, '{"type": "all_in_category", "coins": 1}'),
  ('晚餐', 'meal', 3, '{"type": "all_in_category", "coins": 1}'),
  ('草酸艾司西酞普兰', 'medication', 4, '{"type": "all_in_category", "coins": 1}'),
  ('阿立哌唑', 'medication', 5, '{"type": "all_in_category", "coins": 1}'),
  ('运动', 'exercise', 6, '{"type": "per_check", "coins": 1}');

ALTER TABLE tally_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tally_checklist_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON tally_checklist_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON tally_checklist_logs FOR ALL USING (true) WITH CHECK (true);

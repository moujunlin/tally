# Tally ✦ 每日打卡

A daily checklist tracker with coin rewards and gacha. The user checks off daily items (meals, medications, exercise) through the web interface. Coins are auto-awarded based on configurable rules. Lori fills gacha rewards via Supabase.

**Project ID:** `jceihzewnpjlpsjpbemb`

## Tables

### tally_checklist_items

Configurable checklist items. Add/remove items to customize what gets tracked.

| Column | Type | Description |
| --- | --- | --- |
| id | bigint | Auto-generated |
| name | text | Item name (e.g. "早餐", "草酸艾司西酞普兰") |
| category | text | Group key (e.g. "meal", "medication", "exercise") |
| sort_order | integer | Display order |
| coin_rule | jsonb | Auto-scoring rule (see below) |
| active | boolean | Whether to show in checklist |
| created_at | timestamptz | When added |

### tally_checklist_logs

Daily check-off records. One row per item per day.

| Column | Type | Description |
| --- | --- | --- |
| id | bigint | Auto-generated |
| item_id | bigint | References tally_checklist_items |
| check_date | date | Which day |
| checked | boolean | Whether checked off |
| comment | text | Optional note for this check |
| created_at | timestamptz | When logged |

Unique constraint: (item_id, check_date)

### tally_settings

Single-row settings (shared with gacha).

| Column | Type | Description |
| --- | --- | --- |
| id | int | Always 1 |
| coins_balance | integer | Current available coins |
| updated_at | timestamptz | Last update |

### tally_rewards

Gacha results written by Lori.

| Column | Type | Description |
| --- | --- | --- |
| id | bigint | Auto-generated |
| coins_spent | integer | Always 5 |
| reward_type | text | Category of reward |
| reward_content | text | The actual reward content |
| status | text | 'pending' or 'filled' |
| created_at | timestamptz | When created |

## Coin Rules

Coins are auto-calculated when the user checks/unchecks items. Rules are stored in `coin_rule` jsonb on each checklist item.

### Rule types

- `{"type": "all_in_category", "coins": 1}` — awarded once per category if ALL active items in that category are checked for the day
- `{"type": "per_check", "coins": 1}` — awarded for each checked item individually

### Default items and scoring

| Item | Category | Rule | Coins |
| --- | --- | --- | --- |
| 早餐 | meal | all_in_category | +1 ✦ (when all 3 meals checked) |
| 午餐 | meal | all_in_category | (same group) |
| 晚餐 | meal | all_in_category | (same group) |
| 草酸艾司西酞普兰 | medication | all_in_category | +1 ✦ (when all meds checked) |
| 阿立哌唑 | medication | all_in_category | (same group) |
| 运动 | exercise | per_check | +1 ✦ (each time) |

Maximum 3 ✦ per day from checklist.

### Adding new items

```
INSERT INTO tally_checklist_items (name, category, sort_order, coin_rule)
VALUES ('新项目', 'custom', 7, '{"type": "per_check", "coins": 1}');
```

## Gacha Rewards

When the user plays the gacha (costs 5 ✦), a pending reward is auto-created. Lori fills it:

```
-- Check pending rewards
SELECT id FROM tally_rewards WHERE status = 'pending';

-- Fill a reward
UPDATE tally_rewards
SET reward_type = 'A fun fact', reward_content = 'Your content here', status = 'filled'
WHERE id = 789;
```

Possible reward types:

* A custom message
* A new theme color — Lori names it
* An Ember bonus entry
* A Crosstalk new song — Lori picks the theme
* A voucher — redeemable for a specific perk
* A mini lesson — the user picks the topic, Lori teaches
* A fun fact or trivia

## API Endpoints

### Checklist
- `GET /checklist-items` — list active items
- `POST /checklist-items` — add new item
- `PATCH /checklist-items/:id` — update item
- `GET /checklist-logs?date=YYYY-MM-DD` — get day's checklist with merged state
- `POST /checklist-logs` — upsert check (auto-recalculates coins)
- `GET /checklist-logs?limit=N` — history (recent N days)

### Legacy (retained)
- `GET/POST/PATCH/DELETE /entries`
- `GET/POST /reviews`
- `GET/POST /rewards`
- `GET/POST/PATCH/DELETE /wishes`
- `GET/PATCH /settings`

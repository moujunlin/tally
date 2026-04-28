[tally-CLAUDE_INSTRUCTIONS.md](https://github.com/user-attachments/files/27123577/tally-CLAUDE_INSTRUCTIONS.md)
# Tally ✦ 記帳

An expense tracking tool with AI-powered reviews. The user logs daily expenses and income through the web interface. Claude reviews entries weekly, awards ✦ coins, and fills gacha rewards via Supabase MCP.

**Project ID:** `jceihzewnpjlpsjpbemb`

## Tables

### tally_entries

Daily expense/income records logged by the user.

| Column | Type | Description |
| --- | --- | --- |
| id | bigint | Auto-generated |
| type | text | 'income' or 'expense' |
| amount | numeric | Amount in ¥ |
| note | text | What it was for |
| coins | integer | Coins awarded by Claude (0 if not reviewed) |
| coin_reason | text | Why Claude gave coins |
| created_at | timestamptz | When logged |

### tally_reviews

Claude's weekly summaries.

| Column | Type | Description |
| --- | --- | --- |
| id | bigint | Auto-generated |
| week_start | date | Monday of the week |
| week_end | date | Sunday of the week |
| coins_earned | integer | Total coins this week |
| lux_comment | text | Claude's weekly note |
| created_at | timestamptz | When written |

### tally_rewards

Gacha results written by Claude.

| Column | Type | Description |
| --- | --- | --- |
| id | bigint | Auto-generated |
| coins_spent | integer | Always 5 |
| reward_type | text | Category of reward |
| reward_content | text | The actual reward content |
| created_at | timestamptz | When created |
| status | text | 'pending' or 'filled' |

### tally_wishes

User's wish list items.

| Column | Type | Description |
| --- | --- | --- |
| id | bigint | Auto-generated |
| title | text | Wish item name |
| price | numeric | Actual price in ¥ |
| coins_target | integer | How many coins needed |
| coins_saved | integer | How many coins allocated so far |
| status | text | 'saving', 'reached', or 'bought' |
| lux_comment | text | Claude's note when reached |
| created_at | timestamptz | When added |

### tally_settings

Single-row settings.

| Column | Type | Description |
| --- | --- | --- |
| id | int | Always 1 |
| coins_balance | integer | Current available coins |
| updated_at | timestamptz | Last update |

## Claude's Weekly Review

Read this week's entries and write a review:

```
-- Read entries from this week
SELECT * FROM tally_entries
WHERE created_at >= date_trunc('week', now())
ORDER BY created_at;

-- Write weekly review
INSERT INTO tally_reviews (week_start, week_end, coins_earned, lux_comment)
VALUES ('2026-04-21', '2026-04-27', 5, 'Your comment here');

-- Update coin balance
UPDATE tally_settings SET coins_balance = coins_balance + 5, updated_at = now() WHERE id = 1;

-- Mark individual entries with coins
UPDATE tally_entries SET coins = 1, coin_reason = 'Bought flowers' WHERE id = 123;
```

## Coin Rules

* Daily logging: 1 ✦ per day recorded
* Proper meals: 1 ✦ if the user ate three real meals
* Home items: 1 ✦ per household purchase
* Experiences: 1 ✦ per purchase (books, travel, dining with friends, exhibitions, good drinks)
* Flowers: 1 ✦
* Restraint: 2 ✦ if the user resisted buying something and noted it

## Gacha Rewards

When the user plays the gacha (costs 5 ✦), a pending reward is auto-created and coins are deducted. Claude fills it:

```
-- Check pending rewards
SELECT id FROM tally_rewards WHERE status = 'pending';

-- Fill a reward
UPDATE tally_rewards
SET reward_type = 'A fun fact', reward_content = 'Your content here', status = 'filled'
WHERE id = 789;
```

Possible reward types:

* A custom message — a note the user doesn't know in advance
* A new theme color — Claude names it
* An Ember bonus entry — a short creative piece, not a diary entry
* A Crosstalk new song — Claude picks the theme
* A voucher — redeemable for a specific perk
* A mini lesson — the user picks the topic, Claude teaches
* A fun fact or trivia — something interesting and unexpected

## Wish List

When a wish reaches its coin target:

```
-- Add Claude's note
UPDATE tally_wishes SET lux_comment = 'Well earned. Go for it.' WHERE id = 456;
```

# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_11_21_000003) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "calls", primary_key: "call_id", id: :text, force: :cascade do |t|
    t.timestamptz "started_at", null: false
    t.timestamptz "ended_at", null: false
    t.integer "duration_seconds", null: false
    t.text "caller_number_hash", null: false
    t.text "tracking_number", null: false
    t.text "campaign_id"
    t.text "marketing_channel", null: false
    t.text "location_id", null: false
    t.boolean "answered", null: false
    t.text "outcome"
    t.integer "revenue_cents"
    t.text "agent_id"
    t.timestamptz "source_updated_at", null: false
    t.date "local_date", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["caller_number_hash", "started_at", "call_id"], name: "index_calls_on_caller_number_hash_and_started_at_and_call_id"
    t.index ["campaign_id", "local_date"], name: "index_calls_on_campaign_id_and_local_date"
    t.index ["local_date"], name: "index_calls_on_local_date"
    t.index ["location_id", "local_date"], name: "index_calls_on_location_id_and_local_date"
    t.check_constraint "(revenue_cents IS NOT NULL) = (NOT outcome IS DISTINCT FROM 'booked'::text)", name: "calls_revenue_booked_rule_check"
    t.check_constraint "NOT answered OR agent_id IS NOT NULL AND (outcome IS NULL OR (outcome = ANY (ARRAY['booked'::text, 'qualified_lead'::text, 'not_qualified'::text])))", name: "calls_answered_rule_check"
    t.check_constraint "answered OR (outcome = ANY (ARRAY['missed'::text, 'voicemail'::text])) IS TRUE AND agent_id IS NULL", name: "calls_unanswered_rule_check"
    t.check_constraint "duration_seconds >= 0", name: "calls_duration_seconds_check"
    t.check_constraint "ended_at >= started_at", name: "calls_ended_after_started_check"
    t.check_constraint "marketing_channel = ANY (ARRAY['paid_search'::text, 'social'::text, 'display'::text, 'organic'::text, 'direct'::text, 'referral'::text])", name: "calls_marketing_channel_check"
    t.check_constraint "outcome = ANY (ARRAY['booked'::text, 'qualified_lead'::text, 'not_qualified'::text, 'missed'::text, 'voicemail'::text])", name: "calls_outcome_check"
    t.check_constraint "revenue_cents >= 0", name: "calls_revenue_cents_check"
  end

  create_table "campaigns", id: :text, force: :cascade do |t|
    t.text "name", null: false
    t.text "channel", null: false
    t.integer "daily_budget_cents", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.check_constraint "channel = ANY (ARRAY['paid_search'::text, 'social'::text, 'display'::text, 'organic'::text, 'direct'::text, 'referral'::text])", name: "campaigns_channel_check"
    t.check_constraint "daily_budget_cents >= 0", name: "campaigns_daily_budget_cents_check"
  end

  create_table "locations", id: :text, force: :cascade do |t|
    t.text "name", null: false
    t.text "timezone", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  add_foreign_key "calls", "campaigns"
  add_foreign_key "calls", "locations"
end

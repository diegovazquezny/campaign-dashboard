class CreateCalls < ActiveRecord::Migration[8.1]
  def change
    create_table :calls, id: false do |t|
      t.text :call_id, null: false, primary_key: true
      t.timestamptz :started_at, null: false
      t.timestamptz :ended_at, null: false
      t.integer :duration_seconds, null: false
      t.text :caller_number_hash, null: false
      t.text :tracking_number, null: false
      t.text :campaign_id
      t.text :marketing_channel, null: false
      t.text :location_id, null: false
      t.boolean :answered, null: false
      t.text :outcome
      t.integer :revenue_cents
      t.text :agent_id
      t.timestamptz :source_updated_at, null: false
      t.date :local_date, null: false

      t.timestamps
    end

    add_foreign_key :calls, :campaigns
    add_foreign_key :calls, :locations

    # Literal values on purpose (see CreateCampaigns).
    add_check_constraint :calls, "duration_seconds >= 0", name: "calls_duration_seconds_check"
    add_check_constraint :calls, "revenue_cents >= 0", name: "calls_revenue_cents_check"
    add_check_constraint :calls,
      "outcome IN ('booked','qualified_lead','not_qualified','missed','voicemail')",
      name: "calls_outcome_check"
    add_check_constraint :calls,
      "marketing_channel IN ('paid_search','social','display','organic','direct','referral')",
      name: "calls_marketing_channel_check"
    add_check_constraint :calls,
      "answered OR ((outcome IN ('missed','voicemail')) IS TRUE AND agent_id IS NULL)",
      name: "calls_unanswered_rule_check"
    add_check_constraint :calls,
      "NOT answered OR (agent_id IS NOT NULL AND " \
      "(outcome IS NULL OR outcome IN ('booked','qualified_lead','not_qualified')))",
      name: "calls_answered_rule_check"
    add_check_constraint :calls,
      "(revenue_cents IS NOT NULL) = (outcome IS NOT DISTINCT FROM 'booked')",
      name: "calls_revenue_booked_rule_check"
    add_check_constraint :calls, "ended_at >= started_at", name: "calls_ended_after_started_check"

    add_index :calls, :local_date
    add_index :calls, [ :campaign_id, :local_date ]
    add_index :calls, [ :location_id, :local_date ]
    add_index :calls, [ :caller_number_hash, :started_at, :call_id ]
  end
end

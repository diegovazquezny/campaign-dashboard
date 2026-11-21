class CreateCampaigns < ActiveRecord::Migration[8.1]
  def change
    create_table :campaigns, id: false do |t|
      t.text :id, null: false, primary_key: true
      t.text :name, null: false
      t.text :channel, null: false
      t.integer :daily_budget_cents, null: false

      t.timestamps
    end

    # Literal values on purpose: a later change to Channel::ALL must not
    # silently change what this migration means.
    add_check_constraint :campaigns,
      "channel IN ('paid_search','social','display','organic','direct','referral')",
      name: "campaigns_channel_check"
    add_check_constraint :campaigns, "daily_budget_cents >= 0", name: "campaigns_daily_budget_cents_check"
  end
end

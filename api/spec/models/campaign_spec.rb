require "rails_helper"

RSpec.describe Campaign do
  def build_campaign(**attrs)
    Campaign.new({ id: "cmp_01", name: "Search", channel: "paid_search", daily_budget_cents: 15_000 }.merge(attrs))
  end

  it "defines an enum value for every channel" do
    expect(Campaign.channels.keys).to eq(Channel::ALL)
  end

  it "does not shadow Object#display" do
    expect(build_campaign(channel: "display")).to be_display
  end

  it "round-trips a text primary key" do
    build_campaign.save!
    expect(Campaign.find("cmp_01")).to have_attributes(name: "Search", channel: "paid_search", daily_budget_cents: 15_000)
  end

  it "rejects an unknown channel in the model" do
    expect(build_campaign(channel: "radio")).not_to be_valid
  end

  it "rejects an unknown channel in the database" do
    expect {
      Campaign.insert!({ id: "cmp_01", name: "x", channel: "radio", daily_budget_cents: 0 })
    }.to raise_error(ActiveRecord::StatementInvalid, /campaigns_channel_check/)
  end

  it "rejects a negative budget in the database" do
    expect {
      Campaign.insert!({ id: "cmp_01", name: "x", channel: "social", daily_budget_cents: -1 })
    }.to raise_error(ActiveRecord::StatementInvalid, /campaigns_daily_budget_cents_check/)
  end

  it "allows a $0 budget" do
    expect(build_campaign(daily_budget_cents: 0)).to be_valid
  end
end

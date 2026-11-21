require "rails_helper"

RSpec.describe MetricsData do
  it "builds a valid location and campaign" do
    location = build_location(id: "loc_02", timezone: "America/Phoenix")
    campaign = build_campaign(id: "cmp_02", channel: "social", daily_budget_cents: 0)

    expect(location).to be_persisted
    expect(campaign).to be_persisted
    expect(build_location(id: "loc_02")).to eq(location)
  end

  it "builds a valid answered call with a local date in the office timezone" do
    location = build_location(timezone: "America/New_York")
    call = build_call(started_at: Time.utc(2026, 9, 1, 0, 39), location: location)

    expect(call).to be_persisted
    expect(call.local_date).to eq(Date.new(2026, 8, 31))
    expect(call.marketing_channel).to eq("paid_search")
    expect(call.outcome).to be_nil
  end

  it "builds booked, missed and unattributed calls that satisfy the table constraints" do
    booked = build_call(outcome: "booked", revenue_cents: 5_000)
    missed = build_call(answered: false)
    unattributed = build_call(campaign: nil)

    expect(booked.revenue_cents).to eq(5_000)
    expect(missed.outcome).to eq("missed")
    expect(missed.agent_id).to be_nil
    expect(unattributed.campaign_id).to be_nil
    expect(unattributed.marketing_channel).to eq("direct")
  end

  it "gives each call a distinct id" do
    expect(build_call.call_id).not_to eq(build_call.call_id)
  end
end

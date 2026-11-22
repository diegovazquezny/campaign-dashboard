require "rails_helper"

RSpec.describe Metrics::CampaignCounts do
  let(:range) { { from: Date.new(2026, 9, 1), to: Date.new(2026, 9, 30) } }

  def rows(**opts)
    described_class.call(**range, **opts)
  end

  def row_for(id, **opts)
    rows(**opts).find { |r| r[:campaign_id] == id }
  end

  let!(:cmp1) { build_campaign(id: "cmp_01") }
  let!(:cmp2) { build_campaign(id: "cmp_02", channel: "social") }

  it "counts each metric with a known answer" do
    build_call(id: "c1", caller_number: "a", outcome: "booked", revenue_cents: 30_000)
    build_call(id: "c2", caller_number: "a", started_at: Time.utc(2026, 9, 2, 15), outcome: "qualified_lead")
    build_call(id: "c3", caller_number: "b", started_at: Time.utc(2026, 9, 3, 15)) # awaiting
    build_call(id: "c4", caller_number: "c", started_at: Time.utc(2026, 9, 4, 15), answered: false)
    build_call(id: "c5", caller_number: "d", started_at: Time.utc(2026, 9, 5, 15), outcome: "booked", revenue_cents: 9_000)

    expect(row_for("cmp_01")).to include(
      calls: 5, unique_callers: 4, new_callers: 4, booked: 2, unanswered: 1,
      awaiting_outcome: 1, revenue_cents: 39_000, campaign_calls: 5, channel_breakdown: nil
    )
  end

  it "lists every campaign with zeros when out of range, ordered by id" do
    build_call(campaign: cmp2, started_at: Time.utc(2026, 8, 1, 15), local_date: Date.new(2026, 8, 1))

    result = rows

    expect(result.pluck(:campaign_id)).to eq(%w[cmp_01 cmp_02])
    expect(result).to all(include(calls: 0, unique_callers: 0, new_callers: 0, booked: 0, unanswered: 0,
                                  awaiting_outcome: 0, revenue_cents: 0, campaign_calls: 0))
  end

  it "shows zero office counts but real campaign_calls for a campaign at another office" do
    build_call(location: build_location(id: "loc_02"))
    build_location(id: "loc_01")

    expect(row_for("cmp_01", location_id: "loc_01")).to include(calls: 0, unique_callers: 0, revenue_cents: 0, campaign_calls: 1)
  end

  it "counts a caller who reached two campaigns once as new, per call" do
    build_call(campaign: cmp1, caller_number: "a", started_at: Time.utc(2026, 9, 2, 15))
    build_call(campaign: cmp2, caller_number: "a", started_at: Time.utc(2026, 9, 3, 15))

    expect(row_for("cmp_01")).to include(unique_callers: 1, new_callers: 1)
    expect(row_for("cmp_02")).to include(unique_callers: 1, new_callers: 0)
  end

  it "does not let a call before the range make a later call new" do
    build_call(caller_number: "a", started_at: Time.utc(2026, 8, 1, 15), local_date: Date.new(2026, 8, 1))
    build_call(caller_number: "a", started_at: Time.utc(2026, 9, 2, 15))

    expect(row_for("cmp_01")).to include(calls: 1, new_callers: 0)
  end

  it "uses local_date, not the UTC date, for the range" do
    ny = build_location(timezone: "America/New_York")
    build_call(location: ny, started_at: Time.utc(2026, 9, 1, 2)) # 2026-08-31 local: out
    build_call(location: ny, caller_number: "b", started_at: Time.utc(2026, 10, 1, 2)) # 2026-09-30 local: in

    expect(row_for("cmp_01")).to include(calls: 1)
  end

  describe '"No campaign" row' do
    it "is absent when there are no unattributed calls" do
      build_call

      expect(rows.pluck(:campaign_id)).to eq(%w[cmp_01 cmp_02])
    end

    it "is absent when its calls are all at other offices" do
      build_location(id: "loc_01")
      build_call(campaign: nil, location: build_location(id: "loc_02"))

      expect(rows(location_id: "loc_01").pluck(:campaign_id)).to eq(%w[cmp_01 cmp_02])
    end

    it "comes last with a channel breakdown, by calls desc then channel" do
      build_call(campaign: nil, caller_number: "a", marketing_channel: "organic")
      build_call(campaign: nil, caller_number: "b", marketing_channel: "organic")
      build_call(campaign: nil, caller_number: "c", marketing_channel: "direct")
      build_call(campaign: nil, caller_number: "d", marketing_channel: "referral")

      last = rows.last

      expect(last).to include(campaign_id: nil, name: "No campaign", channel: nil, calls: 4, campaign_calls: 4)
      expect(last[:channel_breakdown].map { |b| b.slice("channel", "calls") }).to eq([
        { "channel" => "organic", "calls" => 2 },
        { "channel" => "direct", "calls" => 1 },
        { "channel" => "referral", "calls" => 1 }
      ])
    end

    it "limits the breakdown to the selected office but keeps campaign_calls" do
      loc1 = build_location(id: "loc_01")
      loc2 = build_location(id: "loc_02")
      build_call(campaign: nil, location: loc1, caller_number: "a", marketing_channel: "organic")
      build_call(campaign: nil, location: loc2, caller_number: "b", marketing_channel: "direct")

      last = rows(location_id: "loc_01").last

      expect(last).to include(calls: 1, campaign_calls: 2)
      expect(last[:channel_breakdown].map { |b| b.slice("channel", "calls") })
        .to eq([ { "channel" => "organic", "calls" => 1 } ])
    end
  end
end

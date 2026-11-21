require "rails_helper"

RSpec.describe Metrics::CampaignDaily do
  let(:from) { Date.new(2026, 9, 1) }
  let(:to) { Date.new(2026, 9, 10) }
  let!(:campaign) { build_campaign(id: "cmp_01", daily_budget_cents: 10_000) }

  def day(n, hour = 15)
    Time.utc(2026, 9, n, hour)
  end

  def days(campaign: self.campaign, from: self.from, to: self.to, **opts)
    described_class.call(campaign:, from:, to:, **opts)[:days]
  end

  def total_spend(campaign: self.campaign, from: self.from, to: self.to, location_id: nil)
    cov = Metrics::DataCoverage.current
    Metrics::CampaignMetrics.rows(from:, to:, location_id:).find { |r| r[:campaign_id] == campaign.id }[:spend_cents] if cov
  end

  # Calls on Sep 3 and Sep 8 pin coverage to [Sep 3, Sep 8] for another campaign.
  def pin_coverage
    other = build_campaign(id: "cmp_99", daily_budget_cents: 0)
    build_call(campaign: other, caller_number: "anchor_a", started_at: day(3))
    build_call(campaign: other, caller_number: "anchor_b", started_at: day(8))
  end

  it "returns the campaign and every date, zero-filled" do
    build_call(started_at: day(2), outcome: "booked", revenue_cents: 5_000)
    result = described_class.call(campaign:, from:, to:)

    expect(result[:campaign]).to eq(id: "cmp_01", name: "Campaign cmp_01")
    expect(result[:days].pluck(:date)).to eq((from..to).to_a)
    expect(result[:days].reject { |d| d[:date] == Date.new(2026, 9, 2) })
      .to all(include(calls: 0, booked: 0, revenue_cents: 0))
  end

  it "counts calls, bookings and revenue per local_date for this campaign only" do
    ny = build_location(id: "loc_01", timezone: "America/New_York")
    build_call(location: ny, caller_number: "a", started_at: day(2), outcome: "booked", revenue_cents: 5_000)
    build_call(location: ny, caller_number: "b", started_at: day(2))
    # 2026-09-04T02:00Z is Sep 3 in New York.
    build_call(location: ny, caller_number: "c", started_at: day(4, 2), outcome: "booked", revenue_cents: 7_000)
    build_call(campaign: build_campaign(id: "cmp_02"), caller_number: "d", started_at: day(2))

    by_date = days.index_by { |d| d[:date].to_s }
    expect(by_date["2026-09-02"]).to include(calls: 2, booked: 1, revenue_cents: 5_000)
    expect(by_date["2026-09-03"]).to include(calls: 1, booked: 1, revenue_cents: 7_000)
    expect(by_date["2026-09-04"]).to include(calls: 0, revenue_cents: 0)
  end

  it "applies the location filter to counts" do
    build_location(id: "loc_02")
    build_call(caller_number: "a", started_at: day(2))
    build_call(caller_number: "b", started_at: day(2), location: "loc_02")

    expect(days(location_id: "loc_02").find { |d| d[:date] == Date.new(2026, 9, 2) }).to include(calls: 1)
  end

  describe "spend without a location filter" do
    before { pin_coverage }

    it "is the budget on covered days and 0 outside coverage, summing to the table figure" do
      spend = days.pluck(:spend_cents)

      expect(spend).to eq([ 0, 0 ] + [ 10_000 ] * 6 + [ 0, 0 ])
      expect(spend.sum).to eq(total_spend)
    end

    it "is nil for a $0-budget campaign" do
      free = build_campaign(id: "cmp_02", daily_budget_cents: 0)

      expect(days(campaign: free).pluck(:spend_cents)).to all(be_nil)
    end

    it "is 0 on every day when the range misses coverage" do
      expect(days(from: Date.new(2026, 10, 1), to: Date.new(2026, 10, 3)).pluck(:spend_cents)).to eq([ 0, 0, 0 ])
    end
  end

  describe "spend with a location filter" do
    before do
      pin_coverage
      build_location(id: "loc_02")
      build_call(caller_number: "a", started_at: day(4))
      build_call(caller_number: "b", started_at: day(5), location: "loc_02")
      build_call(caller_number: "c", started_at: day(6), location: "loc_02")
    end

    it "allocates by call share, summing exactly to the table figure" do
      spend = days(location_id: "loc_02").pluck(:spend_cents)

      expect(spend.sum).to eq(total_spend(location_id: "loc_02"))
      expect(spend.sum).to eq((2 * 10_000 * 6 / 3.0).round)
      expect(spend.first(2)).to eq([ 0, 0 ])
    end

    it "sums to the table figure when per-day rounding would drift (1/3 share, odd budget)" do
      odd = build_campaign(id: "cmp_03", daily_budget_cents: 10_001)
      build_call(campaign: odd, caller_number: "x", started_at: day(4), location: "loc_02")
      build_call(campaign: odd, caller_number: "y", started_at: day(5))
      build_call(campaign: odd, caller_number: "z", started_at: day(6))

      spend = days(campaign: odd, location_id: "loc_02").pluck(:spend_cents)
      expect(spend.sum).to eq(total_spend(campaign: odd, location_id: "loc_02"))
      expect(spend.sum).to eq((Rational(10_001 * 6, 3)).round)
    end

    it "is 0 for an office with no calls when the campaign has calls elsewhere" do
      build_location(id: "loc_03")

      expect(days(location_id: "loc_03").pluck(:spend_cents)).to all(eq(0))
    end

    it "is nil when the campaign has no calls in range" do
      quiet = build_campaign(id: "cmp_04", daily_budget_cents: 10_000)

      expect(days(campaign: quiet, location_id: "loc_02").pluck(:spend_cents)).to all(be_nil)
    end

    it "is nil for a $0-budget campaign" do
      free = build_campaign(id: "cmp_05", daily_budget_cents: 0)
      build_call(campaign: free, caller_number: "f", started_at: day(4), location: "loc_02")

      expect(days(campaign: free, location_id: "loc_02").pluck(:spend_cents)).to all(be_nil)
    end
  end

  it "has 0 spend when there is no coverage at all" do
    expect(days.pluck(:spend_cents)).to all(eq(0))
  end

  it "returns numbers, not BigDecimal" do
    pin_coverage
    build_call(started_at: day(4), outcome: "booked", revenue_cents: 100)

    expect(days.flat_map { |d| d.except(:date).values }).to all(be_a(Integer))
  end
end

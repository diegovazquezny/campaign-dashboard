require "rails_helper"

RSpec.describe Metrics::CampaignMetrics do
  let(:from) { Date.new(2026, 9, 1) }
  let(:to) { Date.new(2026, 9, 10) }

  def rows(from: self.from, to: self.to, **opts)
    described_class.rows(from:, to:, **opts)
  end

  def row_for(id, **)
    rows(**).find { |r| r[:campaign_id] == id }
  end

  def day(n, hour = 15)
    Time.utc(2026, 9, n, hour)
  end

  # Calls on Sep 1 and Sep 10 pin the data coverage to [Sep 1, Sep 10].
  def pin_coverage(campaign: nil)
    build_call(campaign: campaign, caller_number: "anchor_a", started_at: day(1))
    build_call(campaign: campaign, caller_number: "anchor_b", started_at: day(10))
  end

  let!(:paid) { build_campaign(id: "cmp_01", daily_budget_cents: 10_000) }
  let!(:free) { build_campaign(id: "cmp_02", daily_budget_cents: 0) }

  describe "formulas" do
    before do
      build_call(caller_number: "a", started_at: day(1), outcome: "booked", revenue_cents: 20_000)
      build_call(caller_number: "b", started_at: day(2), outcome: "booked", revenue_cents: 10_000)
      build_call(caller_number: "c", started_at: day(3), answered: false)
      build_call(caller_number: "d", started_at: day(10)) # awaiting
    end

    it "computes counts, spend and every ratio" do
      expect(row_for("cmp_01")).to include(
        calls: 4, booked: 2, awaiting_outcome: 1, revenue_cents: 30_000,
        spend_cents: 100_000, booking_rate: 0.5, unanswered_rate: 0.25,
        revenue_per_spend: 0.3, spend_per_booking_cents: 50_000.0
      )
    end

    it "returns numbers, not BigDecimal" do
      row = row_for("cmp_01")

      expect(row.except(:campaign_id, :name, :channel).values).to all(be_a(Numeric))
    end

    it "gives nil ratios for 0 bookings and for a $0 budget" do
      build_call(campaign: free, caller_number: "e", started_at: day(4), outcome: "booked", revenue_cents: 5_000)
      build_call(campaign: paid, caller_number: "f", started_at: day(5), answered: false)

      expect(row_for("cmp_02")).to include(spend_cents: nil, revenue_per_spend: nil, spend_per_booking_cents: nil, booking_rate: 1.0)
      # cmp_01 already has bookings, so check a campaign with none:
      other = build_campaign(id: "cmp_03", daily_budget_cents: 1_000)
      build_call(campaign: other, caller_number: "g", started_at: day(6))
      expect(row_for("cmp_03")).to include(spend_cents: 10_000, booked: 0, booking_rate: 0.0,
                                           revenue_per_spend: 0.0, spend_per_booking_cents: nil)
    end

    it "gives nil rates for a campaign with no calls" do
      expect(row_for("cmp_02")).to include(calls: 0, booking_rate: nil, unanswered_rate: nil)
    end

    it "gives the No campaign row a nil spend, and the breakdown only there" do
      build_call(campaign: nil, caller_number: "n", started_at: day(5), marketing_channel: "organic",
                 outcome: "booked", revenue_cents: 7_000)

      result = rows
      last = result.last

      expect(last).to include(campaign_id: nil, name: "No campaign", spend_cents: nil,
                              revenue_per_spend: nil, spend_per_booking_cents: nil)
      expect(last[:channel_breakdown]).to eq([ { "channel" => "organic", "calls" => 1 } ])
      expect(result.first).not_to have_key(:channel_breakdown)
    end
  end

  describe "coverage clipping" do
    before { pin_coverage(campaign: paid) }

    it "charges only covered days when the range extends past coverage" do
      expect(row_for("cmp_01", from: Date.new(2026, 8, 25), to: to)[:spend_cents]).to eq(100_000)
    end

    it "charges the covered part of a partial overlap" do
      expect(row_for("cmp_01", from: Date.new(2026, 9, 8), to: Date.new(2026, 9, 20))[:spend_cents]).to eq(30_000)
    end

    it "gives 0 spend and nil ratios when the range is outside coverage" do
      row = row_for("cmp_01", from: Date.new(2026, 10, 1), to: Date.new(2026, 10, 10))

      expect(row).to include(calls: 0, spend_cents: 0, revenue_per_spend: nil, spend_per_booking_cents: nil)
    end
  end

  describe "with a location filter" do
    let(:from) { Date.new(2026, 9, 1) }
    let(:to) { Date.new(2026, 9, 21) }
    let!(:loc1) { build_location(id: "loc_01") }
    let!(:loc2) { build_location(id: "loc_02") }
    let!(:loc3) { build_location(id: "loc_03") }
    let!(:cmp) { build_campaign(id: "cmp_03", daily_budget_cents: 10_001) }

    before do
      # 3 calls at loc_01 and 4 at loc_02 over three weeks; coverage Sep 1..Sep 21.
      [ [ 1, loc1 ], [ 8, loc1 ], [ 15, loc1 ], [ 2, loc2 ], [ 9, loc2 ], [ 16, loc2 ], [ 21, loc2 ] ].each_with_index do |(d, loc), i|
        build_call(campaign: cmp, location: loc, caller_number: "c#{i}", started_at: day(d))
      end
    end

    it "allocates spend by call share and matches the oracle within half a cent" do
      { "loc_01" => 3, "loc_02" => 4 }.each do |loc, office_calls|
        expected = SpendOracle.total_cents(budget: 10_001, covered_days: 21, filtered: true,
                                           office_calls: office_calls, campaign_calls: 7)
        exact = Rational(office_calls * 10_001 * 21, 7)

        spend = row_for("cmp_03", location_id: loc)[:spend_cents]

        expect(spend).to eq(expected)
        expect((spend - exact).abs).to be <= Rational(1, 2)
      end
    end

    it "gives an office with no calls for a campaign that has calls elsewhere 0 spend" do
      expect(row_for("cmp_03", location_id: "loc_03")).to include(calls: 0, spend_cents: 0, revenue_per_spend: nil)
    end

    it "gives nil spend for a campaign with no calls in range, and for a $0 budget" do
      expect(row_for("cmp_01", location_id: "loc_01")[:spend_cents]).to be_nil
      expect(row_for("cmp_02", location_id: "loc_01")[:spend_cents]).to be_nil
    end

    it "gives nil spend to a campaign with no calls in range even when no day is covered" do
      expect(row_for("cmp_01", from: Date.new(2026, 11, 1), to: Date.new(2026, 11, 5), location_id: "loc_01")[:spend_cents]).to be_nil
    end

    it "gives the unfiltered spend of the full budget when there is no filter" do
      expect(row_for("cmp_03")[:spend_cents]).to eq(10_001 * 21)
      expect(row_for("cmp_01")[:spend_cents]).to eq(10_000 * 21)
    end
  end
end

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
      expect(last[:channel_breakdown]).to eq([ { "channel" => "organic", "calls" => 1, "booked" => 1, "revenue_cents" => 7_000 } ])
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

  describe ".call totals" do
    def totals(**)
      described_class.call(from:, to:, **)[:totals]
    end

    def book(campaign, caller, d, revenue)
      build_call(campaign: campaign, caller_number: caller, started_at: day(d), outcome: "booked", revenue_cents: revenue)
    end

    it "returns the range, rows and exactly the documented totals keys" do
      build_call(caller_number: "a", started_at: day(1))

      result = described_class.call(from:, to:)

      expect(result[:range]).to eq(from: from, to: to)
      expect(result[:rows].pluck(:campaign_id)).to eq(%w[cmp_01 cmp_02])
      expect(result[:totals].keys).to eq(%i[calls unique_callers new_callers booked booking_rate unanswered_rate
                                            missed voicemail awaiting_outcome revenue_cents spend_cents paid])
      expect(result[:totals][:paid].keys).to eq(%i[revenue_cents booked spend_cents revenue_per_spend spend_per_booking_cents])
    end

    it "counts a caller who reached two campaigns once in unique_callers but twice in calls" do
      build_call(campaign: paid, caller_number: "same", started_at: day(1))
      build_call(campaign: free, caller_number: "same", started_at: day(2))

      expect(totals).to include(calls: 2, unique_callers: 1, new_callers: 1)
      expect(rows.sum { |r| r[:unique_callers] }).to eq(2)
    end

    it "splits unanswered into missed and voicemail in totals, including No campaign" do
      build_call(campaign: paid, caller_number: "a", started_at: day(1), answered: false, outcome: "missed")
      build_call(campaign: paid, caller_number: "b", started_at: day(2), answered: false, outcome: "voicemail")
      build_call(campaign: nil, caller_number: "c", started_at: day(3), answered: false, outcome: "voicemail")
      build_call(campaign: free, caller_number: "d", started_at: day(4), answered: false, outcome: "missed")
      build_call(campaign: free, caller_number: "e", started_at: day(5))

      expect(totals).to include(missed: 2, voicemail: 2, calls: 5)
      expect(totals[:missed] + totals[:voicemail]).to eq((totals[:unanswered_rate] * totals[:calls]).round)
      expect(rows.first).not_to have_key(:missed)
    end

    it "extends the No campaign channel_breakdown so it sums to the row totals" do
      build_call(campaign: nil, caller_number: "a", started_at: day(1), marketing_channel: "organic",
                 outcome: "booked", revenue_cents: 7_000)
      build_call(campaign: nil, caller_number: "b", started_at: day(2), marketing_channel: "organic")
      build_call(campaign: nil, caller_number: "c", started_at: day(3), marketing_channel: "direct",
                 outcome: "booked", revenue_cents: 3_000)

      row = rows.last
      expect(row[:channel_breakdown]).to eq([
        { "channel" => "organic", "calls" => 2, "booked" => 1, "revenue_cents" => 7_000 },
        { "channel" => "direct", "calls" => 1, "booked" => 1, "revenue_cents" => 3_000 }
      ])
      expect(row[:channel_breakdown].sum { |b| b["calls"] }).to eq(row[:calls])
      expect(row[:channel_breakdown].sum { |b| b["booked"] }).to eq(row[:booked])
      expect(row[:channel_breakdown].sum { |b| b["revenue_cents"] }).to eq(row[:revenue_cents])
    end

    it "recomputes rates from summed counts rather than averaging" do
      book(paid, "a", 1, 10_000)
      build_call(campaign: paid, caller_number: "b", started_at: day(2), answered: false)
      build_call(campaign: free, caller_number: "c", started_at: day(3), answered: false)
      build_call(campaign: free, caller_number: "d", started_at: day(10), answered: false)
      build_call(campaign: free, caller_number: "e", started_at: day(4), answered: false)
      build_call(campaign: free, caller_number: "f", started_at: day(5), answered: false)

      # booking rows: cmp_01 1/2 = 0.5, cmp_02 0/4 = 0; average would be 0.25, summed is 1/6.
      expect(totals[:booking_rate]).to eq(1.0 / 6)
      expect(totals[:unanswered_rate]).to eq(5.0 / 6)
    end

    it "includes No campaign in counts and revenue but excludes it and $0 budgets from paid" do
      book(paid, "a", 1, 20_000)
      book(paid, "b", 10, 10_000)
      book(free, "c", 2, 5_000)
      build_call(campaign: nil, caller_number: "n", started_at: day(3), outcome: "booked", revenue_cents: 7_000)

      expect(totals).to include(calls: 4, booked: 4, revenue_cents: 42_000, spend_cents: 100_000)
      expect(totals[:paid]).to eq(revenue_cents: 30_000, booked: 2, spend_cents: 100_000,
                                  revenue_per_spend: 0.3, spend_per_booking_cents: 50_000.0)
    end

    it "gives nil spend and zero paid sums when every row's spend is nil" do
      only_free = build_campaign(id: "cmp_03", daily_budget_cents: 0)
      Campaign.where(id: "cmp_01").delete_all
      book(only_free, "a", 1, 5_000)
      build_call(campaign: nil, caller_number: "n", started_at: day(2), outcome: "booked", revenue_cents: 1_000)

      expect(totals).to include(revenue_cents: 6_000, spend_cents: nil)
      expect(totals[:paid]).to eq(revenue_cents: 0, booked: 0, spend_cents: nil, revenue_per_spend: nil, spend_per_booking_cents: nil)
    end

    it "includes a paid row with spend 0 in paid, next to a row with spend" do
      # At loc_01, cmp_01 has calls only elsewhere (spend 0); cmp_03 has a booking here.
      loc2 = build_location(id: "loc_02")
      other = build_campaign(id: "cmp_03", daily_budget_cents: 1_000)
      build_call(campaign: paid, location: loc2, caller_number: "a", started_at: day(1))
      build_call(campaign: other, caller_number: "z", started_at: day(10), outcome: "booked", revenue_cents: 2_000)

      result = described_class.call(from:, to:, location_id: "loc_01")
      zero_row = result[:rows].find { |r| r[:campaign_id] == "cmp_01" }

      expect(zero_row).to include(calls: 0, spend_cents: 0, revenue_per_spend: nil)
      # A zero-spend row never has revenue (no office calls), so paid equals the spending row; the point is
      # that the 0 is "non-null spend": paid is computed and ratios are real numbers.
      expect(result[:totals][:paid]).to eq(revenue_cents: 2_000, booked: 1, spend_cents: 10_000,
                                           revenue_per_spend: 0.2, spend_per_booking_cents: 10_000.0)
    end

    it "gives nil paid ratios when the only non-null spend is 0" do
      build_call(campaign: paid, caller_number: "a", started_at: day(1))

      out = described_class.call(from: Date.new(2026, 10, 1), to: Date.new(2026, 10, 5))[:totals]

      expect(out[:paid]).to eq(revenue_cents: 0, booked: 0, spend_cents: 0, revenue_per_spend: nil, spend_per_booking_cents: nil)
    end

    it "only counts callers inside the date range in unique_callers" do
      build_call(campaign: paid, caller_number: "in", started_at: day(5))
      build_call(campaign: paid, caller_number: "before", started_at: Time.utc(2026, 8, 20, 15), local_date: Date.new(2026, 8, 20))
      build_call(campaign: paid, caller_number: "after", started_at: Time.utc(2026, 9, 20, 15), local_date: Date.new(2026, 9, 20))

      expect(totals).to include(calls: 1, unique_callers: 1)
    end

    it "returns zeroed totals with no campaigns and no calls" do
      Campaign.delete_all

      result = described_class.call(from:, to:)

      expect(result[:rows]).to eq([])
      expect(result[:totals]).to include(calls: 0, unique_callers: 0, booked: 0, revenue_cents: 0, spend_cents: nil,
                                         booking_rate: nil, unanswered_rate: nil)
      expect(result[:totals][:paid]).to eq(revenue_cents: 0, booked: 0, spend_cents: nil, revenue_per_spend: nil, spend_per_booking_cents: nil)
    end

    it "applies the location filter to counts, unique callers and spend" do
      loc2 = build_location(id: "loc_02")
      build_call(campaign: paid, caller_number: "a", started_at: day(1))
      build_call(campaign: paid, caller_number: "b", started_at: day(10))
      build_call(campaign: paid, caller_number: "a", location: loc2, started_at: day(5))
      build_call(campaign: paid, caller_number: "c", location: loc2, started_at: day(6))

      expect(totals(location_id: "loc_01")).to include(calls: 2, unique_callers: 2, spend_cents: 50_000)
      expect(totals(location_id: "loc_02")).to include(calls: 2, unique_callers: 2, spend_cents: 50_000)
    end

    it "does not confuse the No campaign row with the grand total" do
      build_call(caller_number: "a", started_at: day(1))
      expect(described_class.call(from:, to:)[:rows].pluck(:campaign_id)).to eq(%w[cmp_01 cmp_02])

      build_call(campaign: nil, caller_number: "n", started_at: day(2))
      result = described_class.call(from:, to:)

      expect(result[:rows].pluck(:campaign_id)).to eq([ "cmp_01", "cmp_02", nil ])
      expect(result[:totals]).to include(calls: 2)
      expect(result[:rows].last).to include(calls: 1)
    end

    it "gives only numbers or nil in every total field" do
      book(paid, "a", 1, 10_000)
      build_call(campaign: nil, caller_number: "n", started_at: day(10))

      t = totals
      values = t.except(:paid).values + t[:paid].values

      expect(values).to all(satisfy { |v| v.nil? || v.is_a?(Numeric) && !v.is_a?(BigDecimal) })
    end
  end
end

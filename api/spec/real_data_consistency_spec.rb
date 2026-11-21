require "rails_helper"

# Cross-endpoint consistency on the real CSVs in data/: the daily series must
# add up to the metrics table, whatever the range or office. Non-transactional;
# the import runs once for the whole group and is wiped afterwards.
RSpec.describe "Metrics and daily consistency on the real data", :real_data do
  self.use_transactional_tests = false

  before(:all) do
    CleanDatabase.wipe!
    Importer.run(data_dir: Rails.root.join("..", "data").to_s)
  end
  after(:all) { CleanDatabase.wipe! }

  # Derived from the imported data, so the labels stay true if the CSVs change.
  let(:coverage_from) { Call.minimum(:local_date) }
  let(:coverage_to) { Call.maximum(:local_date) }
  let(:ranges) do
    {
      "inside coverage" => [ coverage_from + 1, coverage_to ],
      "overlapping the start" => [ coverage_from - 16, coverage_from + 15 ],
      "overlapping the end" => [ coverage_to - 14, coverage_to + 17 ],
      "wider than coverage" => [ coverage_from - 30, coverage_to + 32 ]
    }
  end
  let(:quarters) { [ [ Date.new(2026, 7, 1), Date.new(2026, 9, 30) ], [ Date.new(2026, 10, 1), Date.new(2026, 12, 31) ] ] }

  # Nil-aware: nil only when every day is nil. Only spend_cents can be nil (no
  # budget, or no covered day); calls, booked and revenue_cents are zero-filled
  # in both endpoints, so the metrics row and the daily sum agree on nil vs 0.
  def sum_of(days, key)
    values = days.pluck(key).compact
    values.empty? ? nil : values.sum
  end

  let(:campaigns) { Campaign.all.index_by(&:id) }

  def expect_daily_matches_metrics(from:, to:, location_id: nil)
    rows = Metrics::CampaignMetrics.call(from:, to:, location_id:)[:rows].reject { |r| r[:campaign_id].nil? }
    expect(rows.size).to eq(campaigns.size)

    rows.each do |row|
      campaign = campaigns.fetch(row[:campaign_id])
      days = Metrics::CampaignDaily.call(campaign:, from:, to:, location_id:)[:days]
      expect(days.size).to eq((to - from).to_i + 1)
      %i[spend_cents revenue_cents calls booked].each do |key|
        expect(sum_of(days, key)).to eq(row[key]),
          "#{campaign.id} #{key} #{from}..#{to} loc=#{location_id.inspect}: daily #{sum_of(days, key).inspect} vs row #{row[key].inspect}"
      end
    end
  end

  it "uses ranges that overlap the data coverage as their labels say" do
    inside, start_overlap, end_overlap, wider = ranges.values_at("inside coverage", "overlapping the start",
                                                                   "overlapping the end", "wider than coverage")

    expect(inside.first).to be >= coverage_from
    expect(inside.last).to be <= coverage_to
    expect(start_overlap.first).to be < coverage_from
    expect(start_overlap.last).to be_between(coverage_from, coverage_to)
    expect(end_overlap.first).to be_between(coverage_from, coverage_to)
    expect(end_overlap.last).to be > coverage_to
    expect(wider.first).to be < coverage_from
    expect(wider.last).to be > coverage_to
  end

  it "has daily sums equal to each campaign's metrics row, for every range" do
    ranges.each_value { |from, to| expect_daily_matches_metrics(from:, to:) }
  end

  it "has daily sums equal to each campaign's metrics row, for every location and range" do
    Location.pluck(:id).each do |location_id|
      ranges.each_value { |from, to| expect_daily_matches_metrics(from:, to:, location_id:) }
    end
  end

  it "has totals that equal the rows and the calls table over a quarter" do
    quarters.each do |from, to|
      result = Metrics::CampaignMetrics.call(from:, to:)
      in_range = Call.where(local_date: from..to)

      expect(result[:totals][:calls]).to eq(result[:rows].sum { |r| r[:calls] })
      expect(result[:totals][:calls]).to eq(in_range.count)
      expect(result[:totals][:revenue_cents]).to eq(in_range.sum(:revenue_cents))
    end
  end

  it "never produces NaN or Infinity in a ratio" do
    ratio_keys = %i[booking_rate unanswered_rate revenue_per_spend spend_per_booking_cents]
    ranges.values.product([ nil ] + Location.pluck(:id)).each do |(from, to), location_id|
      result = Metrics::CampaignMetrics.call(from:, to:, location_id:)
      values = result[:rows].flat_map { |r| r.values_at(*ratio_keys) } +
               result[:totals].values_at(:booking_rate, :unanswered_rate) +
               result[:totals][:paid].values_at(:revenue_per_spend, :spend_per_booking_cents)
      expect(values.compact).to all(satisfy { |v| v.finite? })
    end
  end

  it "reports /api/meta coverage as the min and max local_date of the calls" do
    session = ActionDispatch::Integration::Session.new(Rails.application)
    session.get "/api/meta"
    coverage = JSON.parse(session.response.body).fetch("data_coverage")
    expect(coverage).to eq("from" => Call.minimum(:local_date).iso8601, "to" => Call.maximum(:local_date).iso8601)
  end
end

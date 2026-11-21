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

  let(:ranges) do
    {
      "inside coverage" => [ Date.new(2026, 9, 1), Date.new(2026, 10, 29) ],
      "overlapping the start" => [ Date.new(2026, 8, 15), Date.new(2026, 9, 15) ],
      "overlapping the end" => [ Date.new(2026, 10, 15), Date.new(2026, 11, 15) ],
      "wider than coverage" => [ Date.new(2026, 8, 1), Date.new(2026, 11, 30) ]
    }
  end
  let(:quarters) { [ [ Date.new(2026, 7, 1), Date.new(2026, 9, 30) ], [ Date.new(2026, 10, 1), Date.new(2026, 12, 31) ] ] }

  # Nil-aware: nil only when every day is nil.
  def sum_of(days, key)
    values = days.pluck(key).compact
    values.empty? ? nil : values.sum
  end

  def expect_daily_matches_metrics(from:, to:, location_id: nil)
    rows = Metrics::CampaignMetrics.call(from:, to:, location_id:)[:rows].reject { |r| r[:campaign_id].nil? }
    expect(rows.size).to eq(Campaign.count)

    rows.each do |row|
      campaign = Campaign.find(row[:campaign_id])
      days = Metrics::CampaignDaily.call(campaign:, from:, to:, location_id:)[:days]
      expect(days.size).to eq((to - from).to_i + 1)
      %i[spend_cents revenue_cents calls booked].each do |key|
        expect(sum_of(days, key)).to eq(row[key]),
          "#{campaign.id} #{key} #{from}..#{to} loc=#{location_id.inspect}: daily #{sum_of(days, key).inspect} vs row #{row[key].inspect}"
      end
    end
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

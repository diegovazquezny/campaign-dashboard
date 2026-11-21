require "rails_helper"

RSpec.describe Metrics::DataCoverage do
  it "is nil when there are no calls" do
    expect(described_class.current).to be_nil
  end

  it "uses local dates, not UTC dates" do
    ny = build_location(timezone: "America/New_York")
    build_call(location: ny, started_at: Time.utc(2026, 9, 1, 0, 39)) # 2026-08-31 local
    build_call(location: ny, started_at: Time.utc(2026, 9, 5, 15))

    result = described_class.current

    expect([ result.from, result.to ]).to eq([ Date.new(2026, 8, 31), Date.new(2026, 9, 5) ])
  end

  it "exposes the latest source_updated_at" do
    build_call(started_at: Time.utc(2026, 9, 1, 15))
    build_call(started_at: Time.utc(2026, 9, 2, 15), duration_seconds: 120)

    expect(described_class.current.latest_update_at).to eq(Time.utc(2026, 9, 2, 15, 2))
  end
end

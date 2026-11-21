require "rails_helper"

RSpec.describe Metrics::CallFacts do
  let(:range) { { from: Date.new(2026, 9, 1), to: Date.new(2026, 9, 30) } }

  def facts(**opts)
    ActiveRecord::Base.connection.select_all(described_class.sql(**range, **opts)).to_a.index_by { |r| r["call_id"] }
  end

  it "returns one row per call in range, by local_date" do
    ny = build_location(timezone: "America/New_York")
    # 2026-10-01T02:00Z is 2026-09-30 locally (in range); 2026-09-01T02:00Z is 2026-08-31 (out).
    build_call(id: "in", location: ny, started_at: Time.utc(2026, 10, 1, 2))
    build_call(id: "out", location: ny, started_at: Time.utc(2026, 9, 1, 2))

    expect(facts.keys).to eq([ "in" ])
  end

  it "derives booked, unanswered, awaiting and revenue" do
    build_call(id: "booked", outcome: "booked", revenue_cents: 5_000)
    build_call(id: "lead", outcome: "qualified_lead")
    build_call(id: "awaiting")
    build_call(id: "missed", answered: false)

    rows = facts
    expect(rows["booked"].slice("booked", "unanswered", "awaiting", "revenue_cents"))
      .to eq("booked" => true, "unanswered" => false, "awaiting" => false, "revenue_cents" => 5_000)
    expect(rows["lead"].slice("booked", "awaiting")).to eq("booked" => false, "awaiting" => false)
    expect(rows["awaiting"].slice("booked", "awaiting", "revenue_cents")).to eq("booked" => false, "awaiting" => true, "revenue_cents" => 0)
    expect(rows["missed"].slice("unanswered", "awaiting")).to eq("unanswered" => true, "awaiting" => false)
  end

  it "flags every row at_office without a location filter" do
    build_call(id: "a", location: build_location(id: "loc_01"))
    build_call(id: "b", location: build_location(id: "loc_02"), caller_number: "other")

    expect(facts.values.pluck("at_office")).to all(be(true))
  end

  it "keeps other offices' rows but flags only the office, and skips is_new for them" do
    build_call(id: "here", location: build_location(id: "loc_01"), caller_number: "x")
    build_call(id: "there", location: build_location(id: "loc_02"), caller_number: "y")

    rows = facts(location_id: "loc_01")

    expect(rows.keys).to contain_exactly("here", "there")
    expect(rows["here"].slice("at_office", "is_new")).to eq("at_office" => true, "is_new" => true)
    expect(rows["there"].slice("at_office", "is_new")).to eq("at_office" => false, "is_new" => false)
  end

  describe "is_new" do
    it "is false when the caller had an earlier call before the range" do
      build_call(id: "old", started_at: Time.utc(2026, 8, 1, 15), local_date: Date.new(2026, 8, 1))
      build_call(id: "later", started_at: Time.utc(2026, 9, 5, 15))

      expect(facts["later"]["is_new"]).to be(false)
    end

    it "is false when the earlier call was at another office or campaign" do
      build_call(id: "old", location: build_location(id: "loc_02"), campaign: build_campaign(id: "cmp_02"),
                 started_at: Time.utc(2026, 8, 1, 15), local_date: Date.new(2026, 8, 1))
      build_call(id: "later", location: build_location(id: "loc_01"), started_at: Time.utc(2026, 9, 5, 15))

      expect(facts(location_id: "loc_01")["later"]["is_new"]).to be(false)
    end

    it "is true only for the first of a caller's calls" do
      build_call(id: "first", started_at: Time.utc(2026, 9, 2, 15))
      build_call(id: "second", started_at: Time.utc(2026, 9, 3, 15))

      expect(facts.transform_values { |r| r["is_new"] }).to eq("first" => true, "second" => false)
    end

    it "breaks started_at ties by call_id" do
      t = Time.utc(2026, 9, 2, 15)
      build_call(id: "call_b", started_at: t)
      build_call(id: "call_a", started_at: t)

      expect(facts.transform_values { |r| r["is_new"] }).to eq("call_a" => true, "call_b" => false)
    end
  end
end

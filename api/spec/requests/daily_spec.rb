require "rails_helper"

RSpec.describe "GET /api/daily", type: :request do
  let(:path) { "/api/daily" }
  let(:params) { { from: "2026-09-01", to: "2026-09-05" } }
  let(:body) { JSON.parse(response.body) }

  before do
    build_location(id: "loc_01")
    build_location(id: "loc_02")
    build_campaign(id: "cmp_01", name: "Brand")
    build_call(caller_number: "a", started_at: Time.utc(2026, 9, 1, 15), outcome: "booked", revenue_cents: 20_000)
    build_call(caller_number: "b", started_at: Time.utc(2026, 9, 5, 15), location: "loc_02")
    build_call(campaign: nil, caller_number: "n", started_at: Time.utc(2026, 9, 3, 15), marketing_channel: "organic")
  end

  it "returns the range and a zero-filled day per date, without spend" do
    get path, params: params

    expect(response).to have_http_status(:ok)
    expect(body.keys).to eq(%w[range days])
    expect(body["range"]).to eq("from" => "2026-09-01", "to" => "2026-09-05")
    expect(body["days"].pluck("date")).to eq(%w[2026-09-01 2026-09-02 2026-09-03 2026-09-04 2026-09-05])
    expect(body["days"].first).to eq("date" => "2026-09-01", "calls" => 1, "booked" => 1, "revenue_cents" => 20_000)
    expect(body["days"].second).to eq("date" => "2026-09-02", "calls" => 0, "booked" => 0, "revenue_cents" => 0)
  end

  it "includes calls with no campaign" do
    get path, params: params

    expect(body["days"].third["calls"]).to eq(1)
  end

  it "buckets by the office's local date, not the UTC date" do
    # 02:00 UTC on 09-02 is 22:00 on 09-01 in New York.
    build_call(caller_number: "late", started_at: Time.utc(2026, 9, 2, 2))
    get path, params: params

    expect(body["days"].first["calls"]).to eq(2)
    expect(body["days"].second["calls"]).to eq(0)
  end

  it "applies the office filter" do
    get path, params: params.merge(location_id: "loc_02")

    expect(body["days"].sum { |d| d["calls"] }).to eq(1)
    expect(body["days"].last["calls"]).to eq(1)
  end

  it "sums to the campaign metrics totals for the same filters" do
    [ {}, { location_id: "loc_02" } ].each do |extra|
      get path, params: params.merge(extra)
      days = JSON.parse(response.body)["days"]
      get "/api/campaigns/metrics", params: params.merge(extra)
      totals = JSON.parse(response.body)["totals"]

      expect(days.sum { |d| d["calls"] }).to eq(totals["calls"])
      expect(days.sum { |d| d["booked"] }).to eq(totals["booked"])
      expect(days.sum { |d| d["revenue_cents"] }).to eq(totals["revenue_cents"])
    end
  end

  describe "errors" do
    it "returns 400 for missing, malformed, reversed and over-long ranges" do
      [ { to: "2026-09-05" }, { from: "09/01/2026", to: "2026-09-05" },
        { from: "2026-09-05", to: "2026-09-01" }, { from: "2026-01-01", to: "2027-01-02" } ].each do |bad|
        get path, params: bad
        expect(response).to have_http_status(:bad_request), bad.inspect
      end
    end

    it "returns 404 for an unknown location_id" do
      get path, params: params.merge(location_id: "loc_nope")

      expect(response).to have_http_status(:not_found)
    end
  end
end

require "rails_helper"

RSpec.describe "GET /api/campaigns/:id/daily", type: :request do
  let(:path) { "/api/campaigns/cmp_01/daily" }
  let(:params) { { from: "2026-09-01", to: "2026-09-05" } }
  let(:body) { JSON.parse(response.body) }

  def error_of(response)
    JSON.parse(response.body).fetch("error")
  end

  before do
    build_location(id: "loc_01")
    build_location(id: "loc_02")
    build_campaign(id: "cmp_01", name: "Brand", daily_budget_cents: 10_000)
    build_call(caller_number: "a", started_at: Time.utc(2026, 9, 1, 15), outcome: "booked", revenue_cents: 20_000)
    build_call(caller_number: "b", started_at: Time.utc(2026, 9, 5, 15), location: "loc_02")
  end

  it "returns the campaign and a zero-filled day per date" do
    get path, params: params

    expect(response).to have_http_status(:ok)
    expect(body.keys).to eq(%w[campaign days])
    expect(body["campaign"]).to eq("id" => "cmp_01", "name" => "Brand")
    expect(body["days"].pluck("date")).to eq(%w[2026-09-01 2026-09-02 2026-09-03 2026-09-04 2026-09-05])
    expect(body["days"].first).to eq("date" => "2026-09-01", "calls" => 1, "booked" => 1,
                                     "revenue_cents" => 20_000, "spend_cents" => 10_000)
    expect(body["days"].second).to include("calls" => 0, "revenue_cents" => 0)
  end

  it "serializes every metric as a number or null" do
    get path, params: params

    values = body["days"].flat_map { |d| d.except("date").values }
    expect(values).to all(satisfy { |v| v.nil? || v.is_a?(Numeric) })
  end

  it "applies the location filter" do
    get path, params: params.merge(location_id: "loc_02")

    expect(body["days"].sum { |d| d["calls"] }).to eq(1)
    expect(body["days"].sum { |d| d["spend_cents"] }).to eq(25_000)
  end

  it "returns null spend for a $0-budget campaign" do
    build_campaign(id: "cmp_02", daily_budget_cents: 0)
    get "/api/campaigns/cmp_02/daily", params: params

    expect(body["days"].pluck("spend_cents")).to all(be_nil)
  end

  describe "errors" do
    it "returns 404 for an unknown campaign" do
      get "/api/campaigns/cmp_nope/daily", params: params

      expect(response).to have_http_status(:not_found)
      expect(error_of(response)["code"]).to eq("not_found")
    end

    it "returns 404 for an unknown location_id" do
      get path, params: params.merge(location_id: "loc_nope")

      expect(response).to have_http_status(:not_found)
    end

    it "returns 400 for missing, malformed, reversed and over-long ranges" do
      [ { to: "2026-09-05" }, { from: "2026-09-01" }, { from: "09/01/2026", to: "2026-09-05" },
        { from: "2026-09-05", to: "2026-09-01" }, { from: "2026-01-01", to: "2027-01-02" } ].each do |bad|
        get path, params: bad
        expect(response).to have_http_status(:bad_request), bad.inspect
      end
    end

    it "returns 400 for a blank location_id" do
      get path, params: params.merge(location_id: "")

      expect(response).to have_http_status(:bad_request)
    end

    it "returns 400 rather than 404 when a bad range and an unknown campaign both apply" do
      get "/api/campaigns/cmp_nope/daily", params: { from: "2026-09-05", to: "2026-09-01" }

      expect(response).to have_http_status(:bad_request)
    end
  end
end

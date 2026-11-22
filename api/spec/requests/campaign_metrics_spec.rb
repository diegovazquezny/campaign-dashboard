require "rails_helper"

RSpec.describe "GET /api/campaigns/metrics", type: :request do
  let(:path) { "/api/campaigns/metrics" }
  let(:params) { { from: "2026-09-01", to: "2026-09-10" } }
  let(:body) { JSON.parse(response.body) }

  let(:row_fields) do
    %w[campaign_id name channel calls unique_callers new_callers booked booking_rate unanswered_rate
       awaiting_outcome revenue_cents spend_cents revenue_per_spend spend_per_booking_cents]
  end
  let(:total_fields) do
    %w[calls unique_callers new_callers booked booking_rate unanswered_rate missed voicemail awaiting_outcome
       revenue_cents spend_cents paid]
  end

  def metric_values(hash)
    hash.except("campaign_id", "name", "channel", "channel_breakdown").values
  end

  def error_of(response)
    JSON.parse(response.body).fetch("error")
  end

  before do
    build_location(id: "loc_01")
    build_location(id: "loc_02")
    build_campaign(id: "cmp_01", name: "Brand", daily_budget_cents: 10_000)
    build_campaign(id: "cmp_02", name: "Free", daily_budget_cents: 0)
    build_call(caller_number: "a", started_at: Time.utc(2026, 9, 1, 15), outcome: "booked", revenue_cents: 20_000)
    build_call(caller_number: "b", started_at: Time.utc(2026, 9, 10, 15), location: "loc_02")
    build_call(campaign: nil, caller_number: "n", started_at: Time.utc(2026, 9, 5, 15), marketing_channel: "organic")
  end

  describe "happy path" do
    before { get path, params: params }

    it "returns range, rows and totals" do
      expect(response).to have_http_status(:ok)
      expect(body.keys).to eq(%w[range rows totals])
      expect(body["range"]).to eq("from" => "2026-09-01", "to" => "2026-09-10")
    end

    it "lists campaigns by id, then No campaign, with every row field" do
      expect(body["rows"].pluck("campaign_id")).to eq([ "cmp_01", "cmp_02", nil ])
      expect(body["rows"]).to all(include(*row_fields))
      expect(body["rows"].first).to include("name" => "Brand", "calls" => 2, "booked" => 1,
                                            "revenue_cents" => 20_000, "spend_cents" => 100_000)
    end

    it "includes channel_breakdown only on the No campaign row" do
      expect(body["rows"].last).to include("name" => "No campaign",
                                           "channel_breakdown" => [ { "channel" => "organic", "calls" => 1, "booked" => 0,
                                                                    "revenue_cents" => 0 } ])
      expect(body["rows"].first(2)).to all(satisfy { |r| !r.key?("channel_breakdown") })
    end

    it "returns totals with the paid block" do
      expect(body["totals"].keys).to match_array(total_fields)
      expect(body["totals"]).to include("calls" => 3, "unique_callers" => 3)
      expect(body["totals"]["paid"].keys).to match_array(%w[revenue_cents booked spend_cents revenue_per_spend spend_per_booking_cents])
    end

    it "serializes every metric as a number or null" do
      values = body["rows"].flat_map { |r| metric_values(r) } + metric_values(body["totals"].except("paid")) +
               body["totals"]["paid"].values

      expect(values).to all(satisfy { |v| v.nil? || v.is_a?(Numeric) })
    end
  end

  it "applies the location filter" do
    get path, params: params.merge(location_id: "loc_02")

    expect(response).to have_http_status(:ok)
    expect(body["rows"].first).to include("calls" => 1, "spend_cents" => 50_000)
    expect(body["totals"]).to include("calls" => 1, "unique_callers" => 1)
  end

  describe "validation" do
    it "returns 400 for a missing from or to" do
      get path, params: { to: "2026-09-10" }
      expect(response).to have_http_status(:bad_request)
      expect(error_of(response)["code"]).to eq("bad_request")

      get path, params: { from: "2026-09-01" }
      expect(response).to have_http_status(:bad_request)
    end

    it "returns 400 for a malformed or impossible date" do
      get path, params: { from: "09/01/2026", to: "2026-09-10" }
      expect(response).to have_http_status(:bad_request)

      get path, params: { from: "2026-02-30", to: "2026-03-10" }
      expect(response).to have_http_status(:bad_request)
    end

    it "returns 400 for a reversed range" do
      get path, params: { from: "2026-09-10", to: "2026-09-01" }

      expect(response).to have_http_status(:bad_request)
    end

    it "returns 400 for a range over 366 days and accepts 366" do
      get path, params: { from: "2026-01-01", to: "2027-01-02" } # 367 days
      expect(response).to have_http_status(:bad_request)

      get path, params: { from: "2026-01-01", to: "2027-01-01" } # 366 days
      expect(response).to have_http_status(:ok)
    end

    it "returns 400 for a blank location_id" do
      get path, params: params.merge(location_id: "")

      expect(response).to have_http_status(:bad_request)
    end

    it "returns 404 for an unknown location_id" do
      get path, params: params.merge(location_id: "loc_nope")

      expect(response).to have_http_status(:not_found)
      expect(error_of(response)["code"]).to eq("not_found")
    end

    it "returns 400 rather than 404 when both a bad range and an unknown location are present" do
      get path, params: { from: "2026-09-10", to: "2026-09-01", location_id: "loc_nope" }

      expect(response).to have_http_status(:bad_request)
    end
  end
end

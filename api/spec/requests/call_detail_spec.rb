require "rails_helper"

RSpec.describe "GET /api/calls/:id", type: :request do
  # A method, not a `let`: some examples make more than one request.
  def body = JSON.parse(response.body)

  before do
    build_location(id: "loc_01", name: "Austin", timezone: "America/Chicago")
    build_campaign(id: "cmp_01", name: "Brand")
  end

  it "returns the list row fields plus caller facts" do
    build_call(id: "c1", started_at: Time.utc(2026, 9, 2, 15), outcome: "booked", revenue_cents: 9_000,
               location: "loc_01")
    get "/api/calls/c1"

    expect(response).to have_http_status(:ok)
    expect(body).to eq(
      "call_id" => "c1", "started_at" => "2026-09-02T15:00:00Z", "ended_at" => "2026-09-02T15:01:00Z",
      "local_date" => "2026-09-02", "timezone" => "America/Chicago", "duration_seconds" => 60,
      "answered" => true, "outcome" => "booked", "revenue_cents" => 9_000, "agent_id" => "agent_01",
      "tracking_number" => "+15550000000", "campaign" => { "id" => "cmp_01", "name" => "Brand" },
      "channel" => "paid_search", "location" => { "id" => "loc_01", "name" => "Austin" },
      "is_first_call" => true, "caller_call_count" => 1, "caller_first_seen" => "2026-09-02"
    )
  end

  it "tells a first call from a repeat call, and reports the caller's count and first-seen date" do
    build_call(id: "first", caller_number: "a", started_at: Time.utc(2026, 8, 1, 15), campaign: nil)
    build_call(id: "again", caller_number: "a", started_at: Time.utc(2026, 9, 1, 15))
    build_call(id: "other", caller_number: "b", started_at: Time.utc(2026, 9, 1, 16))

    get "/api/calls/first"
    expect(body.values_at("is_first_call", "caller_call_count", "caller_first_seen")).to eq([ true, 2, "2026-08-01" ])
    get "/api/calls/again"
    expect(body.values_at("is_first_call", "caller_call_count", "caller_first_seen")).to eq([ false, 2, "2026-08-01" ])
    get "/api/calls/other"
    expect(body.values_at("is_first_call", "caller_call_count")).to eq([ true, 1 ])
  end

  it "breaks a started_at tie by call_id, like new_callers" do
    build_call(id: "t1", caller_number: "a", started_at: Time.utc(2026, 9, 1, 15))
    build_call(id: "t2", caller_number: "a", started_at: Time.utc(2026, 9, 1, 15))

    get "/api/calls/t1"
    expect(body["is_first_call"]).to be(true)
    get "/api/calls/t2"
    expect(body["is_first_call"]).to be(false)
  end

  it "agrees with the metrics new_callers count over the same calls" do
    build_call(id: "a1", caller_number: "a", started_at: Time.utc(2026, 8, 20, 15))
    build_call(id: "a2", caller_number: "a", started_at: Time.utc(2026, 9, 1, 15))
    build_call(id: "b1", caller_number: "b", started_at: Time.utc(2026, 9, 2, 15))
    build_call(id: "b2", caller_number: "b", started_at: Time.utc(2026, 9, 3, 15))
    build_call(id: "c1", caller_number: "c", started_at: Time.utc(2026, 9, 4, 15))

    get "/api/campaigns/metrics", params: { from: "2026-09-01", to: "2026-09-30" }
    new_callers = JSON.parse(response.body)["totals"]["new_callers"]

    in_range = %w[a2 b1 b2 c1]
    firsts = in_range.count do |id|
      get "/api/calls/#{id}"
      body["is_first_call"]
    end
    expect(firsts).to eq(new_callers)
  end

  it "returns null campaign, outcome and revenue for an unattributed call awaiting an outcome" do
    build_call(id: "n", campaign: nil)
    get "/api/calls/n"

    expect(body.values_at("campaign", "outcome", "revenue_cents")).to eq([ nil, nil, nil ])
  end

  it "returns 404 for an unknown id" do
    get "/api/calls/nope"

    expect(response).to have_http_status(:not_found)
    expect(body["error"]["code"]).to eq("not_found")
  end

  it "never exposes the caller hash" do
    build_call(id: "c1", caller_number: "a")
    get "/api/calls/c1"

    expect(response.body).not_to include("caller_number_hash")
    expect(response.body).not_to include(Digest::SHA256.hexdigest("a"))
  end
end

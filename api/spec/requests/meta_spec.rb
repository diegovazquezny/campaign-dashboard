require "rails_helper"

RSpec.describe "GET /api/meta", type: :request do
  it "returns nulls and empty lists on an empty database" do
    get "/api/meta"

    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body)).to eq(
      "data_coverage" => nil, "freshness" => nil, "locations" => [], "campaigns" => []
    )
  end

  it "returns coverage, freshness, locations and campaigns" do
    build_location(id: "loc_01", name: "Northside", timezone: "America/New_York")
    build_campaign(id: "cmp_02", name: "B", channel: "referral")
    build_campaign(id: "cmp_01", name: "A", channel: "paid_search")
    build_call(campaign: "cmp_01", started_at: Time.utc(2026, 9, 1, 0, 39), duration_seconds: 0)

    get "/api/meta"

    expect(JSON.parse(response.body)).to eq(
      "data_coverage" => { "from" => "2026-08-31", "to" => "2026-08-31" },
      "freshness" => { "latest_update_at" => "2026-09-01T00:39:00Z", "outcomes_may_be_incomplete_from" => "2026-08-29" },
      "locations" => [ { "id" => "loc_01", "name" => "Northside", "timezone" => "America/New_York" } ],
      "campaigns" => [ { "id" => "cmp_01", "name" => "A", "channel" => "paid_search" },
                      { "id" => "cmp_02", "name" => "B", "channel" => "referral" } ]
    )
  end

  it "computes the incomplete-from date in UTC across a day boundary" do
    build_call(started_at: Time.utc(2026, 9, 4, 23, 0), duration_seconds: 0)
    build_call(started_at: Time.utc(2026, 9, 4, 22, 0), duration_seconds: 0)

    get "/api/meta"

    # 2026-09-04T23:00Z - 72h = 2026-09-01T23:00Z
    expect(JSON.parse(response.body)["freshness"]["outcomes_may_be_incomplete_from"]).to eq("2026-09-01")
  end
end

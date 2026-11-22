require "rails_helper"

RSpec.describe "GET /api/calls", type: :request do
  let(:path) { "/api/calls" }
  let(:params) { { from: "2026-09-01", to: "2026-09-30" } }

  # Methods, not `let`s: some examples make more than one request.
  def body = JSON.parse(response.body)
  def ids = body["calls"].pluck("call_id")

  before do
    build_location(id: "loc_01", name: "Austin", timezone: "America/Chicago")
    build_location(id: "loc_02", name: "Boston")
    build_campaign(id: "cmp_01", name: "Brand")
    build_campaign(id: "cmp_02", name: "Promo", channel: "social")
  end

  it "returns the row fields, with nested campaign and location" do
    build_call(id: "c1", started_at: Time.utc(2026, 9, 2, 15), outcome: "booked", revenue_cents: 9_000,
               location: "loc_01")
    get path, params: params

    expect(response).to have_http_status(:ok)
    expect(body.slice("page", "page_size", "total")).to eq("page" => 1, "page_size" => 25, "total" => 1)
    expect(body["calls"].first).to eq(
      "call_id" => "c1", "started_at" => "2026-09-02T15:00:00Z", "ended_at" => "2026-09-02T15:01:00Z",
      "local_date" => "2026-09-02", "timezone" => "America/Chicago", "duration_seconds" => 60,
      "answered" => true, "outcome" => "booked", "revenue_cents" => 9_000, "agent_id" => "agent_01",
      "tracking_number" => "+15550000000", "campaign" => { "id" => "cmp_01", "name" => "Brand" },
      "channel" => "paid_search", "location" => { "id" => "loc_01", "name" => "Austin" }
    )
  end

  it "never exposes the caller hash" do
    build_call(id: "c1")
    get path, params: params

    expect(response.body).not_to include("caller_number_hash")
    expect(response.body).not_to include(Digest::SHA256.hexdigest("caller_01"))
  end

  it "filters by date range on local_date" do
    build_call(id: "in", started_at: Time.utc(2026, 9, 10, 15))
    build_call(id: "out", started_at: Time.utc(2026, 10, 1, 15))
    get path, params: params

    expect(ids).to eq(%w[in])
  end

  it "filters by office" do
    build_call(id: "a", location: "loc_01")
    build_call(id: "b", location: "loc_02")
    get path, params: params.merge(location_id: "loc_02")

    expect(ids).to eq(%w[b])
  end

  it "filters by campaign id" do
    build_call(id: "a", campaign: "cmp_01")
    build_call(id: "b", campaign: "cmp_02")
    get path, params: params.merge(campaign_id: "cmp_02")

    expect(ids).to eq(%w[b])
  end

  it "returns unattributed calls for campaign_id=none, with a null campaign" do
    build_call(id: "a", campaign: "cmp_01")
    build_call(id: "n", campaign: nil)
    get path, params: params.merge(campaign_id: "none")

    expect(ids).to eq(%w[n])
    expect(body["calls"].first["campaign"]).to be_nil
  end

  it "filters by each outcome value" do
    build_call(id: "booked", outcome: "booked")
    build_call(id: "lead", outcome: "qualified_lead")
    build_call(id: "nq", outcome: "not_qualified")
    build_call(id: "missed", answered: false, outcome: "missed")
    build_call(id: "vm", answered: false, outcome: "voicemail")
    build_call(id: "awaiting")

    expected = { "booked" => "booked", "qualified_lead" => "lead", "not_qualified" => "nq",
                 "missed" => "missed", "voicemail" => "vm", "awaiting" => "awaiting" }
    expected.each do |outcome, id|
      get path, params: params.merge(outcome: outcome)
      expect(ids).to eq([ id ]), "outcome=#{outcome}"
    end
  end

  it "shows awaiting calls with a null outcome" do
    build_call(id: "awaiting")
    get path, params: params

    expect(body["calls"].first["outcome"]).to be_nil
  end

  it "combines filters" do
    build_call(id: "hit", campaign: "cmp_01", location: "loc_01", outcome: "booked")
    build_call(id: "wrong-outcome", campaign: "cmp_01", location: "loc_01")
    build_call(id: "wrong-office", campaign: "cmp_01", location: "loc_02", outcome: "booked")
    get path, params: params.merge(campaign_id: "cmp_01", location_id: "loc_01", outcome: "booked")

    expect(ids).to eq(%w[hit])
  end

  describe "ordering and pagination" do
    it "orders newest first and breaks started_at ties by call_id descending" do
      build_call(id: "old", started_at: Time.utc(2026, 9, 1, 15))
      build_call(id: "tie_a", started_at: Time.utc(2026, 9, 2, 15))
      build_call(id: "tie_b", started_at: Time.utc(2026, 9, 2, 15))
      build_call(id: "new", started_at: Time.utc(2026, 9, 3, 15))
      get path, params: params

      expect(ids).to eq(%w[new tie_b tie_a old])
    end

    context "with 27 calls" do
      before do
        27.times { |i| build_call(id: format("c%02d", i), started_at: Time.utc(2026, 9, 1, 10) + (i * 60)) }
      end

      it "returns 25 on page 1 and the rest on page 2, with the same total" do
        get path, params: params
        expect(ids.size).to eq(25)
        expect(body["total"]).to eq(27)
        first_page = ids

        get path, params: params.merge(page: 2)
        expect(ids).to eq(%w[c01 c00])
        expect(body).to include("page" => 2, "total" => 27)
        expect(first_page & ids).to be_empty
      end

      it "returns empty calls and the correct total past the last page" do
        get path, params: params.merge(page: 3)

        expect(response).to have_http_status(:ok)
        expect(body["calls"]).to eq([])
        expect(body["total"]).to eq(27)
      end
    end

    it "returns an empty list with total 0 when nothing matches" do
      get path, params: params

      expect(body).to include("total" => 0, "calls" => [])
    end
  end

  describe "validation" do
    it "rejects an unknown outcome with 400" do
      get path, params: params.merge(outcome: "sold")

      expect(response).to have_http_status(:bad_request)
      expect(body["error"]["code"]).to eq("bad_request")
    end

    %w[0 -1 abc 1.5 2x].each do |page|
      it "rejects page=#{page.inspect} with 400" do
        get path, params: params.merge(page: page)

        expect(response).to have_http_status(:bad_request)
      end
    end

    it "rejects a blank campaign_id" do
      get path, params: params.merge(campaign_id: "")

      expect(response).to have_http_status(:bad_request)
    end

    it "requires from and to" do
      get path, params: { from: "2026-09-01" }

      expect(response).to have_http_status(:bad_request)
    end

    it "returns 404 for an unknown office" do
      get path, params: params.merge(location_id: "nope")

      expect(response).to have_http_status(:not_found)
    end
  end
end

require "rails_helper"

RSpec.describe "Api::BaseController and Api::RangeParams", type: :request do
  def error_of(response)
    JSON.parse(response.body).fetch("error")
  end

  describe "error shape" do
    it "renders BadRequest as 400 with code and message" do
      get "/api/spec_dummy/bad_request"

      expect(response).to have_http_status(:bad_request)
      expect(JSON.parse(response.body)).to eq("error" => { "code" => "bad_request", "message" => "nope" })
    end

    it "renders RecordNotFound as 404 with code and message" do
      get "/api/spec_dummy/not_found"

      expect(response).to have_http_status(:not_found)
      error = error_of(response)
      expect(error.keys).to contain_exactly("code", "message")
      expect(error["code"]).to eq("not_found")
      expect(error["message"]).to eq("record not found")
    end
  end

  describe "missing required params" do
    it "renders ActionController::ParameterMissing as 400 in the same error shape" do
      get "/api/spec_dummy/parameter_missing"

      expect(response).to have_http_status(:bad_request)
      expect(error_of(response)["code"]).to eq("bad_request")
    end
  end

  describe "range validation" do
    it "accepts a valid range" do
      get "/api/spec_dummy", params: { from: "2026-09-01", to: "2026-09-30" }

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)).to eq("from" => "2026-09-01", "to" => "2026-09-30", "location_id" => nil)
    end

    it "accepts a single-day range" do
      get "/api/spec_dummy", params: { from: "2026-09-01", to: "2026-09-01" }

      expect(response).to have_http_status(:ok)
    end

    it "accepts a real leap day" do
      get "/api/spec_dummy", params: { from: "2028-02-29", to: "2028-03-01" }

      expect(response).to have_http_status(:ok)
    end

    it "accepts a 366-day range" do
      get "/api/spec_dummy", params: { from: "2027-01-01", to: "2028-01-01" }

      expect(response).to have_http_status(:ok)
    end

    [
      [ "from missing", { to: "2026-09-30" } ],
      [ "to missing", { from: "2026-09-01" } ],
      [ "both missing", {} ],
      [ "from blank", { from: "", to: "2026-09-30" } ],
      [ "from malformed", { from: "09/01/2026", to: "2026-09-30" } ],
      [ "to malformed", { from: "2026-09-01", to: "2026-9-30" } ],
      [ "from with time", { from: "2026-09-01T00:00:00Z", to: "2026-09-30" } ],
      [ "basic ISO format", { from: "20260901", to: "2026-09-30" } ],
      [ "impossible date", { from: "2026-02-30", to: "2026-03-30" } ],
      [ "impossible month", { from: "2026-13-01", to: "2026-03-30" } ],
      [ "reversed range", { from: "2026-09-30", to: "2026-09-01" } ],
      [ "367 days", { from: "2027-01-01", to: "2028-01-02" } ],
      [ "non-string date", { from: [ "2026-09-01" ], to: "2026-09-30" } ],
      [ "hash-valued date", { from: { a: "2026-09-01" }, to: "2026-09-30" } ],
      [ "to blank", { from: "2026-09-01", to: "" } ],
      [ "impossible leap day", { from: "2026-02-29", to: "2026-03-30" } ]
    ].each do |name, params|
      it "rejects #{name} with 400" do
        get "/api/spec_dummy", params: params

        expect(response).to have_http_status(:bad_request)
        expect(error_of(response)["code"]).to eq("bad_request")
        expect(error_of(response)["message"]).to be_present
      end
    end
  end

  describe "location_id" do
    let(:range) { { from: "2026-09-01", to: "2026-09-30" } }

    it "resolves a known location" do
      build_location(id: "loc_01")

      get "/api/spec_dummy", params: range.merge(location_id: "loc_01")

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)["location_id"]).to eq("loc_01")
    end

    it "rejects a present but blank location_id with 400" do
      get "/api/spec_dummy", params: range.merge(location_id: "")

      expect(response).to have_http_status(:bad_request)
    end

    it "rejects a whitespace-only location_id with 400" do
      get "/api/spec_dummy", params: range.merge(location_id: " ")

      expect(response).to have_http_status(:bad_request)
    end

    it "rejects an array-valued location_id with 400" do
      get "/api/spec_dummy", params: range.merge(location_id: [ "loc_01" ])

      expect(response).to have_http_status(:bad_request)
    end

    it "returns 404 for an unknown location" do
      get "/api/spec_dummy", params: range.merge(location_id: "loc_nope")

      expect(response).to have_http_status(:not_found)
      expect(error_of(response)["code"]).to eq("not_found")
    end

    it "returns 400 rather than 404 when the range is invalid and the location unknown" do
      get "/api/spec_dummy", params: { from: "2026-09-30", to: "2026-09-01", location_id: "loc_nope" }

      expect(response).to have_http_status(:bad_request)
    end

    it "returns 400 rather than 404 when location_id is blank and the range is invalid" do
      get "/api/spec_dummy", params: { from: "bad", to: "2026-09-01", location_id: "" }

      expect(response).to have_http_status(:bad_request)
    end
  end
end

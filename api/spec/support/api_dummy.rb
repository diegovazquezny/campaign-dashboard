# Spec-only controller and routes that exercise Api::BaseController and
# Api::RangeParams. `prepend` keeps the routes across route reloads.
module Api
  class SpecDummyController < BaseController
    def show
      range = RangeParams.parse(params)
      render json: { from: range.from, to: range.to, location_id: range.location&.id }
    end

    def missing
      Campaign.find("missing")
    end

    def bad_request
      raise BadRequest, "nope"
    end
  end
end

Rails.application.routes.prepend do
  namespace :api do
    get "spec_dummy" => "spec_dummy#show"
    get "spec_dummy/not_found" => "spec_dummy#missing"
    get "spec_dummy/bad_request" => "spec_dummy#bad_request"
  end
end

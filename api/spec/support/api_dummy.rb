# Spec-only controller and routes that exercise Api::BaseController and
# Api::RangeParams. `prepend` keeps the routes across route reloads, and the
# explicit reload covers CI (eager_load), where routes are drawn before this
# file loads and a later prepend would otherwise never apply.
module Api
  class SpecDummyController < BaseController
    def show
      range = RangeParams.parse(params)
      render json: { from: range.from, to: range.to, location_id: range.location&.id }
    end

    def not_found
      Campaign.find("missing")
    end

    def parameter_missing
      params.require(:needed)
    end

    def bad_request
      raise BadRequest, "nope"
    end
  end
end

Rails.application.routes.prepend do
  namespace :api do
    get "spec_dummy" => "spec_dummy#show"
    get "spec_dummy/not_found" => "spec_dummy#not_found"
    get "spec_dummy/bad_request" => "spec_dummy#bad_request"
    get "spec_dummy/parameter_missing" => "spec_dummy#parameter_missing"
  end
end
Rails.application.reload_routes!

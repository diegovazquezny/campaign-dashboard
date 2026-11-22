module Api
  class DailyController < BaseController
    def show
      range = RangeParams.parse(params)

      render json: Metrics::AccountDaily.call(from: range.from, to: range.to, location_id: range.location&.id)
    end
  end
end

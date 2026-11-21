module Api
  class CampaignMetricsController < BaseController
    def index
      range = RangeParams.parse(params)

      render json: Metrics::CampaignMetrics.call(from: range.from, to: range.to, location_id: range.location&.id)
    end
  end
end

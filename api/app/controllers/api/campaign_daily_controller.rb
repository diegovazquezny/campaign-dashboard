module Api
  class CampaignDailyController < BaseController
    def show
      range = RangeParams.parse(params)
      campaign = Campaign.find(params[:id])

      render json: Metrics::CampaignDaily.call(campaign: campaign, from: range.from, to: range.to,
                                               location_id: range.location&.id)
    end
  end
end

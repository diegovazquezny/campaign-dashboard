module Api
  class CallDetailsController < BaseController
    def show
      render json: Metrics::CallDetail.call(id: params[:id])
    end
  end
end

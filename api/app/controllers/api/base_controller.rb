module Api
  class BaseController < ApplicationController
    rescue_from BadRequest do |error|
      render_error("bad_request", error.message, :bad_request)
    end

    rescue_from ActionController::ParameterMissing do |error|
      render_error("bad_request", "#{error.param} is required", :bad_request)
    end

    # A fixed message: Rails' own text names the model and is not a stable contract.
    rescue_from ActiveRecord::RecordNotFound do
      render_error("not_found", "record not found", :not_found)
    end

    private

    def render_error(code, message, status)
      render json: { error: { code: code, message: message } }, status: status
    end
  end
end

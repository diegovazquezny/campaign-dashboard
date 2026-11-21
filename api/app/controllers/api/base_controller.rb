module Api
  class BaseController < ApplicationController
    rescue_from BadRequest do |error|
      render_error("bad_request", error.message, :bad_request)
    end

    rescue_from ActiveRecord::RecordNotFound do |error|
      render_error("not_found", error.message, :not_found)
    end

    private

    def render_error(code, message, status)
      render json: { error: { code: code, message: message } }, status: status
    end
  end
end

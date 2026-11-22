module Api
  class CallsController < BaseController
    OUTCOMES = (Outcome::ALL + [ Metrics::CallList::AWAITING ]).freeze
    PAGE_FORMAT = /\A[1-9]\d{0,8}\z/

    def index
      range = RangeParams.parse(params)

      render json: Metrics::CallList.call(
        from: range.from, to: range.to, location_id: range.location&.id,
        campaign_id: optional_string(:campaign_id), outcome: parse_outcome, page: parse_page
      )
    end

    private

    def optional_string(name)
      return nil unless params.key?(name)

      value = params[name]
      raise BadRequest, "#{name} must not be blank" unless value.is_a?(String) && value.present?

      value
    end

    def parse_outcome
      value = optional_string(:outcome)
      return nil if value.nil?

      raise BadRequest, "outcome must be one of #{OUTCOMES.join(', ')}" unless OUTCOMES.include?(value)

      value
    end

    def parse_page
      return 1 unless params.key?(:page)

      value = params[:page]
      raise BadRequest, "page must be a positive integer" unless value.is_a?(String) && value.match?(PAGE_FORMAT)

      value.to_i
    end
  end
end

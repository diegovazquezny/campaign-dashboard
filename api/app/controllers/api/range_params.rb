module Api
  # Parses and validates the `from`, `to` and optional `location_id` request
  # parameters shared by the metrics endpoints. All 400 checks run before the
  # location lookup (404), so a bad request never reaches the database.
  class RangeParams
    MAX_DAYS = 366
    DATE_FORMAT = /\A\d{4}-\d{2}-\d{2}\z/

    Result = Data.define(:from, :to, :location)

    def self.parse(params)
      new(params).parse
    end

    def initialize(params)
      @params = params
    end

    def parse
      from = parse_date(:from)
      to = parse_date(:to)
      raise BadRequest, "from must be on or before to" if from > to
      raise BadRequest, "range must not exceed #{MAX_DAYS} days" if (to - from).to_i + 1 > MAX_DAYS

      location_id = parse_location_id
      Result.new(from: from, to: to, location: location_id && Location.find(location_id))
    end

    private

    def parse_date(name)
      value = @params[name]
      raise BadRequest, "#{name} is required" if value.blank?
      raise BadRequest, "#{name} must be a date in YYYY-MM-DD format" unless value.is_a?(String) && value.match?(DATE_FORMAT)

      Date.iso8601(value)
    rescue Date::Error
      raise BadRequest, "#{name} must be a real calendar date in YYYY-MM-DD format"
    end

    def parse_location_id
      return nil unless @params.key?(:location_id)

      value = @params[:location_id]
      raise BadRequest, "location_id must not be blank" unless value.is_a?(String) && value.present?

      value
    end
  end
end

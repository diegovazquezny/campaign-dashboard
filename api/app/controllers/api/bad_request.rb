module Api
  # Raised for invalid request parameters; Api::BaseController renders it as a 400.
  class BadRequest < StandardError; end
end

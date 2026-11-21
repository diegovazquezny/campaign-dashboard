# Call outcomes, defined once. Used by the Call enum and its check constraint.
module Outcome
  ALL = %w[booked qualified_lead not_qualified missed voicemail].freeze
end

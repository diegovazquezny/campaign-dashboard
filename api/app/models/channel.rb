# Marketing channels, defined once. Used by the Campaign and Call enums and
# checked against the DB check constraints in spec/models/channel_spec.rb.
module Channel
  ALL = %w[paid_search social display organic direct referral].freeze
end

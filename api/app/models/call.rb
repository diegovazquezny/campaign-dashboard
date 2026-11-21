class Call < ApplicationRecord
  # scopes: false, as in Campaign (`display` would shadow Object#display).
  enum :outcome, Outcome::ALL.index_with(&:itself), scopes: false, validate: { allow_nil: true }
  enum :marketing_channel, Channel::ALL.index_with(&:itself), scopes: false, validate: true

  belongs_to :campaign, optional: true
  belongs_to :location
end

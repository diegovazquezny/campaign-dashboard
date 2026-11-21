class Campaign < ApplicationRecord
  # scopes: false, because the `display` value would otherwise define
  # Campaign.display and shadow Object#display.
  enum :channel, Channel::ALL.index_with(&:itself), scopes: false, validate: true

  validates :name, presence: true
  validates :daily_budget_cents, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
end
